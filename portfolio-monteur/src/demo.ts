import { Edit, Word } from './lib/edit';

// Montage de démonstration (vidéo de test) pour régler l'habillage sans les vraies sources.
const phrase =
  'Si tu investis 200 euros par mois pendant 20 ans, tu ne deviens pas riche. Tu deviens libre. Et ça, personne ne te l’apprend à l’école.';
const KW: Record<string, 1 | 2> = { '200': 1, euros: 1, '20': 1, riche: 1, 'libre.': 2, personne: 1, 'l’école.': 1 };

const words: Word[] = phrase.split(' ').map((w, i) => ({ w, s: 0.4 + i * 0.36, e: 0.4 + i * 0.36 + 0.32, kw: KW[w] ?? 0 }));

export const demoEdit = (format: '9:16' | '16:9'): Edit => {
  const v = format === '9:16';
  return {
    id: 'demo',
    fps: 30,
    width: v ? 1080 : 1920,
    height: v ? 1920 : 1080,
    duration: 10,
    srcW: 1920,
    srcH: 1080,
    clips: [
      { src: 'test/talk.mp4', srcIn: 0, start: 0, end: 3.2, zoom: 1, keys: [[0, 1], [3.2, 1.06]], track: 'demo' },
      { src: 'test/talk.mp4', srcIn: 3.5, start: 3.2, end: 6.4, zoom: 1.22, punch: true, track: 'demo' },
      { src: 'test/talk.mp4', srcIn: 6.6, start: 6.4, end: 10, zoom: 1.05, track: 'demo' },
    ],
    words,
    broll: [],
    gfx: [
      { type: 'hook', start: 0, end: 2.6, text: 'Pourquoi tu ne seras|*jamais* libre' },
      { type: 'counter', start: 1.1, end: 3.6, value: 200, suffix: ' €', label: 'par mois' },
      { type: 'chart', start: 3.6, end: 6.6, title: '200 € / mois à 8 % par an', values: [0, 2.5, 5.4, 8.6, 12.2, 16.1, 20.5, 25.3, 30.6, 36.4, 42.8, 49.8, 57.5, 66, 75.2, 85.4, 96.5, 108.7, 121.9, 136.4, 152.3].map((x) => x * 1000), labels: ['An 0', 'An 10', 'An 20'], suffix: ' €', compare: Array.from({ length: 21 }, (_, i) => i * 2400), compareLabel: 'sans investir', y: v ? 0.36 : 0.5 },
      { type: 'leak', start: 6.3, end: 7.1 },
      { type: 'icon', start: 7.0, end: 8.6, icon: 'GraduationCap', label: "l'école", x: v ? 0.5 : 0.75, y: v ? 0.3 : 0.4 },
      { type: 'end', start: 8.8, end: 10, title: 'Investis dans ta *liberté*', handle: '@tonyjazz' },
    ],
    tracks: { demo: { fps: 10, t0: 0, cx: Array.from({ length: 101 }, (_, i) => 0.5 + 0.08 * Math.sin(i / 14)), cy: Array.from({ length: 101 }, () => 0.42), fh: Array.from({ length: 101 }, () => 0.35) } },
  };
};
