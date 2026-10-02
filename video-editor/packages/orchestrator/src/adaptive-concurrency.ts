/**
 * Concurrence adaptative (§3 du brief factory).
 *
 * On ne met JAMAIS un `MAX_CONCURRENT_JOBS=10` en dur. La capacité est
 * calculée à partir des ressources réelles : combien de workers de rendu
 * (chacun ≈ coresPerWorker cœurs + memPerWorkerMb Mo) la machine peut
 * soutenir SANS se saturer. Le facteur limitant (CPU, RAM ou plafond
 * config) est renvoyé pour les logs — jamais une limite opaque (§27).
 *
 * Exemples avec les défauts (2 cœurs / 1500 Mo par worker) :
 *   - petite (Fly shared-cpu-2x, 2 Go, ~2 cœurs) → 1 worker
 *   - moyenne (4 cœurs, 8 Go)                     → 2 workers
 *   - grosse (8 cœurs, 16 Go)                     → 4 workers
 *
 * La stabilité prime toujours sur la concurrence (§3, §29) : plancher à 1,
 * on ne descend jamais à 0 (sinon plus rien ne se rendrait).
 */

import type { ConcurrencyDecision, ResourceSnapshot } from "@video-editor/shared-types";
import type { FactoryConfig } from "./config.js";
import { sampleResources } from "./system-monitor.js";

export function decideConcurrency(config: FactoryConfig, snapshot?: ResourceSnapshot): ConcurrencyDecision {
  const snap = snapshot ?? sampleResources();

  if (!config.adaptiveConcurrency) {
    return {
      maxWorkers: Math.max(1, config.maxConcurrentJobs),
      reason: `Concurrence adaptative désactivée — plafond fixe ${config.maxConcurrentJobs}`,
      snapshot: snap,
      limitedBy: "config",
    };
  }

  const cpuCapacity = Math.max(1, Math.floor(snap.cpuCount / config.coresPerWorker));
  const memCapacity = Math.max(1, Math.floor(snap.availableMemMb / config.memPerWorkerMb));

  // Le facteur le plus contraignant gagne — puis on plafonne à la config.
  let maxWorkers = Math.min(cpuCapacity, memCapacity, config.maxConcurrentJobs);
  maxWorkers = Math.max(1, maxWorkers);

  let limitedBy: ConcurrencyDecision["limitedBy"];
  if (maxWorkers === config.maxConcurrentJobs && config.maxConcurrentJobs <= Math.min(cpuCapacity, memCapacity)) {
    limitedBy = "config";
  } else if (memCapacity <= cpuCapacity) {
    limitedBy = "memory";
  } else {
    limitedBy = "cpu";
  }
  if (maxWorkers === 1 && Math.min(cpuCapacity, memCapacity) === 1) limitedBy = "floor";

  const reason =
    `${maxWorkers} worker(s) — CPU:${snap.cpuCount}c→${cpuCapacity} · ` +
    `RAM:${snap.availableMemMb}Mo→${memCapacity} · plafond:${config.maxConcurrentJobs} · ` +
    `limité par ${limitedBy} (charge/cœur ${(snap.loadPerCore * 100).toFixed(0)}%)`;

  return { maxWorkers, reason, snapshot: snap, limitedBy };
}
