import React, { useMemo } from 'react';
import { measureText } from '@remotion/layout-utils';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Theme, Word } from '../lib/edit';
import { F } from '../fonts';

// Sous-titres mot à mot.
//  bold      : gras, majuscules, mot prononcé en couleur (style Reels/TikTok haut de gamme)
//  editorial : sans-serif + mots forts en serif italique (style clips de podcast premium)
//  box       : le mot prononcé passe dans une pastille de couleur
export type CaptionVariant = 'bold' | 'editorial' | 'box';

type Page = { words: Word[]; lines: Word[][]; start: number; end: number };

const textOf = (w: Word, upper: boolean) => (upper ? w.w.toLocaleUpperCase('fr-FR') : w.w);

export function paginate(words: Word[], maxChars: number, maxLines: number, gap = 0.5): Page[] {
  const pages: Page[] = [];
  let cur: Word[] = [];
  let chars = 0;
  const flush = () => {
    if (!cur.length) return;
    pages.push({ words: cur, lines: [], start: cur[0].s, end: cur[cur.length - 1].e });
    cur = [];
    chars = 0;
  };
  words.forEach((w, i) => {
    const prev = words[i - 1];
    if (cur.length && prev && w.s - prev.e > gap) flush();
    const len = w.w.length + (cur.length ? 1 : 0);
    if (cur.length && (chars + len > maxChars * maxLines || w.kw === 2)) flush();
    cur.push(w);
    chars += len;
    const strong = /[.!?…]$/.test(w.w);
    const soft = /[,;:]$/.test(w.w) && chars >= maxChars * 0.6;
    if (w.br || strong || soft || w.kw === 2) flush();
  });
  flush();
  for (const p of pages) p.lines = splitLines(p.words, maxChars);
  pages.forEach((p, i) => {
    const next = pages[i + 1];
    p.end = next ? Math.min(next.start, p.end + 0.7) : p.end + 0.6;
  });
  return pages;
}

function splitLines(words: Word[], maxChars: number): Word[][] {
  const total = words.reduce((a, w) => a + w.w.length, 0) + words.length - 1;
  if (total <= maxChars || words.length < 2) return [words];
  let best = 1;
  let bestScore = Infinity;
  let acc = 0;
  for (let i = 1; i < words.length; i++) {
    acc += words[i - 1].w.length + (i > 1 ? 1 : 0);
    const score = Math.max(acc, total - acc - 1);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return [words.slice(0, best), words.slice(best)];
}

export const Captions: React.FC<{
  words: Word[];
  theme: Theme;
  variant?: CaptionVariant;
  maxChars?: number;
  maxLines?: number;
  maxWidth?: number;
  reveal?: 'pop' | 'highlight';
}> = ({ words, theme, variant = 'bold', maxChars = 16, maxLines = 2, maxWidth, reveal = 'pop' }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const pages = useMemo(() => paginate(words, maxChars, maxLines), [words, maxChars, maxLines]);
  const page = pages.find((p) => t >= p.start - 0.05 && t < p.end);
  if (!page) return null;

  const upper = variant !== 'editorial' && theme.upper;
  const base = theme.captionSize;
  const limit = maxWidth ?? width * 0.86;
  const fontFor = (w: Word) => (variant === 'editorial' && w.kw === 2 ? F.serif : theme.captionFont);
  const sizeFor = (w: Word) => base * (w.kw === 2 ? (variant === 'editorial' ? 1.35 : 1.28) : 1);
  // réduit le bloc si une ligne dépasse la largeur utile
  const widest = Math.max(
    ...page.lines.map((line) =>
      line.reduce(
        (acc, w) =>
          acc +
          measureText({
            text: textOf(w, upper) + ' ',
            fontFamily: fontFor(w),
            fontSize: sizeFor(w),
            fontWeight: String(variant === 'editorial' && w.kw === 2 ? 400 : theme.captionWeight),
            letterSpacing: '-0.02em',
          }).width,
        0,
      ),
    ),
  );
  const fit = Math.min(1, limit / Math.max(1, widest));
  const activeIdx = page.words.findIndex((w, i) => {
    const next = page.words[i + 1];
    return t >= w.s && (!next || t < next.s);
  });

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: height * theme.captionY,
        transform: `translateY(-50%) scale(${fit})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: base * 0.06,
        pointerEvents: 'none',
      }}
    >
      {page.lines.map((line, li) => (
        <div key={li} style={{ display: 'flex', gap: base * 0.3, alignItems: 'baseline', whiteSpace: 'nowrap' }}>
          {line.map((w) => {
            const idx = page.words.indexOf(w);
            const lf = frame - Math.round(w.s * fps);
            const spoken = lf >= 0;
            const active = idx === activeIdx;
            const pop = spring({ frame: lf, fps, config: { damping: 15, stiffness: 260, mass: 0.55 } });
            let opacity = 1;
            let ty = 0;
            let sc = 1;
            let blur = 0;
            if (reveal === 'pop') {
              opacity = spoken ? interpolate(lf, [0, 2], [0, 1], { extrapolateRight: 'clamp' }) : 0;
              ty = (1 - pop) * base * 0.28;
              sc = 0.78 + 0.22 * pop;
              blur = variant === 'editorial' ? interpolate(lf, [0, 5], [10, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
            } else {
              opacity = spoken ? 1 : 0.38;
            }
            const isKw = (w.kw ?? 0) > 0;
            let color = theme.text;
            if (variant === 'bold' && (active || (isKw && spoken))) color = theme.accent;
            if (variant === 'editorial' && isKw && spoken) color = theme.accent;
            if (variant === 'box' && isKw && spoken && !active) color = theme.accent;
            const boxed = variant === 'box' && active;
            if (boxed) color = '#111';
            const serif = variant === 'editorial' && w.kw === 2;
            return (
              <span
                key={idx}
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  fontFamily: fontFor(w),
                  fontWeight: serif ? 400 : theme.captionWeight,
                  fontStyle: serif ? 'italic' : 'normal',
                  fontSize: sizeFor(w),
                  lineHeight: 1.04,
                  letterSpacing: serif ? '-0.01em' : '-0.02em',
                  color,
                  opacity,
                  transform: `translateY(${ty}px) scale(${sc})`,
                  transformOrigin: '50% 80%',
                  filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
                  textShadow: boxed ? 'none' : theme.shadow,
                  padding: boxed ? `0 ${base * 0.14}px` : undefined,
                  margin: boxed ? `0 ${-base * 0.14}px` : undefined,
                  zIndex: boxed ? 1 : 2,
                }}
              >
                {boxed && (
                  <span
                    style={{
                      position: 'absolute',
                      inset: `${base * 0.02}px 0 ${base * 0.0}px 0`,
                      background: theme.accent,
                      borderRadius: base * 0.16,
                      zIndex: -1,
                      transform: `scale(${0.9 + 0.1 * pop})`,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
                    }}
                  />
                )}
                {textOf(w, upper)}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
