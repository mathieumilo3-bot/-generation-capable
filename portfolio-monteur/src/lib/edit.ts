// Format du fichier de montage (public/<id>/edit.json) produit par pipeline/build.py.
// Tous les temps sont en secondes sur la timeline de sortie, sauf srcIn (temps dans la source).

export type ZoomKey = [t: number, zoom: number];

export type Clip = {
  src: string; // chemin relatif à public/
  srcIn: number;
  start: number;
  end: number;
  zoom?: number; // cadrage de base du plan (1 = plan large)
  keys?: ZoomKey[]; // zoom animé, t relatif au début du plan
  punch?: boolean; // petit coup de zoom à l'entrée du plan
  track?: string | null; // clé dans Edit.tracks (suivi du visage)
  w?: number; // dimensions de la source de ce plan (sinon Edit.srcW/srcH)
  h?: number;
  focusY?: number; // hauteur où placer le visage (0..1 de la hauteur de sortie)
};

export type Word = {
  w: string;
  s: number;
  e: number;
  kw?: 0 | 1 | 2; // 1 = mot-clé (couleur), 2 = mot fort (plus gros, italique serif)
  br?: boolean; // force un nouveau bloc de sous-titres après ce mot
};

export type Broll = {
  src: string;
  srcIn: number;
  start: number;
  end: number;
  mode?: 'full' | 'card';
  kb?: [number, number]; // zoom Ken Burns début → fin
};

export type Gfx = { type: string; start: number; end: number } & Record<string, unknown>;

export type Track = { fps: number; t0: number; cx: number[]; cy: number[]; fh: number[] };

export type Edit = {
  id: string;
  fps: number;
  width: number;
  height: number;
  duration: number;
  srcW: number;
  srcH: number;
  clips: Clip[];
  words: Word[];
  broll: Broll[];
  gfx: Gfx[];
  tracks: Record<string, Track>;
  audio?: string;
  raw?: { src: string; srcIn: number; duration: number }; // rush brut (avant/après)
  theme?: Partial<Theme>;
  meta?: Record<string, unknown>;
};

export type Theme = {
  accent: string;
  accent2: string;
  text: string;
  shadow: string;
  captionFont: string;
  captionWeight: number;
  captionSize: number;
  captionY: number; // centre vertical des sous-titres (0..1)
  upper: boolean;
};

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export const sampleTrack = (tr: Track | undefined, t: number) => {
  if (!tr || tr.cx.length === 0) return { cx: 0.5, cy: 0.42, fh: 0.3 };
  const p = clamp((t - tr.t0) * tr.fps, 0, tr.cx.length - 1);
  const i = Math.floor(p);
  const j = Math.min(i + 1, tr.cx.length - 1);
  const k = p - i;
  const lerp = (a: number[]) => a[i] + (a[j] - a[i]) * k;
  return { cx: lerp(tr.cx), cy: lerp(tr.cy), fh: lerp(tr.fh) };
};

// zoom interpolé entre clés, avec un easing doux (pas de cassure de vitesse)
export const zoomAt = (clip: Clip, t: number) => {
  const base = clip.zoom ?? 1;
  const keys = clip.keys;
  if (!keys || keys.length === 0) return base;
  if (t <= keys[0][0]) return keys[0][1];
  for (let n = 0; n < keys.length - 1; n++) {
    const [t0, z0] = keys[n];
    const [t1, z1] = keys[n + 1];
    if (t <= t1) {
      const u = (t - t0) / Math.max(1e-6, t1 - t0);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      return z0 + (z1 - z0) * e;
    }
  }
  return keys[keys.length - 1][1];
};
