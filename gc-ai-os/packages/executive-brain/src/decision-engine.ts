import type { BrainProposal, Effort, Horizon, Risk } from "./types";

/**
 * Grille d'arbitrage du GC Decision Engine
 * (voir docs/gc-ai-os/14-executive-brain.md).
 *
 * Traduit les questions posées avant chaque décision — est-ce aligné
 * avec la vision, rentable, risqué, urgent, quel effet à 1 mois / 1 an /
 * 5 ans — en critères pondérés et calculables.
 */
export const DECISION_WEIGHTS = {
  alignment: 0.25,
  roi: 0.25,
  confidence: 0.2,
  urgency: 0.15,
  safety: 0.15,
} as const;

/**
 * Seuil d'écart en dessous duquel deux propositions sont considérées
 * ex æquo. C'est le seul cas où une délibération argumentée apporte
 * quelque chose que le calcul n'apporte pas.
 */
export const TIE_THRESHOLD = 0.05;

const EFFORT_COST: Record<Effort, number> = { low: 0.2, medium: 0.5, high: 1 };
const RISK_LEVEL: Record<Risk, number> = { low: 0.15, medium: 0.5, high: 1 };
const URGENCY: Record<Horizon, number> = {
  immediate: 1,
  month: 0.65,
  year: 0.35,
  multi_year: 0.15,
};

export interface ScoredProposal {
  proposal: BrainProposal;
  score: number;
  breakdown: Record<keyof typeof DECISION_WEIGHTS, number>;
  /** Explication en clair, reconstituable depuis les chiffres. */
  explanation: string;
}

export interface Arbitration {
  ranked: ScoredProposal[];
  winner: ScoredProposal | null;
  /** Propositions à égalité avec la gagnante — délibération justifiée. */
  contested: ScoredProposal[];
  rationale: string;
}

/**
 * Confiance accordée à une proposition, dérivée de la matière mesurée
 * qui la fonde.
 *
 * C'est le mécanisme central de l'étage exécutif. Une proposition sans
 * preuve chiffrée n'est pas écartée d'office — elle démarre simplement
 * à faible confiance et ne peut pas battre un constat étayé. Effet
 * recherché : le système privilégie naturellement ce qu'il observe
 * réellement, et son premier réflexe quand il ne voit rien est de
 * demander l'instrumentation plutôt que d'inventer un diagnostic.
 */
function confidenceOf(proposal: BrainProposal): number {
  const measured = proposal.evidence.filter((reading) => reading.value !== null);
  if (measured.length === 0) return 0.25;
  return Math.min(1, 0.6 + 0.2 * measured.length);
}

/**
 * Retour sur investissement estimé : impact attendu rapporté à l'effort.
 * Volontairement grossier — l'objectif est de départager des ordres de
 * grandeur, pas de simuler un plan financier.
 */
function roiOf(proposal: BrainProposal): number {
  const cost = EFFORT_COST[proposal.effort];
  const impact = proposal.alignment;
  return Math.min(1, impact / (cost + 0.25));
}

export function scoreProposal(proposal: BrainProposal): ScoredProposal {
  const breakdown = {
    alignment: proposal.alignment,
    roi: roiOf(proposal),
    confidence: confidenceOf(proposal),
    urgency: URGENCY[proposal.horizon],
    safety: 1 - RISK_LEVEL[proposal.risk],
  };

  const score =
    breakdown.alignment * DECISION_WEIGHTS.alignment +
    breakdown.roi * DECISION_WEIGHTS.roi +
    breakdown.confidence * DECISION_WEIGHTS.confidence +
    breakdown.urgency * DECISION_WEIGHTS.urgency +
    breakdown.safety * DECISION_WEIGHTS.safety;

  return {
    proposal,
    score: round(score),
    breakdown,
    explanation:
      `alignement ${breakdown.alignment.toFixed(2)} · ` +
      `ROI ${breakdown.roi.toFixed(2)} · ` +
      `confiance ${breakdown.confidence.toFixed(2)} ` +
      `(${proposal.evidence.filter((e) => e.value !== null).length} métrique(s) mesurée(s)) · ` +
      `urgence ${breakdown.urgency.toFixed(2)} · ` +
      `sûreté ${breakdown.safety.toFixed(2)}`,
  };
}

/**
 * Arbitre entre toutes les propositions des Brains.
 *
 * Choix d'architecture assumé : pas de débat entre huit modèles. Huit
 * instances du même modèle qui « débattent » ne produisent pas huit avis
 * indépendants — elles échantillonnent huit fois la même distribution,
 * au prix de huit appels. Ce qui distingue réellement un CFO d'un CMO,
 * c'est la donnée qu'il regarde, pas la personnalité qu'on lui prête.
 *
 * L'arbitrage est donc calculé sur des critères explicites. La
 * délibération est réservée aux ex æquo réels (voir `contested`), là où
 * les chiffres ne tranchent pas et où un argumentaire apporte quelque
 * chose.
 */
export function arbitrate(proposals: BrainProposal[]): Arbitration {
  if (proposals.length === 0) {
    return {
      ranked: [],
      winner: null,
      contested: [],
      rationale: "Aucune proposition : aucun seuil d'alerte franchi et aucune donnée à instrumenter.",
    };
  }

  const ranked = proposals
    .map(scoreProposal)
    .sort((a, b) => b.score - a.score || a.proposal.id.localeCompare(b.proposal.id));

  const winner = ranked[0]!;
  const contested = ranked.slice(1).filter((c) => winner.score - c.score <= TIE_THRESHOLD);

  const rationale = contested.length
    ? `${ranked.length} propositions arbitrées. « ${winner.proposal.title} » retenue (score ${winner.score}), ` +
      `mais ${contested.length} proposition(s) à moins de ${TIE_THRESHOLD} d'écart : la décision mérite une délibération humaine.`
    : `${ranked.length} propositions arbitrées. « ${winner.proposal.title} » retenue (score ${winner.score}), ` +
      `devant « ${ranked[1]?.proposal.title ?? "—"} ». Écart suffisant pour trancher sans délibération.`;

  return { ranked, winner, contested, rationale };
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
