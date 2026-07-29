import { ConversationalAgent } from "@gc-ai-os/agents-core";
import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { AgentBlueprint, AgentManifest } from "@gc-ai-os/shared-types";

/**
 * Agent instancié à partir d'un manifeste déclaratif, sans génération de
 * code (voir docs/gc-ai-os/11-factory.md).
 *
 * C'est le cœur de GC AI Factory. L'alternative — faire écrire des
 * fichiers TypeScript par un agent Builder — produirait du code jamais
 * relu, impossible à valider automatiquement et exécuté avec les
 * privilèges du serveur : un vecteur d'attaque évident dès qu'un
 * blueprint provient d'un utilisateur externe.
 *
 * Ici, un agent publié n'est qu'une ligne en base. Il est validable par
 * schéma, versionnable, diffable, révocable, et ne peut rien exécuter
 * que le RBAC ne lui ait explicitement accordé. C'est ce qui rend la
 * fabrique d'employés IA acceptable pour des milliers d'organisations
 * plutôt que réservée à un usage interne surveillé.
 */
export class DeclarativeAgent extends ConversationalAgent {
  readonly manifest: AgentManifest;
  protected readonly criticalPatterns: RegExp[];

  constructor(
    private readonly blueprint: AgentBlueprint,
    model: ModelProvider,
  ) {
    super(model);

    this.manifest = {
      id: blueprint.id,
      name: blueprint.name,
      domain: blueprint.domain,
      role: blueprint.role,
      responsibilities: blueprint.responsibilities,
      tools: blueprint.tools,
      memory: { scope: "agent", readAccess: blueprint.readAccess },
      model: blueprint.model,
    };

    // Les motifs ont déjà été validés à la publication (voir
    // validateBlueprint) ; on reste défensif car un manifeste peut avoir
    // été écrit en base par une version antérieure du schéma.
    this.criticalPatterns = blueprint.criticalPatterns.flatMap((pattern) => {
      try {
        return [new RegExp(pattern, "i")];
      } catch {
        return [];
      }
    });
  }

  protected override buildSystemPrompt(): string {
    const base = super.buildSystemPrompt();
    if (!this.blueprint.systemGuidance) return base;
    return `${base}\n\nDIRECTIVES SPÉCIFIQUES À CET AGENT\n${this.blueprint.systemGuidance}`;
  }
}
