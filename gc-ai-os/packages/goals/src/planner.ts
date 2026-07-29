import type { ModelProvider } from "@gc-ai-os/model-provider";
import type { Mission, ObjectiveHorizon, RiskLevel } from "@gc-ai-os/shared-types";

/**
 * Mission telle que produite par le planificateur, avant persistance.
 * `dependsOn` référence les `ref` d'autres missions du même plan (et non
 * des identifiants de base), pour que le plan soit exprimable avant
 * d'être écrit.
 */
export interface PlannedMission {
  ref: string;
  title: string;
  brief: string;
  domain: string;
  requiredSkill: string;
  dependsOn: string[];
  riskLevel: RiskLevel;
  acceptanceCriteria: string;
}

export interface PlannedKeyResult {
  metric: string;
  unit: string;
  baseline: number;
  target: number;
}

export interface Plan {
  keyResults: PlannedKeyResult[];
  missions: PlannedMission[];
  /** "model" si le plan vient d'un LLM, "template" s'il vient du playbook déterministe. */
  source: "model" | "template";
}

export interface Planner {
  plan(input: { title: string; statement: string; horizon: ObjectiveHorizon }): Promise<Plan>;
}

const PLAN_SCHEMA = `{
  "keyResults": [{"metric": "...", "unit": "...", "baseline": 0, "target": 0}],
  "missions": [{
    "ref": "m1",
    "title": "...",
    "brief": "instructions détaillées pour l'agent, 3 à 6 phrases",
    "domain": "un de: strategie|architecture-technique|frontend|backend|base-de-donnees|infrastructure|qualite|marketing|commercial|support-client|finance|contenu|recherche|donnees|conformite|automatisation|securite|succes-client|recrutement",
    "requiredSkill": "compétence précise, ex: redaction-plan-acquisition",
    "dependsOn": ["ref d'autres missions, [] si aucune"],
    "riskLevel": "low|medium|high|critical",
    "acceptanceCriteria": "critère observable de réussite du livrable"
  }]
}`;

/**
 * Planificateur porté par un modèle. C'est ici — et non dans
 * l'affectation d'agents — que le jugement d'un LLM apporte une vraie
 * valeur : décomposer « amener Génération Capable à 1 000 vendeurs
 * actifs » en missions cohérentes demande une compréhension du domaine
 * qu'aucune règle déterministe ne couvre.
 *
 * Si le modèle renvoie un plan inexploitable, on ne devine pas : on
 * bascule sur le playbook déterministe et on le signale via
 * `Plan.source`.
 */
export class ModelPlanner implements Planner {
  constructor(
    private readonly model: ModelProvider,
    private readonly fallback: Planner,
  ) {}

  async plan(input: { title: string; statement: string; horizon: ObjectiveHorizon }): Promise<Plan> {
    if (this.model.mode !== "anthropic") {
      return this.fallback.plan(input);
    }

    try {
      const completion = await this.model.complete([
        {
          role: "system",
          content:
            "Tu es le planificateur de GC AI OS. Tu décomposes un objectif d'entreprise en " +
            "missions exécutables par des agents spécialisés. Règles : entre 4 et 8 missions, " +
            "chacune produisant un livrable concret ; exprime les dépendances réelles (une " +
            "mission d'exécution dépend de la mission d'analyse qui la précède) ; chaque " +
            "mission a un critère de réussite observable. Réponds STRICTEMENT en JSON, sans " +
            "texte autour, au format : " +
            PLAN_SCHEMA,
        },
        {
          role: "user",
          content: `Objectif (${input.horizon}) : ${input.title}\n\nÉnoncé : ${input.statement}`,
        },
      ]);

      const parsed = parsePlan(completion.text);
      if (parsed) return { ...parsed, source: "model" };
    } catch {
      // Échec réseau ou modèle : on retombe sur le playbook plutôt que
      // d'interrompre l'objectif.
    }

    return this.fallback.plan(input);
  }
}

function parsePlan(raw: string): Omit<Plan, "source"> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    const data = JSON.parse(raw.slice(start, end + 1)) as Partial<Omit<Plan, "source">>;
    if (!Array.isArray(data.missions) || data.missions.length === 0) return null;

    const missions = data.missions
      .filter((m): m is PlannedMission => Boolean(m && m.title && m.domain))
      .map((m, index) => ({
        ref: m.ref || `m${index + 1}`,
        title: String(m.title),
        brief: String(m.brief ?? m.title),
        domain: String(m.domain),
        requiredSkill: String(m.requiredSkill || slug(m.title)),
        dependsOn: Array.isArray(m.dependsOn) ? m.dependsOn.map(String) : [],
        riskLevel: normalizeRisk(m.riskLevel),
        acceptanceCriteria: String(m.acceptanceCriteria ?? "Livrable produit et non vide."),
      }));

    if (missions.length === 0) return null;

    const keyResults = Array.isArray(data.keyResults)
      ? data.keyResults
          .filter((k): k is PlannedKeyResult => Boolean(k && k.metric))
          .map((k) => ({
            metric: String(k.metric),
            unit: String(k.unit ?? ""),
            baseline: Number(k.baseline ?? 0),
            target: Number(k.target ?? 0),
          }))
      : [];

    return { missions: dropUnknownDependencies(missions), keyResults };
  } catch {
    return null;
  }
}

function normalizeRisk(value: unknown): RiskLevel {
  return value === "medium" || value === "high" || value === "critical" ? value : "low";
}

/**
 * Un modèle peut référencer une dépendance qui n'existe pas dans le
 * plan qu'il vient de produire. Laisser passer une telle référence
 * bloquerait la mission pour toujours dans l'ordonnanceur : on nettoie
 * plutôt que de faire confiance.
 */
function dropUnknownDependencies(missions: PlannedMission[]): PlannedMission[] {
  const known = new Set(missions.map((m) => m.ref));
  return missions.map((m) => ({
    ...m,
    dependsOn: m.dependsOn.filter((ref) => known.has(ref) && ref !== m.ref),
  }));
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export { slug };
export type { Mission };
