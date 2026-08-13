/**
 * Configuration centralisée de la factory (§22, §29 du brief).
 *
 * TOUTE valeur ajustable de la queue/concurrence/rendu passe par ici,
 * lue depuis l'environnement avec un défaut raisonnable. Aucun nombre
 * magique dispersé dans le code : un opérateur règle le comportement sans
 * toucher au code, et un lecteur voit d'un coup d'œil ce qui est
 * configurable.
 *
 * Les défauts sont pensés pour rester STABLES sur une petite machine
 * (Fly shared-cpu, 2 Go) tout en montant en charge sur une grosse — la
 * concurrence réelle est ensuite bornée dynamiquement par le
 * SystemMonitor (voir adaptive-concurrency.ts).
 */

import type { RenderProfile } from "@video-editor/shared-types";
import { RENDER_PROFILES } from "@video-editor/shared-types";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true" || raw.toLowerCase() === "yes";
}

function envProfile(name: string, fallback: RenderProfile): RenderProfile {
  const raw = process.env[name]?.toLowerCase();
  return raw && (RENDER_PROFILES as string[]).includes(raw) ? (raw as RenderProfile) : fallback;
}

function envOptInt(name: string): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export interface FactoryConfig {
  /** Concurrence adaptative active (défaut). Si false, on utilise maxConcurrentJobs tel quel. */
  adaptiveConcurrency: boolean;
  /** Plafond dur de workers simultanés. Même en adaptatif, on ne dépasse jamais ce nombre. */
  maxConcurrentJobs: number;
  /** Cœurs CPU estimés consommés par un worker de rendu (FFmpeg + Chromium). */
  coresPerWorker: number;
  /** Mémoire estimée consommée par un worker de rendu (Mo). */
  memPerWorkerMb: number;
  /** Taille max de la file d'attente (protège d'un afflux illimité). */
  maxQueueSize: number;
  /** Profil de rendu par défaut (vitesse/qualité). */
  renderProfile: RenderProfile;
  /** Concurrence interne de Remotion (frames en parallèle). null = auto Remotion. */
  remotionConcurrency: number | null;
  /** Limite mémoire heap Node passée au worker (--max-old-space-size), null = défaut Node. */
  workerMemoryLimitMb: number | null;
  /** Période de la boucle du scheduler (ms). */
  schedulerIntervalMs: number;
  /** Au-delà de ce délai sans heartbeat, un worker est considéré mort (recovery). */
  heartbeatStaleMs: number;
}

let cached: FactoryConfig | null = null;

/** Lit la config depuis l'environnement (mémoïsée par process). */
export function loadFactoryConfig(): FactoryConfig {
  if (cached) return cached;
  cached = {
    adaptiveConcurrency: envBool("VIDEO_EDITOR_ADAPTIVE_CONCURRENCY", true),
    // Défaut haut (16) : c'est un PLAFOND, la vraie limite vient de l'adaptatif.
    // Sur une petite machine l'adaptatif descendra tout seul à 1.
    maxConcurrentJobs: envInt("VIDEO_EDITOR_MAX_CONCURRENT_JOBS", 16),
    coresPerWorker: Math.max(1, envInt("VIDEO_EDITOR_CORES_PER_WORKER", 2)),
    memPerWorkerMb: Math.max(256, envInt("VIDEO_EDITOR_MEM_PER_WORKER_MB", 1500)),
    maxQueueSize: envInt("MAX_QUEUE_SIZE", 100),
    renderProfile: envProfile("RENDER_PROFILE", "balanced"),
    remotionConcurrency: envOptInt("REMOTION_CONCURRENCY"),
    workerMemoryLimitMb: envOptInt("WORKER_MEMORY_LIMIT_MB"),
    schedulerIntervalMs: Math.max(250, envInt("VIDEO_EDITOR_SCHEDULER_INTERVAL_MS", 1500)),
    heartbeatStaleMs: Math.max(15000, envInt("VIDEO_EDITOR_HEARTBEAT_STALE_MS", 90000)),
  };
  return cached;
}

/** Pour les tests : réinitialise la mémoïsation. */
export function resetFactoryConfigCache(): void {
  cached = null;
}
