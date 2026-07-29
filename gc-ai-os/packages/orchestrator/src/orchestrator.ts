import type { AgentRegistry } from "@gc-ai-os/agents-core";
import type { MemoryClient } from "@gc-ai-os/memory";
import type { ChatMessage } from "@gc-ai-os/model-provider";
import type { AuthorizationService } from "@gc-ai-os/security";
import type { Task, TaskResult } from "@gc-ai-os/shared-types";
import type { DomainClassifier } from "./domain-classifier";
import { RoutingAmbiguityError } from "./errors";
import { hashText } from "./hash";
import type { TaskStore } from "./task-store";

export interface ChatReply {
  agentId: string;
  agentName: string;
  taskId: string;
  text: string;
  escalated: boolean;
}

interface Conversable {
  converse(history: ChatMessage[]): Promise<{ text: string; escalated: boolean }>;
}

function isConversable(agent: unknown): agent is Conversable {
  return typeof (agent as Partial<Conversable>).converse === "function";
}

/**
 * Orchestrateur (voir docs/gc-ai-os/02-architecture-globale.md).
 * N'exécute jamais d'action outillée lui-même — il route vers un agent,
 * qui seul invoque des connecteurs via ConnectorGateway. Trois
 * responsabilités distinctes, exposées comme trois méthodes séparées
 * plutôt que fusionnées, pour rester fidèles à la séparation décrite
 * dans le document d'architecture.
 */
export class Orchestrator {
  constructor(
    private readonly agents: AgentRegistry,
    private readonly tasks: TaskStore,
    private readonly options: {
      classifier?: DomainClassifier;
      authorization?: AuthorizationService;
      memory?: MemoryClient;
    } = {},
  ) {}

  /**
   * Router — détermine quel agent est compétent pour un domaine donné.
   * Zéro ou plusieurs candidats est une ambiguïté : elle est remontée
   * (exception dédiée), jamais résolue par une supposition.
   */
  route(requiredDomain: string) {
    const candidates = this.agents.findByDomain(requiredDomain);
    if (candidates.length !== 1) {
      throw new RoutingAmbiguityError(
        requiredDomain,
        candidates.map((agent) => agent.manifest.id),
      );
    }
    return candidates[0]!;
  }

  /**
   * Planner — décompose une tâche en sous-tâches liées par
   * `parentTaskId`. Le squelette de phase 1 délègue la décomposition à
   * l'appelant (humain ou agent CEO/CTO) ; l'auto-décomposition par un
   * agent planificateur est un chantier de phase 2.
   */
  async plan(
    parent: Task,
    subtasks: Array<Omit<Task, "id" | "createdAt" | "updatedAt" | "closedAt" | "parentTaskId">>,
  ): Promise<Task[]> {
    return Promise.all(
      subtasks.map((subtask) =>
        this.tasks.create({ ...subtask, parentTaskId: parent.id }),
      ),
    );
  }

  /**
   * Superviseur — assigne la tâche à l'agent routé, exécute, persiste le
   * résultat. Les échecs remontent tels quels : la politique de retry /
   * escalade est un chantier de phase 2, volontairement absent de ce
   * squelette pour ne pas figer une stratégie non encore éprouvée.
   */
  async dispatch(task: Task, requiredDomain: string): Promise<TaskResult> {
    const agent = this.route(requiredDomain);
    await this.tasks.assign(task.id, agent.manifest.id);
    await this.tasks.updateStatus(task.id, "in_progress");

    const result = await agent.handleTask(task);

    await this.tasks.updateStatus(
      task.id,
      result.status === "completed" ? "completed" : "failed",
    );

    return result;
  }

  /**
   * Point d'entrée du chat (voir docs/gc-ai-os/07-interface.md,
   * "Interface conversationnelle") : un humain ne parle jamais
   * directement à un agent, il parle à l'Orchestrateur, qui route,
   * vérifie les permissions, exécute et documente — le cycle de vie
   * complet d'une tâche (voir 02-architecture-globale.md), appliqué à un
   * tour de conversation.
   */
  async handleMessage(message: string, history: ChatMessage[] = []): Promise<ChatReply> {
    const domains = [...new Set(this.agents.list().map((manifest) => manifest.domain))];
    const classifier = this.options.classifier;
    const domain = classifier
      ? classifier.classify(message, domains)
      : this.defaultDomain(domains);

    const agent = this.route(domain);

    const task = await this.tasks.create({
      title: message.slice(0, 80),
      description: message,
      status: "received",
      assignedAgentId: null,
      parentTaskId: null,
      riskLevel: "low",
    });

    if (this.options.authorization) {
      const authResult = await this.options.authorization.authorize({
        agentId: agent.manifest.id,
        roleId: agent.manifest.id,
        capability: `${agent.manifest.id}.converse`,
        riskLevel: "low",
        paramsHash: hashText(message),
        taskId: task.id,
      });

      if (authResult.decision === "denied") {
        await this.tasks.updateStatus(task.id, "failed");
        return {
          agentId: agent.manifest.id,
          agentName: agent.manifest.name,
          taskId: task.id,
          text: "Action refusée par le RBAC : cet agent n'a pas la permission de converser.",
          escalated: true,
        };
      }
    }

    await this.tasks.assign(task.id, agent.manifest.id);
    await this.tasks.updateStatus(task.id, "in_progress");

    const reply = isConversable(agent)
      ? await agent.converse([...history, { role: "user", content: message }])
      : await agent
          .handleTask(task)
          .then((result) => ({ text: result.summary, escalated: result.status === "escalated" }));

    await this.tasks.updateStatus(task.id, reply.escalated ? "awaiting_validation" : "completed");

    if (this.options.memory) {
      await this.options.memory.write(
        {
          scope: "agent",
          agentId: agent.manifest.id,
          title: `Conversation ${task.id}`,
          content: `Q: ${message}\nR: ${reply.text}`,
        },
        agent.manifest.id,
      );
    }

    return {
      agentId: agent.manifest.id,
      agentName: agent.manifest.name,
      taskId: task.id,
      text: reply.text,
      escalated: reply.escalated,
    };
  }

  private defaultDomain(domains: string[]): string {
    if (domains.length === 0) {
      throw new Error("Aucun agent enregistré — impossible de router le message.");
    }
    return domains[0]!;
  }
}
