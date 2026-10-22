import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { EffectSpec } from "@video-editor/shared-types";

/**
 * Habillage par FFmpeg — tous les effets + sous-titres en single-pass,
 * évitant le re-encode Remotion. C'est le chemin par défaut et universel.
 *
 * Stratégie : FFmpeg gère tous les effets de picture et les sous-titres.
 * Remotion en repli uniquement si FFmpeg échoue.
 *
 * Règle commune à tous les effets : chacun est borné à sa fenêtre
 * [startSec, endSec[ (option `enable` ou expression évaluée par image).
 * Hors fenêtre, l'image source passe intacte — un effet de 0,3 s ne doit
 * jamais toucher le reste de la vidéo.
 */

export type FfmpegCaptionStyle = "bold_dynamic" | "minimal_clean" | "karaoke_word" | "classic_lowerthird";

export interface CaptionWordSpec {
  word: string;
  startSec: number;
  endSec: number;
  emphasize?: boolean;
}

export interface CaptionSpec {
  startSec: number;
  endSec: number;
  text: string;
  /** Timestamps mot-à-mot (temps timeline). Sans eux, la cue s'affiche d'un bloc. */
  words?: CaptionWordSpec[];
}

export interface FfmpegHabillageSpec {
  inputPath: string;
  outputPath: string;
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  effects?: EffectSpec[];
  captions?: CaptionSpec[];
  captionStyle?: FfmpegCaptionStyle;
  /** Dossier où écrire le fichier .ass des sous-titres. Défaut : dossier de outputPath. */
  workDir?: string;
  preset?: string;
  crf?: number;
  onProgress?: (p: { frames: number; fps: number; speed: string }) => void;
}

export interface EffectsGraph {
  filters: string[];
  /** Effets ignorés parce que le chemin FFmpeg ne sait pas les rendre proprement. */
  unsupported: string[];
}

/** Arrondi stable pour les expressions (évite 0.30000000000000004 dans le graphe). */
function n(v: number): string {
  return String(Math.round(v * 1e4) / 1e4);
}

/** Fenêtre demi-ouverte [a, b[ : deux fenêtres adjacentes ne se chevauchent jamais sur l'image frontière. */
function win(a: number, b: number): string {
  return `gte(t,${n(a)})*lt(t,${n(b)})`;
}

function windowsExpr(windows: [number, number][]): string {
  return windows.map(([a, b]) => win(a, b)).join("+");
}

/** Interpolation adoucie (smoothstep) entre deux keyframes. */
function easeSegment(t0: number, v0: number, t1: number, v1: number): string {
  const dt = t1 - t0;
  if (dt <= 0 || v0 === v1) return n(v0);
  const p = `((t-${n(t0)})/${n(dt)})`;
  return `(${n(v0)}+${n(v1 - v0)}*${p}*${p}*(3-2*${p}))`;
}

interface Keyframe {
  atSec: number;
  value: number;
}

/**
 * Courbe par morceaux sur [startSec, endSec[ : valeur du premier keyframe
 * avant lui, interpolation adoucie entre keyframes, valeur du dernier après.
 * Renvoie l'écart à `rest` (0 hors fenêtre) pour pouvoir sommer les fenêtres.
 */
function windowCurveDelta(startSec: number, endSec: number, kfs: Keyframe[], rest: number): string {
  const sorted = [...kfs].sort((a, b) => a.atSec - b.atSec);
  if (sorted.length === 0 || endSec <= startSec) return "";
  const parts: string[] = [];
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  if (first.atSec > startSec) parts.push(`${win(startSec, first.atSec)}*${n(first.value - rest)}`);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (b.atSec <= a.atSec) continue;
    parts.push(`${win(a.atSec, b.atSec)}*(${easeSegment(a.atSec, a.value, b.atSec, b.value)}-${n(rest)})`);
  }
  if (last.atSec < endSec) parts.push(`${win(Math.max(startSec, last.atSec), endSec)}*${n(last.value - rest)}`);
  return parts.join("+");
}

/**
 * Zoom + tremblement en une seule étape géométrique : scale évalué image
 * par image (même ratio que la source), puis crop fixe à la taille cible.
 * La sortie garde donc toujours exactement width×height.
 */
