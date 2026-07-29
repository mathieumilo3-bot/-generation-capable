import type { Mission } from "@gc-ai-os/shared-types";

export interface Batch {
  missions: Mission[];
}

export class CyclicDependencyError extends Error {
  constructor(public readonly remaining: Mission[]) {
    super(
      `Dépendances circulaires détectées entre les missions : ` +
        remaining.map((m) => m.title).join(", "),
    );
    this.name = "CyclicDependencyError";
  }
}

/**
 * Ordonnanceur par vagues (voir docs/gc-ai-os/10-moteur-objectifs.md).
 *
 * Construit les vagues d'exécution parallèle : toutes les missions dont
 * les dépendances sont satisfaites partent ensemble. C'est ce qui rend
 * l'exécution réellement parallèle plutôt que séquentielle déguisée.
 *
 * Un cycle de dépendances lève une erreur explicite au lieu de boucler
 * ou d'ignorer silencieusement des missions — un objectif mal planifié
 * doit se voir, pas se perdre.
 */
export function buildBatches(missions: Mission[]): Batch[] {
  const pending = new Map(missions.map((m) => [m.id, m]));
  const done = new Set<string>();
  const batches: Batch[] = [];

  // Les dépendances vers des missions absentes du lot (déjà terminées
  // lors d'une exécution précédente) ne doivent pas bloquer.
  const known = new Set(missions.map((m) => m.id));

  while (pending.size > 0) {
    const ready = [...pending.values()].filter((mission) =>
      mission.dependsOn.every((dep) => !known.has(dep) || done.has(dep)),
    );

    if (ready.length === 0) {
      throw new CyclicDependencyError([...pending.values()]);
    }

    for (const mission of ready) {
      pending.delete(mission.id);
    }
    for (const mission of ready) {
      done.add(mission.id);
    }

    batches.push({ missions: ready });
  }

  return batches;
}
