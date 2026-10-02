/**
 * SystemMonitor : échantillonne les ressources réelles de la machine
 * (§3, §20 du brief). Aucune valeur inventée — tout vient de `os` et, sur
 * Linux, de /proc/meminfo pour une mémoire disponible fiable (free +
 * cache réclamable, ce que `os.freemem()` seul sous-estime).
 */

import os from "node:os";
import { readFileSync } from "node:fs";
import type { ResourceSnapshot } from "@video-editor/shared-types";

/**
 * Mémoire réellement allouable en Mo. Sous Linux, MemAvailable (noyau ≥
 * 3.14) est la bonne mesure : elle inclut le cache page récupérable, alors
 * que MemFree l'exclut et fait paraître la machine bien plus chargée
 * qu'elle ne l'est. Repli sur os.freemem() ailleurs.
 */
function readAvailableMemMb(): number {
  try {
    const meminfo = readFileSync("/proc/meminfo", "utf-8");
    const match = /MemAvailable:\s+(\d+)\s+kB/.exec(meminfo);
    if (match) return Math.round(Number.parseInt(match[1]!, 10) / 1024);
  } catch {
    // pas Linux ou /proc indisponible — repli ci-dessous
  }
  return Math.round(os.freemem() / (1024 * 1024));
}

export function sampleResources(): ResourceSnapshot {
  const cpuCount = os.cpus().length || 1;
  // loadavg 1 min ; sur certains conteneurs il vaut 0 (pas de compteur) —
  // dans ce cas on considère la machine idle, ce qui est le comportement sûr.
  const load1 = os.loadavg()[0] ?? 0;
  const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
  const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
  const availableMemMb = readAvailableMemMb();
  return {
    cpuCount,
    loadPerCore: cpuCount > 0 ? load1 / cpuCount : 0,
    totalMemMb,
    freeMemMb,
    availableMemMb,
    sampledAt: new Date().toISOString(),
  };
}