function buildTransformFilter(effects: EffectSpec[], width: number, height: number): string {
  const zoomTerms: string[] = [];
  const focusXTerms: string[] = [];
  const focusYTerms: string[] = [];
  const shakeX: string[] = [];
  const shakeY: string[] = [];

  for (const e of effects) {
    if (e.type === "zoom") {
      const kfs = (e.keyframes ?? []).map((k) => ({ atSec: k.atSec, value: Math.max(1, k.scale) }));
      if (kfs.length === 0) continue;
      // Un seul keyframe = punch-in : on tient l'échelle et on ajoute une
      // poussée lente (+3 %) pour que le plan ne soit jamais figé.
      if (kfs.length === 1) {
        const s = kfs[0]!.value;
        kfs[0] = { atSec: e.startSec, value: s };
        kfs.push({ atSec: e.endSec, value: s * 1.03 });
      }
      const d = windowCurveDelta(e.startSec, e.endSec, kfs, 1);
      if (d) zoomTerms.push(d);
      const k0 = e.keyframes[0]!;
      const fx = Math.min(1, Math.max(0, k0.focusX ?? 0.5));
      const fy = Math.min(1, Math.max(0, k0.focusY ?? 0.5));
      if (fx !== 0.5) focusXTerms.push(`${win(e.startSec, e.endSec)}*${n(fx - 0.5)}`);
      if (fy !== 0.5) focusYTerms.push(`${win(e.startSec, e.endSec)}*${n(fy - 0.5)}`);
    } else if (e.type === "shake") {
      const amp = Math.max(0, e.intensity ?? 2) * 4; // px
      if (amp <= 0) continue;
      const f = e.frequency ?? 8;
      const w = win(e.startSec, e.endSec);
      // Marge de zoom juste suffisante pour que le décalage ne montre jamais de bord.
      zoomTerms.push(`${w}*${n((2.2 * amp) / Math.min(width, height))}`);
      shakeX.push(`${w}*${n(amp)}*sin(${n(2 * Math.PI * f)}*t)`);
      shakeY.push(`${w}*${n(amp * 0.7)}*cos(${n(2 * Math.PI * f * 1.3)}*t)`);
    }
  }

  if (zoomTerms.length === 0) return "";
  const z = `(1+${zoomTerms.join("+")})`;
  const fx = focusXTerms.length ? `(0.5+${focusXTerms.join("+")})` : "0.5";
  const fy = focusYTerms.length ? `(0.5+${focusYTerms.join("+")})` : "0.5";
  const dx = shakeX.length ? `+${shakeX.join("+")}` : "";
  const dy = shakeY.length ? `+${shakeY.join("+")}` : "";
  return (
    `scale=w='max(${width},trunc(iw*${z}/2)*2)':h='max(${height},trunc(ih*${z}/2)*2)':eval=frame:flags=bicubic,` +
    `crop=w=${width}:h=${height}:` +
    `x='clip((iw-${width})*${fx}${dx},0,iw-${width})':` +
    `y='clip((ih-${height})*${fy}${dy},0,ih-${height})'`
  );
}

/** Regroupe les fenêtres d'effets identiques en un seul filtre (enable = union des fenêtres). */
function groupWindows<T extends { startSec: number; endSec: number }>(
  items: T[],
  key: (i: T) => string
): Map<string, { sample: T; windows: [number, number][] }> {
  const groups = new Map<string, { sample: T; windows: [number, number][] }>();
  for (const it of items) {
    if (!(it.endSec > it.startSec)) continue;
    const k = key(it);
    const g = groups.get(k) ?? { sample: it, windows: [] };
    g.windows.push([it.startSec, it.endSec]);
    groups.set(k, g);
  }
  return groups;
}

type Of<K extends EffectSpec["type"]> = Extract<EffectSpec, { type: K }>;

function buildColorGradeFilters(effects: Of<"color_grade">[]): string[] {
  const groups = groupWindows(effects, (e) => `${n(e.saturation ?? 1)}|${n(e.brightness ?? 0)}`);
  const out: string[] = [];
  for (const { sample, windows } of groups.values()) {
    // eq.saturation accepte 0..3 ; le schéma autorise -1..2 → on borne.
    const sat = Math.min(3, Math.max(0, sample.saturation ?? 1));
    const bri = Math.min(1, Math.max(-1, sample.brightness ?? 0));
    if (sat === 1 && bri === 0) continue;
    out.push(`eq=saturation=${n(sat)}:brightness=${n(bri)}:enable='${windowsExpr(windows)}'`);
  }
  return out;
}

function buildBlurFilters(effects: Of<"blur">[]): string[] {
  const groups = groupWindows(effects, (e) => n(e.radius ?? 5));
  const out: string[] = [];
  for (const { sample, windows } of groups.values()) {
    const radius = Math.min(50, Math.max(0, sample.radius ?? 5));
    if (radius <= 0) continue;
    out.push(`gblur=sigma=${n(radius)}:enable='${windowsExpr(windows)}'`);
  }
  return out;
}

