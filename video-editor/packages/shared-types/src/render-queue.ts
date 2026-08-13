/**
 * Contrats de la Render Queue — le cœur de la "video editing factory".
 *
 * Un `RenderJob` est l'unité de travail de bout en bout d'UN projet
 * (analyse → montage → rendu → QC → livraison), distincte des `jobs`
 * d'étape existants (packages/db/schema.sql, table `jobs`) qui restent la
 * trace d'audit fine par étape. La queue, elle, pilote QUAND et SUR QUEL
 * worker un projet s'exécute, avec priorité, reprise après crash et
 * garantie d'exécution unique.
 *
 * Ces types sont volontairement sans dépendance runtime (pas d'os, pas de
 * db) pour rester importables partout, y compris dans le bundle webpack de
 * Next.js.
 */

/**
 * Cycle de vie d'un job de rendu (§2 du brief factory). Superset des
 * statuts d'un `ProjectStatus` : la queue expose une granularité plus fine
 * que l'UI projet (qui n'a que draft/processing/ready/failed).
 *
 * Transitions valides :
 *   queued → preparing → analyzing → processing → rendering → encoding
 *          → checking → completed
 *   (n'importe quel état actif) → failed | cancelled
 *   failed → queued (retry, tant que attempts < maxAttempts)
 */
export const RENDER_JOB_STATUSES = [
  "queued",
  "preparing",
  "analyzing",
  "processing",
  "rendering",
  "encoding",
  "checking",
  "completed",
  "failed",
  "cancelled",
] as const;

export type RenderJobStatus = (typeof RENDER_JOB_STATUSES)[number];

/** Un job est "actif" (occupe une part de capacité) tant qu'il n'est pas terminal. */
export const TERMINAL_JOB_STATUSES: RenderJobStatus[] = ["completed", "failed", "cancelled"];

/** Un job "running" occupe réellement un worker (par opposition à "queued" qui attend). */
export const RUNNING_JOB_STATUSES: RenderJobStatus[] = [
  "preparing",
  "analyzing",
  "processing",
  "rendering",
  "encoding",
  "checking",
];

export function isTerminalStatus(status: RenderJobStatus): boolean {
  return TERMINAL_JOB_STATUSES.includes(status);
}

export function isRunningStatus(status: RenderJobStatus): boolean {
  return RUNNING_JOB_STATUSES.includes(status);
}

/**
 * Priorité : plus le nombre est élevé, plus le job passe devant dans la
 * file. `normal` = 0 par défaut. Permet de faire passer un aperçu rapide
 * devant un export long, ou un client prioritaire (§2, §8).
 */
export type RenderJobPriority = number;
export const PRIORITY_LOW = -10;
export const PRIORITY_NORMAL = 0;
export const PRIORITY_HIGH = 10;
export const PRIORITY_URGENT = 100;

/**
 * Profil de rendu (§10 du brief factory) — arbitrage vitesse/qualité,
 * mappé sur les presets FFmpeg/CRF réels dans le moteur de rendu. BALANCED
 * est le défaut. Ce n'est jamais une simulation : chaque profil change de
 * vrais paramètres d'encodage libx264.
 */
export type RenderProfile = "fast" | "balanced" | "quality";
export const RENDER_PROFILES: RenderProfile[] = ["fast", "balanced", "quality"];

export interface RenderProfileParams {
  /** Preset libx264 pour l'encodage final. */
  finalPreset: string;
  /** CRF de l'encodage final (plus bas = meilleure qualité, plus lent). */
  finalCrf: number;
  /** Preset libx264 pour la découpe des clips intermédiaires. */
  cutPreset: string;
  /** CRF des clips intermédiaires. */
  cutCrf: number;
  /** Concurrence Remotion par défaut si non fixée explicitement (null = auto Remotion). */
  remotionConcurrency: number | null;
}

