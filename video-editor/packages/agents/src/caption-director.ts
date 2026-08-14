import type { CaptionCue, EditBlueprint, Segment, StyleProfile } from "@video-editor/shared-types";
import { newId } from "@video-editor/shared-types";

const MAX_WORDS_PER_CUE = 6;
const MAX_CUE_DURATION_SEC = 2.5;

interface WordTiming {
  word: string;
  start: number;
  end: number;
}

/**
 * Agent 06 — Caption Director. Déterministe par conception (§22 du
 * brief) : le découpage et le timing des sous-titres sont une fonction
 * mécanique des timestamps mot-à-mot, pas une décision créative.
 *
 * Deux chemins, sans jamais inventer de texte :
 *  1. STT présent → on utilise les VRAIS timestamps mot-à-mot (Deepgram),
 *     propagés via `transcriptsByRush` : chaque mot apparaît exactement
 *     quand il est prononcé (sous-titres karaoké réellement synchronisés).
 *  2. Pas de STT → repli : les mots du transcript agrégé du segment sont
 *     répartis uniformément sur sa durée (approximation honnête, bornée
 *     par les vraies bornes du clip). Sans transcript, aucun sous-titre.
 */
export function runCaptionDirector(
  editBlueprint: EditBlueprint,
  segmentsById: Map<string, Segment>,
  styleProfile: StyleProfile,
  transcriptsByRush?: Map<string, { words: WordTiming[] }>
): EditBlueprint {
  const captions: CaptionCue[] = [];
  const emphasisStep = styleProfile.captionEmphasis > 0 ? Math.max(2, Math.round(1 / styleProfile.captionEmphasis)) : Infinity;
  let globalWordIndex = 0;

  for (const clip of editBlueprint.clips) {
    const segment = segmentsById.get(clip.segmentId);
    if (!segment) continue;
    const offset = clip.timelineStart - clip.sourceStart;

    // Chemin 1 : vrais timestamps mot-à-mot du STT, si disponibles pour ce rush.
    const rushWords = transcriptsByRush?.get(clip.rushId)?.words ?? [];
    let clipWords: WordTiming[] = [];

    const spokenInClip = rushWords.filter((w) => w.end > clip.sourceStart && w.start < clip.sourceEnd);
    if (spokenInClip.length > 0) {
      clipWords = spokenInClip.map((w) => ({
        word: w.word,
        // Clamp aux bornes réelles du clip, puis mappe source → timeline.
        start: Math.max(clip.sourceStart, w.start) + offset,
        end: Math.min(clip.sourceEnd, w.end) + offset,
      }));
    } else {
      // Chemin 2 : repli — répartition uniforme depuis le transcript agrégé.
      const words = segment.transcript.split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;
      const segDuration = segment.end - segment.start;
      const perWordDuration = segDuration / words.length;
      for (let i = 0; i < words.length; i++) {
        const sourceStart = segment.start + i * perWordDuration;
        const sourceEnd = sourceStart + perWordDuration;
        if (sourceEnd < clip.sourceStart || sourceStart > clip.sourceEnd) continue;
        clipWords.push({ word: words[i]!, start: sourceStart + offset, end: sourceEnd + offset });
      }
    }

    // Regroupement en cues lisibles (identique dans les deux chemins).
    let cueWords: WordTiming[] = [];
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