function buildVignetteFilters(effects: Of<"vignette">[]): string[] {
  const groups = groupWindows(effects, (e) => n(e.intensity ?? 0.5));
  const out: string[] = [];
  for (const { sample, windows } of groups.values()) {
    const intensity = Math.min(1, Math.max(0, sample.intensity ?? 0.5));
    if (intensity <= 0) continue;
    // angle (rad) pilote la force : PI/5 ≈ 0.63 est le défaut ffmpeg.
    const angle = 0.25 + intensity * 0.5;
    out.push(`vignette=angle=${n(angle)}:mode=forward:enable='${windowsExpr(windows)}'`);
  }
  return out;
}

/** Flash blanc qui décroît linéairement sur durationSec. */
function buildFlashFilter(e: Of<"flash">): string {
  const s = e.startSec;
  const d = e.durationSec ?? 0.1;
  const k = `${n(Math.min(1, Math.max(0, e.intensity ?? 0.8)))}*(1-(t-${n(s)})/${n(d)})`;
  return `eq=eval=frame:brightness='${k}':saturation='1-${k}':enable='${win(s, s + d)}'`;
}

/** Fondu au noir puis retour (triangle 0 → 1 → 0) sur durationSec. */
function buildDipToBlackFilter(e: Of<"dip_to_black">): string {
  const s = e.startSec;
  const d = e.durationSec ?? 0.3;
  const k = `(1-abs(2*(t-${n(s)})/${n(d)}-1))`;
  return `eq=eval=frame:brightness='-${k}':saturation='1-${k}':enable='${win(s, s + d)}'`;
}

/**
 * Construit la chaîne de filtres des effets vidéo, dans un ordre fixe :
 * géométrie → étalonnage → flou → vignette → flash/fondu. Les
 * sous-titres viennent après, pour ne jamais être zoomés ni floutés.
 */
export function buildEffectsFilterGraph(effects: EffectSpec[], width: number, height: number): EffectsGraph {
  const filters: string[] = [];
  const unsupported: string[] = [];
  if (!effects || effects.length === 0) return { filters, unsupported };

  const of = <K extends EffectSpec["type"]>(type: K) => effects.filter((e): e is Of<K> => e.type === type);

  const transform = buildTransformFilter(effects, width, height);
  if (transform) filters.push(transform);
  filters.push(...buildColorGradeFilters(of("color_grade")));
  filters.push(...buildBlurFilters(of("blur")));
  filters.push(...buildVignetteFilters(of("vignette")));
  for (const e of of("flash")) filters.push(buildFlashFilter(e));
  for (const e of of("dip_to_black")) filters.push(buildDipToBlackFilter(e));

  // speed_ramp change la durée de la vidéo (désynchronise l'audio copié) et
  // slide exige un fond de remplissage : ni l'un ni l'autre n'est rendu ici.
  for (const e of effects) {
    if (e.type === "speed_ramp" || e.type === "slide") unsupported.push(e.type);
  }
  return { filters, unsupported };
}

// ─── Sous-titres ASS (libass) ────────────────────────────────────────────

