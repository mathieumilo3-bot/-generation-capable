/**
 * États internes du moteur → étapes humaines (§20). L'utilisateur ne voit jamais
 * « worker », « queue », « encoding »… uniquement ces 5 étapes puis « prête ».
 */
export const JOB_STATUSES = [
  "created", "uploading", "queued", "preparing", "analyzing", "editing",
  "rendering", "quality_check", "completed", "failed", "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const ACTIVE_JOB_STATUSES: readonly JobStatus[] = [
  "created", "uploading", "queued", "preparing", "analyzing", "editing", "rendering", "quality_check",
];

export function isActiveJob(status: JobStatus): boolean {
  return ACTIVE_JOB_STATUSES.includes(status);
}

export const STEPS = [
  { key: "prepare", label: "Préparation" },
  { key: "analyze", label: "Analyse" },
  { key: "edit", label: "Création du montage" },
  { key: "finalize", label: "Finalisation" },
  { key: "qc", label: "Contrôle qualité" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

const STATUS_TO_STEP: Record<JobStatus, number> = {
  created: 0, uploading: 0, queued: 0, preparing: 0,
  analyzing: 1, editing: 2, rendering: 3, quality_check: 4,
  completed: 5, failed: -1, cancelled: -1,
};

export interface StepView { key: StepKey; label: string; state: "done" | "active" | "todo" }

export interface JobView {
  steps: StepView[];
  headline: string;
  /** Pourcentage fiable (réel, fourni par le moteur) ; null si seul l'état est connu. */
  percent: number | null;
  tone: "progress" | "success" | "error" | "neutral";
  isTerminal: boolean;
}

export function describeJob(status: JobStatus, progress: number | null | undefined): JobView {
  const idx = STATUS_TO_STEP[status];
  if (status === "completed") {
    return { steps: STEPS.map((s) => ({ ...s, state: "done" as const })), headline: "Votre vidéo est prête", percent: 100, tone: "success", isTerminal: true };
  }
  if (status === "failed") {
    return { steps: STEPS.map((s) => ({ ...s, state: "todo" as const })), headline: "Le rendu n'a pas pu être terminé", percent: null, tone: "error", isTerminal: true };
  }
  if (status === "cancelled") {
    return { steps: STEPS.map((s) => ({ ...s, state: "todo" as const })), headline: "Création annulée", percent: null, tone: "neutral", isTerminal: true };
  }
  const steps = STEPS.map((s, i) => ({ ...s, state: (i < idx ? "done" : i === idx ? "active" : "todo") as StepView["state"] }));
  const waiting = status === "created" || status === "uploading" || status === "queued";
  return {
    steps,
    headline: waiting ? "En file d'attente" : STEPS[idx]!.label,
    // Pas de fausse barre : tant que le moteur n'a rien mesuré (0), on n'affiche pas de pourcentage.
    percent: progress && progress > 0 ? Math.min(progress, 99) : null,
    tone: "progress",
    isTerminal: false,
  };
}

/** Libellé court pour les cartes (accueil/projets). */
export function jobBadge(status: JobStatus | undefined, projectStatus: string): { label: string; tone: "progress" | "success" | "error" | "neutral" } {
  if (status && isActiveJob(status)) return { label: "En cours", tone: "progress" };
  if (projectStatus === "ready") return { label: "Terminé", tone: "success" };
  if (projectStatus === "failed") return { label: "Échec", tone: "error" };
  if (projectStatus === "draft") return { label: "Brouillon", tone: "neutral" };
  return { label: "Archivé", tone: "neutral" };
}
