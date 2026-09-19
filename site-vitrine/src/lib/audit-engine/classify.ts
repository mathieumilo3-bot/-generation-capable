import { AUTRE_PROFILE, SECTOR_PROFILES } from "./sectors";
import type { SectorProfile } from "./types";

/** Lowercases and strips accents so "Beauté" matches "beaute". */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

/**
 * Maps the free-text secteur declared in the funnel (one of the marketing
 * SECTORS labels, or "Autre — <précision>") to an internal SectorProfile.
 *
 * This is intentionally decoupled from `src/lib/data/sectors.ts` (the
 * marketing pages' 8 sectors): the funnel's picker stays exactly as it is —
 * this file is the only place that needs to know both taxonomies, so adding
 * an engine sector never touches the UI, and reworking the UI never touches
 * the engine.
 */
export function classifySector(declaredSecteur: string): SectorProfile {
  const normalized = normalize(declaredSecteur);
  if (!normalized) return AUTRE_PROFILE;

  let best: { profile: SectorProfile; score: number } | null = null;

  for (const profile of SECTOR_PROFILES) {
    for (const keyword of profile.matches) {
      const normKeyword = normalize(keyword);
      if (normalized.includes(normKeyword)) {
        // Prefer the longest keyword match — "cabinet dentaire" beats a
        // shorter, more generic overlap from another profile.
        const score = normKeyword.length;
        if (!best || score > best.score) best = { profile, score };
      }
    }
  }

  return best?.profile ?? AUTRE_PROFILE;
}