/** Couleur ASS &HAABBGGRR depuis #RRGGBB. */
function assColor(hex: string, alpha = 0): string {
  const h = hex.replace("#", "");
  const a = alpha.toString(16).padStart(2, "0").toUpperCase();
  return `&H${a}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase();
}

/** Couleur pour une balise de surcharge (\\c) : &HBBGGRR&. */
function assTagColor(hex: string): string {
  const h = hex.replace("#", "").toUpperCase();
  return `&H${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`;
}

function assTime(sec: number): string {
  const cs = Math.max(0, Math.round(sec * 100));
  const h = Math.floor(cs / 360000);
  const m = Math.floor((cs % 360000) / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
}

/** Le texte vient du STT : on neutralise tout ce que libass interpréterait comme balise. */
function assText(s: string): string {
  return s.replace(/[{}]/g, "").replace(/\\/g, "/").replace(/\s+/g, " ").trim();
}

const ACCENT = "#FFD23F";

interface StyleDef {
  font: string;
  sizeRatio: number;
  outline: number;
  shadow: number;
  boxed: boolean;
  uppercase: boolean;
  maxWords: number;
  maxChars: number;
  /** Mot en cours mis en valeur (couleur + pop). */
  highlightActive: boolean;
  /** Mots pas encore prononcés atténués. */
  dimUpcoming: boolean;
}

const STYLES: Record<FfmpegCaptionStyle, StyleDef> = {
  bold_dynamic: { font: "Inter Black", sizeRatio: 0.09, outline: 6, shadow: 3, boxed: false, uppercase: true, maxWords: 3, maxChars: 18, highlightActive: true, dimUpcoming: false },
  karaoke_word: { font: "Inter Black", sizeRatio: 0.08, outline: 5, shadow: 2, boxed: false, uppercase: false, maxWords: 4, maxChars: 22, highlightActive: true, dimUpcoming: true },
  minimal_clean: { font: "Inter SemiBold", sizeRatio: 0.058, outline: 3, shadow: 2, boxed: false, uppercase: false, maxWords: 6, maxChars: 32, highlightActive: false, dimUpcoming: false },
  classic_lowerthird: { font: "Inter SemiBold", sizeRatio: 0.046, outline: 12, shadow: 0, boxed: true, uppercase: false, maxWords: 7, maxChars: 38, highlightActive: false, dimUpcoming: false },
};

interface Chunk {
  start: number;
  end: number;
  words: CaptionWordSpec[];
}

/** Recoupe les cues en groupes courts (lisibles d'un coup d'œil sur mobile). */
function chunkCaptions(captions: CaptionSpec[], st: StyleDef): Chunk[] {
  const chunks: Chunk[] = [];
  for (const c of captions) {
    const words: CaptionWordSpec[] =
      c.words && c.words.length > 0
        ? c.words.filter((w) => w.word.trim() && w.endSec > w.startSec)
        : [{ word: c.text, startSec: c.startSec, endSec: c.endSec }];
    let cur: CaptionWordSpec[] = [];
    const flush = () => {
      if (cur.length) chunks.push({ start: cur[0]!.startSec, end: cur[cur.length - 1]!.endSec, words: cur });
      cur = [];
    };
    for (const w of words) {
      const chars = cur.reduce((s, x) => s + x.word.length + 1, 0) + w.word.length;
      if (cur.length >= st.maxWords || (cur.length > 0 && chars > st.maxChars)) flush();
      cur.push(w);
    }
    flush();
  }
  chunks.sort((a, b) => a.start - b.start);
  // Tenir chaque groupe jusqu'au suivant (max +0,35 s) : évite le clignotement entre deux mots.
  for (let i = 0; i < chunks.length; i++) {
    const next = chunks[i + 1];
    const hold = chunks[i]!.end + 0.35;
    chunks[i]!.end = next ? Math.max(chunks[i]!.end, Math.min(hold, next.start)) : hold;
    if (next && chunks[i]!.end > next.start) chunks[i]!.end = next.start;
  }
  return chunks.filter((c) => c.end - c.start >= 0.04);
}

/**
 * Génère un script ASS : un événement par mot actif (le groupe entier est
 * affiché, le mot prononcé est surligné), positionné dans la zone sûre des
 * Reels/TikTok (au-dessus de la barre d'interface du bas).
 */
export function buildAssSubtitles(
  captions: CaptionSpec[],
  width: number,
  height: number,
  style: FfmpegCaptionStyle = "bold_dynamic"
): string {
  const st = STYLES[style] ?? STYLES.bold_dynamic;
  const short = Math.min(width, height);
  const size = Math.round(short * st.sizeRatio);
  const vertical = height > width;
  const marginV = Math.round(height * (vertical ? 0.27 : 0.1));
  const marginH = Math.round(width * 0.07);
  const outlineColor = st.boxed ? assColor("#000000", 0x60) : assColor("#000000");
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 0",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Cap,${st.font},${size},${assColor("#FFFFFF")},${assColor("#FFFFFF")},${outlineColor},${assColor("#000000", 0x80)},0,0,0,0,100,100,0,0,${st.boxed ? 3 : 1},${st.outline},${st.shadow},2,${marginH},${marginH},${marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];

  const accent = assTagColor(ACCENT);
  const fmt = (w: string) => assText(st.uppercase ? w.toLocaleUpperCase("fr-FR") : w);
  const lines: string[] = [];
  const dialogue = (a: number, b: number, text: string) => {
    if (b - a >= 0.02) lines.push(`Dialogue: 0,${assTime(a)},${assTime(b)},Cap,,0,0,0,,${text}`);
  };

  for (const chunk of chunkCaptions(captions, st)) {
    if (!st.highlightActive) {
      const text = chunk.words.map((w) => (w.emphasize ? `{\\c${accent}}${fmt(w.word)}{\\r}` : fmt(w.word))).join(" ");
      dialogue(chunk.start, chunk.end, text);
      continue;
    }
    chunk.words.forEach((active, i) => {
      const a = i === 0 ? chunk.start : active.startSec;
      const b = i === chunk.words.length - 1 ? chunk.end : chunk.words[i + 1]!.startSec;
      const pop = active.emphasize ? 122 : 112;
      const text = chunk.words
        .map((w, j) => {
          const t = fmt(w.word);
          if (j === i) return `{\\c${accent}\\fscx100\\fscy100\\t(0,80,\\fscx${pop}\\fscy${pop})}${t}{\\r}`;
          if (j > i && st.dimUpcoming) return `{\\1a&H70&}${t}{\\r}`;
          return t;
        })
        .join(" ");
      dialogue(a, b, text);
    });
  }
  return [...header, ...lines, ""].join("\n");
}

/** Polices embarquées (Inter, licence OFL) : le rendu ne dépend pas des polices du système hôte. */
export function bundledFontsDir(): string | null {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const p of [join(here, "..", "assets", "fonts"), join(here, "..", "..", "assets", "fonts")]) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Échappe un chemin pour une valeur d'option de filtre : ffmpeg dé-échappe
 * deux fois (niveau option, séparateur « : », puis niveau graphe, « , ; [ ] »).
 */
export function filterPath(p: string): string {
  const optionLevel = p.replace(/[\\':]/g, (c) => `\\${c}`);
  return optionLevel.replace(/[\\'\[\],;]/g, (c) => `\\${c}`);
}

/**
 * Construit le graphe de filtres complet : effets puis sous-titres.
 * `assPath` est le fichier .ass déjà écrit (null = pas de sous-titres).
 */
export function buildCompleteFilterGraph(spec: FfmpegHabillageSpec, assPath: string | null = null): string {
  const { filters } = buildEffectsFilterGraph(spec.effects ?? [], spec.width, spec.height);
  const chain = [...filters];
  if (assPath) {
    const fonts = bundledFontsDir();
    chain.push(`ass=filename=${filterPath(assPath)}${fonts ? `:fontsdir=${filterPath(fonts)}` : ""}`);
  }
  chain.push("format=yuv420p");
  return `[0:v]${chain.join(",")}[out]`;
}

/**
 * Rend l'habillage complet via FFmpeg en single-pass.
 */
export async function renderHabillageFFmpeg(
  spec: FfmpegHabillageSpec
): Promise<{ durationSec: number; framesRendered: number; unsupportedEffects: string[] }> {
  const { unsupported } = buildEffectsFilterGraph(spec.effects ?? [], spec.width, spec.height);
  let assPath: string | null = null;
  if (spec.captions && spec.captions.length > 0) {
    assPath = join(spec.workDir ?? dirname(spec.outputPath), "captions.ass");
    await writeFile(assPath, buildAssSubtitles(spec.captions, spec.width, spec.height, spec.captionStyle), "utf8");
  }
  const filterGraph = buildCompleteFilterGraph(spec, assPath);
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execAsync = promisify(execFile);

  const presetArg = spec.preset ? ["-preset", spec.preset] : [];
  const crfArg = spec.crf ? ["-crf", spec.crf.toString()] : [];

  const args = [
    "-i", spec.inputPath,
    "-filter_complex", filterGraph,
    "-map", "[out]",
    "-map", "0:a?",
    "-c:a", "copy",
    "-c:v", "libx264",
    ...presetArg,
    ...crfArg,
    "-r", String(spec.fps),
    "-movflags", "+faststart",
    "-y",
    spec.outputPath,
  ];

  const startTime = Date.now();

  try {
    await execAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], { maxBuffer: 16 * 1024 * 1024 });
    const elapsed = Date.now() - startTime;
    console.log(`[ffmpeg-habillage] Rendu terminé en ${(elapsed / 1000).toFixed(1)}s`);

    // Estimer le nombre de frames
    const frameCount = Math.round(spec.durationSec * spec.fps);

    return {
      durationSec: spec.durationSec,
      framesRendered: frameCount,
      unsupportedEffects: unsupported,
    };
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`[ffmpeg-habillage] Erreur après ${(elapsed / 1000).toFixed(1)}s:`, err);
    throw err;
  }
}

/**
 * Calcule les keyframes où les captions changent.
 */
export function computeOverlayKeyframes(
  captions: CaptionSpec[],
  fps: number
): number[] {
  const keyframes = new Set<number>();

  for (const c of captions) {
    keyframes.add(Math.round(c.startSec * fps));
    keyframes.add(Math.round(c.endSec * fps));
  }

  return Array.from(keyframes).sort((a, b) => a - b);
}
