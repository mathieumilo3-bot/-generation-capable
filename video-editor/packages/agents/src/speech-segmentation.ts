/**
 * Découpage d'un rush PARLÉ en phrases, à partir des timestamps mot-à-mot
 * du STT. C'est l'unité de montage d'une vidéo face caméra : on retire les
 * blancs et les prises ratées, mais on ne coupe JAMAIS une phrase au milieu
 * (un mot tronqué ou une idée amputée se remarque immédiatement).
 *
 * Fonctions pures, déterministes, sans dépendance : testables isolément.
 */

export interface TimedWord {
  word: string;
  start: number;
  end: number;
}

export interface SpeechPhrase {
  start: number;
  end: number;
  words: TimedWord[];
  text: string;
}

export interface PhraseOptions {
  /** Blanc entre deux mots au-delà duquel on change de phrase. */
  gapSec: number;
  /** Blanc suffisant après une ponctuation finale (. ! ?). */
  sentenceGapSec: number;
  /** Longueur maximale d'une phrase avant découpe à une frontière de mot. */
  maxSec: number;
  /** Marge conservée avant le premier mot / après le dernier (attaque et fin de souffle). */
  padBeforeSec: number;
  padAfterSec: number;
}

export const DEFAULT_PHRASE_OPTIONS: PhraseOptions = {
  gapSec: 0.35,
  sentenceGapSec: 0.12,
  maxSec: 9,
  padBeforeSec: 0.1,
  padAfterSec: 0.15,
};

const SENTENCE_END = /[.!?…]["»”)]*$/;

export function speechPhrases(words: TimedWord[], durationSec: number, opts: PhraseOptions = DEFAULT_PHRASE_OPTIONS): SpeechPhrase[] {
  const sorted = words.filter((w) => w.word.trim() && w.end > w.start).sort((a, b) => a.start - b.start);
  const groups: TimedWord[][] = [];
  let cur: TimedWord[] = [];
  for (const w of sorted) {
    const last = cur[cur.length - 1];
    if (last) {
      const gap = w.start - last.end;
      const sentenceBreak = SENTENCE_END.test(last.word) && gap >= opts.sentenceGapSec;
      const tooLong = w.end - cur[0]!.start > opts.maxSec;
      if (gap >= opts.gapSec || sentenceBreak || tooLong) {
        groups.push(cur);
        cur = [];
      }
    }
    cur.push(w);
  }
  if (cur.length) groups.push(cur);

  const phrases = groups.map((g) => ({
    start: Math.max(0, g[0]!.start - opts.padBeforeSec),
    end: Math.min(durationSec, g[g.length - 1]!.end + opts.padAfterSec),
    words: g,
    text: g.map((w) => w.word).join(" "),
  }));
  // Les marges ne doivent pas se chevaucher : on partage le blanc au milieu.
  for (let i = 1; i < phrases.length; i++) {
    const prev = phrases[i - 1]!;
    const p = phrases[i]!;
    if (p.start < prev.end) {
      const mid = (prev.words[prev.words.length - 1]!.end + p.words[0]!.start) / 2;
      prev.end = mid;
      p.start = mid;
    }
  }
  return phrases;
}

export function normalizeWord(w: string): string {
  return w.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Prises ratées : quand l'orateur recommence une phrase, la tentative
 * précédente commence par les mêmes mots. On garde la DERNIÈRE prise
 * (celle qui va au bout) et on renvoie les indices des précédentes.
 */
export function findRetakes(phrases: SpeechPhrase[], lookahead = 2): Set<number> {
  const retakes = new Set<number>();
  const norm = phrases.map((p) => p.words.map((w) => normalizeWord(w.word)).filter(Boolean));
  for (let i = 0; i < phrases.length; i++) {
    const a = norm[i]!;
    if (a.length < 2) continue;
    // Une phrase menée à son terme (ponctuation finale) n'est pas une prise
    // ratée — « Et en plus c'est rapide. Et en plus c'est gratuit. » est voulu —
    // sauf si elle est entièrement reprise au début de la suivante.
    const completed = SENTENCE_END.test(phrases[i]!.text.trim());
    for (let j = i + 1; j <= Math.min(phrases.length - 1, i + lookahead); j++) {
      const b = norm[j]!;
      const k = Math.min(4, a.length);
      if (b.length < k || a.length > b.length + 2) continue;
      const fullPrefix = a.length < b.length && a.every((w, idx) => w === b[idx]);
      if (completed && !fullPrefix) continue;
      if (a.slice(0, k).every((w, idx) => w === b[idx])) {
        retakes.add(i);
        break;
      }
    }
  }
  return retakes;
}
