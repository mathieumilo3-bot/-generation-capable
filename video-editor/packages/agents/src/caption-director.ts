import type { CaptionCue, EditBlueprint, Segment, StyleProfile } from "@video-editor/shared-types";
import { newId } from "@video-editor/shared-types";

const MAX_WORDS_PER_CUE = 6;
const MAX_CUE_DURATION_SEC = 2.5;

/**
 * Agent 06 — Caption Director. Déterministe par conception (§22 du
 * brief) : le découpage et le timing des sous-titres sont une fonction
 * mécanique des timestamps mot-à-mot, pas une décision créative qui
 * bénéficierait d'un LLM.
 *
 * Approximation MVP assumée : le Segment (packages/shared-types) ne
 * conserve que le transcript agrégé, pas les timestamps mot-à-mot
 * individuels renvoyés par le STT (packages/agents/src/video-analyzer.ts
 * les a, mais ils ne sont pas encore propagés jusqu'ici). Les mots sont
 * donc répartis uniformément sur la durée du segment source, ce qui reste
 * correct au niveau du plan (les bornes du clip sont réelles) mais
 * approxime le timing intra-segment. Propager les vrais timestamps mot à
 * mot est le prochain raffinement naturel (voir README).
 */
export function runCaptionDirector(
  editBlueprint: EditBlueprint,
  segmentsById: Map<string, Segment>,
  styleProfile: StyleProfile
): EditBlueprint {
  const captions: CaptionCue[] = [];
  const emphasisStep = styleProfile.captionEmphasis > 0 ? Math.max(2, Math.round(1 / styleProfile.captionEmphasis)) : Infinity;
  let globalWordIndex = 0;

  for (const clip of editBlueprint.clips) {
    const segment = segmentsById.get(clip.segmentId);
    const words = segment?.transcript.split(/\s+/).filter(Boolean) ?? [];
    if (words.length === 0) continue;

    const segDuration = segment!.end - segment!.start;
    const perWordDuration = segDuration / words.length;
    const clipWords: { word: string; start: number; end: number }[] = [];
    for (let i = 0; i < words.length; i++) {
      const sourceStart = segment!.start + i * perWordDuration;
      const sourceEnd = sourceStart + perWordDuration;
      if (sourceEnd < clip.sourceStart || sourceStart > clip.sourceEnd) continue;
      const offset = clip.timelineStart - clip.sourceStart;
      clipWords.push({ word: words[i]!, start: sourceStart + offset, end: sourceEnd + offset });
    }

    let cueWords: { word: string; start: number; end: number }[] = [];
    const flushCue = () => {
      if (cueWords.length === 0) return;
      captions.push({
        id: newId("cap"),
        timelineStart: cueWords[0]!.start,
        timelineEnd: cueWords[cueWords.length - 1]!.end,
        text: cueWords.map((w) => w.word).join(" "),
        words: cueWords.map((w) => {
          globalWordIndex++;
          const emphasize = w.word.length > 6 || globalWordIndex % emphasisStep === 0;
          return { word: w.word, start: w.start, end: w.end, emphasize };
        }),
      });
      cueWords = [];
    };

    for (const w of clipWords) {
      const wouldSpan = cueWords.length > 0 && w.end - cueWords[0]!.start > MAX_CUE_DURATION_SEC;
      if (cueWords.length >= MAX_WORDS_PER_CUE || wouldSpan) flushCue();
      cueWords.push(w);
    }
    flushCue();
  }

  return { ...editBlueprint, captions };
}