/**
 * Paramètres RÉELS de chaque profil (branchés dans packages/render).
 * Les valeurs BALANCED reproduisent exactement le comportement existant
 * (preset medium/crf18 final, veryfast/crf20 cut) pour ne rien casser :
 * un projet lancé sans profil garde bit-pour-bit l'ancien rendu.
 */
export const RENDER_PROFILE_PARAMS: Record<RenderProfile, RenderProfileParams> = {
  fast: {
    finalPreset: "veryfast",
    finalCrf: 23,
    cutPreset: "ultrafast",
    cutCrf: 23,
    remotionConcurrency: null,
  },
  balanced: {
    finalPreset: "medium",
    finalCrf: 18,
    cutPreset: "veryfast",
    cutCrf: 20,
    remotionConcurrency: null,
  },
  quality: {
    finalPreset: "slow",
    finalCrf: 16,
    cutPreset: "medium",
    cutCrf: 18,
    remotionConcurrency: null,
  },
};

/**
 * Le job de rendu persistant. Miroir 1:1 de la table `render_queue`
 * (packages/db/schema.sql). Tous les champs demandés au §2 du brief.
 */
export interface RenderJob {
  jobId: string;
  projectId: string;
  priority: RenderJobPriority;
  status: RenderJobStatus;
  profile: RenderProfile;

  /** JSON sérialisé de RunPipelineInput — ce qu'il faut pour (re)lancer le job. */
  payload: string;

  createdAt: string;
  startedAt?: string;
  completedAt?: string;

  /** Progression globale 0-100 (agrégée sur toutes les étapes). */
  progress: number;
  /** Étape courante lisible (label déjà traduit ou nom de stage). */
  currentStage?: string;
  /** Estimation du temps restant en ms (null tant qu'indéterminable). */
  estimatedRemainingMs?: number;

  /** Nombre de tentatives déjà consommées (0 au premier passage). */
  attempts: number;
  maxAttempts: number;

  /** Identifiant du worker qui détient le job (null si en file). */
  workerId?: string;
  /** PID du sous-processus worker, pour pouvoir le tuer (cancel/cleanup). */
  workerPid?: number;
  /** Heartbeat du worker — sert à détecter un worker mort (recovery). */
  heartbeatAt?: string;

  error?: string;
  outputPath?: string;
}

/**
 * Instantané des ressources de la machine, échantillonné par le
 * SystemMonitor (packages/orchestrator). Sert de base à la décision de
 * concurrence adaptative — jamais une valeur codée en dur (§3).
 */
export interface ResourceSnapshot {
  cpuCount: number;
  /** Charge moyenne 1 min normalisée par cœur (0 = idle, 1 = saturé). */
  loadPerCore: number;
  totalMemMb: number;
  freeMemMb: number;
  /** Mémoire réellement disponible (free + cache réclamable) en Mo. */
  availableMemMb: number;
  sampledAt: string;
}

/**
 * Décision de concurrence : combien de workers de rendu peuvent tourner
 * en parallèle MAINTENANT, avec la justification (pour les logs/monitoring
 * — §27 : jamais une erreur ou une limite opaque).
 */
export interface ConcurrencyDecision {
  maxWorkers: number;
  reason: string;
  snapshot: ResourceSnapshot;
  /** Facteur limitant : "cpu" | "memory" | "config" | "floor". */
  limitedBy: "cpu" | "memory" | "config" | "floor";
}

/**
 * Métriques par rendu (§20 du brief factory) — pour comprendre POURQUOI un
 * montage prend 10 minutes. Persistées en base, jamais estimées.
 */
export interface RenderMetrics {
  jobId: string;
  projectId: string;
  renderId: string;
  kind: "proxy" | "final";
  durationTotalMs: number;
  durationCutMs?: number;
  durationConcatMs?: number;
  durationHabillageMs?: number;
  durationEncodeMs?: number;
  framesRendered?: number;
  fps?: number;
  usedRemotion: boolean;
  memoryPeakMb?: number;
  workerId?: string;
  createdAt: string;
}
