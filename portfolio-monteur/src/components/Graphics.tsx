import React from 'react';
import * as Lucide from 'lucide';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  random,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Broll, Edit, Gfx, Theme } from '../lib/edit';
import { F } from '../fonts';

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const clampOpt = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const vertical = (w: number, h: number) => h > w;

// "*mot*" → mot accentué (serif italique, couleur d'accent)
const parseAccent = (s: string) =>
  s.split(/(\*[^*]+\*)/).filter(Boolean).map((part) => ({ text: part.replace(/\*/g, ''), accent: part.startsWith('*') }));

export const fmtNumber = (v: number, decimals = 0) =>
  v.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).replace(/ /g, ' ');

/* ------------------------------------------------------------------ texture */

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.09 }) => {
  const frame = useCurrentFrame();
  const n = frame % 8;
  const x = Math.floor(random(`gx${frame}`) * 512);
  const y = Math.floor(random(`gy${frame}`) * 512);
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${staticFile(`fx/grain_${n}.png`)})`,
        backgroundPosition: `${x}px ${y}px`,
        backgroundSize: '512px 512px',
        mixBlendMode: 'overlay',
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.5 }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 75% 70% at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,0,0,${strength}) 100%)`,
      pointerEvents: 'none',
    }}
  />
);

export const Flash: React.FC<{ color?: string; frames?: number }> = ({ color = '#fff', frames = 6 }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 1, frames], [0, 0.85, 0], clampOpt);
  return <AbsoluteFill style={{ background: color, opacity: o, mixBlendMode: 'screen' }} />;
};

export const LightLeak: React.FC<{ seed?: number; duration?: number; color?: string }> = ({
  seed = 1,
  duration = 20,
  color = '255,170,80',
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const u = frame / duration;
  const o = interpolate(u, [0, 0.25, 0.7, 1], [0, 0.85, 0.5, 0], clampOpt);
  const x = interpolate(u, [0, 1], [-0.2, 1.1]) * width;
  const y = (0.3 + random(`ly${seed}`) * 0.4) * height;
  const r = Math.max(width, height) * 0.55;
  return (
    <AbsoluteFill style={{ mixBlendMode: 'screen', opacity: o, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: x - r,
          top: y - r,
          width: r * 2,
          height: r * 2,
          background: `radial-gradient(circle, rgba(${color},0.9) 0%, rgba(${color},0.35) 35%, rgba(${color},0) 70%)`,
          filter: 'blur(40px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: width - x - r * 0.6,
          top: height - y - r * 0.6,
          width: r * 1.2,
          height: r * 1.2,
          background: 'radial-gradient(circle, rgba(255,90,60,0.7) 0%, rgba(255,90,60,0) 70%)',
          filter: 'blur(50px)',
        }}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ titres */

export const HookTitle: React.FC<{ text: string; theme: Theme; dur: number; y?: number; size?: number }> = ({
  text,
  theme,
  dur,
  y,
  size,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const v = vertical(width, height);
  const fs = size ?? (v ? 92 : 104);
  const lines = text.split('|');
  const out = interpolate(frame, [dur - 8, dur], [0, 1], clampOpt);
  let k = 0;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <AbsoluteFill
        style={{
          background: v
            ? 'linear-gradient(180deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.25) 26%, rgba(0,0,0,0) 40%)'
            : 'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)',
          opacity: interpolate(frame, [0, 6], [0, 1], clampOpt) * (1 - out),
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: v ? 0 : width * 0.07,
          right: v ? 0 : undefined,
          top: (y ?? (v ? 0.15 : 0.36)) * height,
          display: 'flex',
          flexDirection: 'column',
          alignItems: v ? 'center' : 'flex-start',
          gap: fs * 0.02,
          opacity: 1 - out,
          transform: `translateY(${-out * 40}px)`,
        }}
      >
        {lines.map((line, li) => (
          <div key={li} style={{ display: 'flex', gap: fs * 0.22, alignItems: 'baseline' }}>
            {parseAccent(line).flatMap((part, pi) =>
              part.text
                .trim()
                .split(/\s+/)
                .map((word, wi) => {
                  const i = k++;
                  const p = interpolate(frame - i * 2.5, [0, 14], [0, 1], { ...clampOpt, easing: ease });
                  return (
                    <span key={`${pi}-${wi}`} style={{ overflow: 'hidden', display: 'inline-block', padding: `0 ${fs * 0.04}px ${fs * 0.08}px` }}>
                      <span
                        style={{
                          display: 'inline-block',
                          transform: `translateY(${(1 - p) * 115}%)`,
                          fontFamily: part.accent ? F.serif : F.display,
                          fontStyle: part.accent ? 'italic' : 'normal',
                          fontWeight: part.accent ? 400 : 900,
                          fontStretch: part.accent ? undefined : '82%',
                          fontSize: part.accent ? fs * 1.22 : fs,
                          lineHeight: 0.98,
                          letterSpacing: part.accent ? '-0.01em' : '-0.025em',
                          textTransform: part.accent ? 'none' : 'uppercase',
                          color: part.accent ? theme.accent : '#fff',
                          textShadow: '0 6px 30px rgba(0,0,0,0.45)',
                        }}
                      >
                        {word}
                      </span>
                    </span>
                  );
                }),
            )}
          </div>
        ))}
        <Underline frame={frame - 18} width={fs * 3.2} color={theme.accent} />
      </div>
    </AbsoluteFill>
  );
};

const Underline: React.FC<{ frame: number; width: number; color: string }> = ({ frame, width, color }) => {
  const p = interpolate(frame, [0, 16], [0, 1], { ...clampOpt, easing: ease });
  return (
    <svg width={width} height={width * 0.09} viewBox="0 0 320 28" style={{ overflow: 'visible', marginTop: 6 }}>
      <path
        d="M4 18 C 70 6, 150 4, 316 12"
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - p}
      />
    </svg>
  );
};

export const ProgressBar: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width, height: 8, background: 'rgba(255,255,255,0.14)' }}>
      <div
        style={{
          width: `${(frame / (durationInFrames - 1)) * 100}%`,
          height: '100%',
          background: theme.accent,
          boxShadow: `0 0 18px ${theme.accent}`,
        }}
      />
    </div>
  );
};

/* ------------------------------------------------------------------ icônes */

type IconNode = [string, Record<string, string>][];

export const Icon: React.FC<{ name: string; size: number; color: string; draw?: number; strokeWidth?: number }> = ({
  name,
  size,
  color,
  draw = 1,
  strokeWidth = 1.8,
}) => {
  const node = (Lucide as unknown as Record<string, IconNode>)[name] ?? (Lucide as unknown as Record<string, IconNode>).Sparkles;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {node.map(([tag, attrs], i) =>
        React.createElement(tag, { key: i, ...attrs, pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw }),
      )}
    </svg>
  );
};

export const IconBadge: React.FC<{ icon: string; label?: string; x?: number; y?: number; theme: Theme; dur: number }> = ({
  icon,
  label,
  x = 0.5,
  y = 0.5,
  theme,
  dur,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 12, stiffness: 180, mass: 0.7 } });
  const out = interpolate(frame, [dur - 6, dur], [1, 0], clampOpt);
  const draw = interpolate(frame, [3, 20], [0, 1], { ...clampOpt, easing: ease });
  const bob = Math.sin(frame / 9) * 6;
  const d = Math.min(width, height) * 0.2;
  return (
    <div
      style={{
        position: 'absolute',
        left: x * width - d / 2,
        top: y * height - d / 2 + bob,
        width: d,
        transform: `scale(${s * out}) rotate(${(1 - s) * -12}deg)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: d,
          height: d,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.28), rgba(255,255,255,0.06) 60%)',
          border: '1.5px solid rgba(255,255,255,0.35)',
          backdropFilter: 'blur(14px)',
          boxShadow: `0 20px 50px rgba(0,0,0,0.35), 0 0 40px ${theme.accent}40`,
        }}
      >
        <Icon name={icon} size={d * 0.5} color={theme.accent} draw={draw} strokeWidth={1.9} />
      </div>
      {label && (
        <div
          style={{
            fontFamily: F.sans,
            fontWeight: 700,
            fontSize: d * 0.17,
            color: '#fff',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            textShadow: '0 4px 16px rgba(0,0,0,0.5)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ data */

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; enter: number; out: number }> = ({
  children,
  style,
  enter,
  out,
}) => (
  <div
    style={{
      position: 'absolute',
      borderRadius: 34,
      background: 'linear-gradient(160deg, rgba(28,26,24,0.78), rgba(10,10,10,0.82))',
      border: '1.5px solid rgba(255,255,255,0.12)',
      boxShadow: '0 40px 90px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
      backdropFilter: 'blur(22px) saturate(1.2)',
      overflow: 'hidden',
      opacity: Math.min(enter, out),
      transform: `translateY(${(1 - enter) * 60}px) scale(${0.94 + 0.06 * enter})`,
      ...style,
    }}
  >
    {children}
  </div>
);

export const LineChart: React.FC<{
  title: string;
  values: number[];
  compare?: number[];
  compareLabel?: string;
  labels?: string[];
  prefix?: string;
  suffix?: string;
  theme: Theme;
  dur: number;
  x?: number;
  y?: number;
  w?: number;
}> = ({ title, values, compare, compareLabel, labels = [], prefix = '', suffix = '', theme, dur, x, y, w }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const v = vertical(width, height);
  const cw = (w ?? (v ? 0.88 : 0.44)) * width;
  const ch = cw * 0.78;
  const left = (x ?? (v ? 0.5 : 0.73)) * width - cw / 2;
  const top = (y ?? (v ? 0.5 : 0.5)) * height - ch / 2;
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 120 } });
  const out = interpolate(frame, [dur - 8, dur], [1, 0], clampOpt);
  const p = interpolate(frame, [8, 8 + fps * 1.6], [0, 1], { ...clampOpt, easing: Easing.inOut(Easing.cubic) });
  const pad = { l: cw * 0.07, r: cw * 0.07, t: ch * 0.36, b: ch * 0.14 };
  const gw = cw - pad.l - pad.r;
  const gh = ch - pad.t - pad.b;
  const max = Math.max(...values, ...(compare ?? [])) * 1.05;
  const pt = (arr: number[], i: number) => [pad.l + (i / (arr.length - 1)) * gw, pad.t + gh - (arr[i] / max) * gh] as const;
  const path = (arr: number[]) => arr.map((_, i) => `${i ? 'L' : 'M'}${pt(arr, i)[0].toFixed(1)},${pt(arr, i)[1].toFixed(1)}`).join(' ');
  const idx = p * (values.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(values.length - 1, i0 + 1);
  const cur = values[i0] + (values[i1] - values[i0]) * (idx - i0);
  const [tx, ty] = [pad.l + p * gw, pad.t + gh - (cur / max) * gh];
  const id = `g${Math.round(cw)}`;
  return (
    <Card enter={enter} out={out} style={{ left, top, width: cw, height: ch }}>
      <div style={{ position: 'absolute', left: pad.l, top: ch * 0.07, fontFamily: F.sans, fontWeight: 600, fontSize: cw * 0.042, color: 'rgba(255,255,255,0.66)', letterSpacing: '0.01em' }}>
        {title}
      </div>
      <div
        style={{
          position: 'absolute',
          left: pad.l,
          top: ch * 0.14,
          fontFamily: F.display,
          fontWeight: 850,
          fontStretch: '88%',
          fontSize: cw * 0.12,
          color: '#fff',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {prefix}
        {fmtNumber(Math.round(cur))}
        <span style={{ color: theme.accent }}>{suffix}</span>
      </div>
      <svg width={cw} height={ch} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={theme.accent} stopOpacity={0.45} />
            <stop offset="100%" stopColor={theme.accent} stopOpacity={0} />
          </linearGradient>
          <clipPath id={`${id}c`}>
            <rect x={0} y={0} width={pad.l + p * gw} height={ch} />
          </clipPath>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <line key={g} x1={pad.l} x2={pad.l + gw} y1={pad.t + gh * g} y2={pad.t + gh * g} stroke="rgba(255,255,255,0.08)" strokeWidth={1.5} />
        ))}
        {compare && (
          <path d={path(compare)} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={4} strokeDasharray="10 12" clipPath={`url(#${id}c)`} />
        )}
        <path d={`${path(values)} L${pad.l + gw},${pad.t + gh} L${pad.l},${pad.t + gh} Z`} fill={`url(#${id}f)`} clipPath={`url(#${id}c)`} />
        <path d={path(values)} fill="none" stroke={theme.accent} strokeWidth={6} strokeLinejoin="round" clipPath={`url(#${id}c)`} />
        <circle cx={tx} cy={ty} r={22} fill={theme.accent} opacity={0.25} />
        <circle cx={tx} cy={ty} r={10} fill="#fff" stroke={theme.accent} strokeWidth={5} />
      </svg>
      {compare && compareLabel && (
        <div style={{ position: 'absolute', right: pad.r, top: ch * 0.24, fontFamily: F.sans, fontWeight: 600, fontSize: cw * 0.032, color: 'rgba(255,255,255,0.5)', opacity: p }}>
          - - {compareLabel}
        </div>
      )}
      <div style={{ position: 'absolute', left: pad.l, right: pad.r, bottom: ch * 0.04, display: 'flex', justifyContent: 'space-between' }}>
        {labels.map((l) => (
          <span key={l} style={{ fontFamily: F.mono, fontSize: cw * 0.03, color: 'rgba(255,255,255,0.45)' }}>
            {l}
          </span>
        ))}
      </div>
    </Card>
  );
};

export const Counter: React.FC<{
  value: number;
  label?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  theme: Theme;
  dur: number;
  y?: number;
}> = ({ value, label, prefix = '', suffix = '', decimals = 0, theme, dur, y }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const v = vertical(width, height);
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 150 } });
  const out = interpolate(frame, [dur - 7, dur], [1, 0], clampOpt);
  const p = interpolate(frame, [2, fps * 1.2], [0, 1], { ...clampOpt, easing: Easing.out(Easing.exp) });
  const fs = (v ? 0.17 : 0.1) * width;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: (y ?? (v ? 0.24 : 0.2)) * height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity: Math.min(enter, out),
        transform: `scale(${0.85 + 0.15 * enter})`,
      }}
    >
      {label && (
        <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: fs * 0.22, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.08em', textTransform: 'uppercase', textShadow: '0 4px 20px rgba(0,0,0,0.6)' }}>
          {label}
        </div>
      )}
      <div
        style={{
          fontFamily: F.display,
          fontWeight: 900,
          fontStretch: '80%',
          fontSize: fs,
          lineHeight: 1,
          color: '#fff',
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
          textShadow: `0 10px 40px rgba(0,0,0,0.55), 0 0 60px ${theme.accent}55`,
        }}
      >
        {prefix}
        {fmtNumber(value * p, decimals)}
        <span style={{ color: theme.accent }}>{suffix}</span>
      </div>
    </div>
  );
};

export const LowerThird: React.FC<{ name: string; role: string; theme: Theme; dur: number }> = ({ name, role, theme, dur }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const v = vertical(width, height);
  const bar = interpolate(frame, [0, 12], [0, 1], { ...clampOpt, easing: ease });
  const nameP = interpolate(frame, [5, 20], [0, 1], { ...clampOpt, easing: ease });
  const roleP = interpolate(frame, [12, 26], [0, 1], { ...clampOpt, easing: ease });
  const out = interpolate(frame, [dur - 10, dur], [1, 0], { ...clampOpt, easing: Easing.in(Easing.cubic) });
  const fs = v ? 64 : 58;
  return (
    <div
      style={{
        position: 'absolute',
        left: v ? width * 0.08 : width * 0.06,
        top: v ? height * 0.6 : height * 0.74,
        display: 'flex',
        gap: 22,
        opacity: out,
        transform: `translateX(${(1 - out) * -30}px)`,
      }}
    >
      <div style={{ width: 8, borderRadius: 4, background: theme.accent, transform: `scaleY(${bar})`, transformOrigin: 'top', boxShadow: `0 0 20px ${theme.accent}` }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ transform: `translateY(${(1 - nameP) * 110}%)`, fontFamily: F.display, fontWeight: 850, fontStretch: '85%', fontSize: fs, color: '#fff', letterSpacing: '-0.01em', textTransform: 'uppercase', textShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
            {name}
          </div>
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ transform: `translateY(${(1 - roleP) * 110}%)`, fontFamily: F.sans, fontWeight: 500, fontSize: fs * 0.48, color: 'rgba(255,255,255,0.78)', letterSpacing: '0.02em', textShadow: '0 4px 18px rgba(0,0,0,0.5)' }}>
            {role}
          </div>
        </div>
      </div>
    </div>
  );
};

// Mot ou phrase choc en grand, posé à côté du sujet (16:9) ou au-dessus (9:16)
export const KeywordSlam: React.FC<{ text: string; sub?: string; theme: Theme; dur: number; x?: number; y?: number; align?: 'left' | 'center' | 'right' }> = ({
  text,
  sub,
  theme,
  dur,
  x,
  y,
  align,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const v = vertical(width, height);
  const s = spring({ frame, fps, config: { damping: 11, stiffness: 200, mass: 0.6 } });
  const out = interpolate(frame, [dur - 6, dur], [1, 0], clampOpt);
  const track = interpolate(frame, [0, dur], [0.02, 0.08]);
  const fs = (v ? 0.15 : 0.085) * width;
  const al = align ?? (v ? 'center' : 'left');
  return (
    <div
      style={{
        position: 'absolute',
        left: (x ?? (v ? 0.5 : 0.62)) * width,
        top: (y ?? (v ? 0.2 : 0.42)) * height,
        transform: `translate(${al === 'center' ? '-50%' : al === 'right' ? '-100%' : '0'}, -50%) scale(${1.25 - 0.25 * s})`,
        opacity: Math.min(1, s * 1.5) * out,
        textAlign: al,
        filter: `blur(${(1 - s) * 6}px)`,
      }}
    >
      <div
        style={{
          fontFamily: F.display,
          fontWeight: 900,
          fontStretch: '75%',
          fontSize: fs,
          lineHeight: 0.92,
          letterSpacing: `${track}em`,
          color: '#fff',
          textTransform: 'uppercase',
          whiteSpace: 'pre',
          textShadow: '0 10px 50px rgba(0,0,0,0.5)',
        }}
      >
        {parseAccent(text).map((p, i) => (
          <span key={i} style={p.accent ? { color: theme.accent } : undefined}>
            {p.text}
          </span>
        ))}
      </div>
      {sub && (
        <div style={{ marginTop: fs * 0.12, fontFamily: F.serif, fontStyle: 'italic', fontSize: fs * 0.42, color: 'rgba(255,255,255,0.85)', textShadow: '0 4px 24px rgba(0,0,0,0.6)' }}>
          {sub}
        </div>
      )}
    </div>
  );
};

export const QuoteCard: React.FC<{ text: string; author?: string; theme: Theme; dur: number }> = ({ text, author, theme, dur }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const v = vertical(width, height);
  const words = text.split(/\s+/);
  const out = interpolate(frame, [dur - 10, dur], [1, 0], clampOpt);
  const fs = (v ? 0.085 : 0.05) * width;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: out, padding: width * 0.08 }}>
      <div style={{ fontFamily: F.soft, fontWeight: 500, fontSize: fs, lineHeight: 1.15, color: '#fff', textAlign: 'center', letterSpacing: '-0.015em', textShadow: '0 6px 40px rgba(0,0,0,0.6)' }}>
        {words.map((w, i) => {
          const p = interpolate(frame - i * 2, [0, 12], [0, 1], { ...clampOpt, easing: ease });
          const acc = w.startsWith('*');
          return (
            <span key={i} style={{ display: 'inline-block', opacity: p, transform: `translateY(${(1 - p) * 20}px)`, filter: `blur(${(1 - p) * 8}px)`, marginRight: '0.26em', color: acc ? theme.accent : undefined, fontStyle: acc ? 'italic' : undefined }}>
              {w.replace(/\*/g, '')}
            </span>
          );
        })}
      </div>
      {author && (
        <div style={{ marginTop: fs * 0.7, fontFamily: F.mono, fontSize: fs * 0.32, letterSpacing: '0.2em', textTransform: 'uppercase', color: theme.accent, opacity: interpolate(frame, [words.length * 2, words.length * 2 + 12], [0, 1], clampOpt) }}>
          {author}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const EndCard: React.FC<{ title: string; sub?: string; handle?: string; theme: Theme; dur: number }> = ({ title, sub, handle, theme }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const v = vertical(width, height);
  const bg = interpolate(frame, [0, 10], [0, 1], clampOpt);
  const s = spring({ frame: frame - 4, fps, config: { damping: 18, stiffness: 120 } });
  const fs = (v ? 0.13 : 0.075) * width;
  return (
    <AbsoluteFill style={{ background: `rgba(8,8,8,${0.86 * bg})`, backdropFilter: `blur(${bg * 18}px)`, justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ opacity: s, transform: `translateY(${(1 - s) * 40}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: fs * 0.18 }}>
        <div style={{ fontFamily: F.display, fontWeight: 900, fontStretch: '78%', fontSize: fs, color: '#fff', letterSpacing: '0.01em', textTransform: 'uppercase', lineHeight: 0.95, textAlign: 'center' }}>
          {parseAccent(title).map((p, i) => (
            <span key={i} style={p.accent ? { color: theme.accent, fontFamily: F.serif, fontStyle: 'italic', fontWeight: 400, textTransform: 'none' } : undefined}>
              {p.text}
            </span>
          ))}
        </div>
        {sub && <div style={{ fontFamily: F.sans, fontWeight: 500, fontSize: fs * 0.26, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.02em' }}>{sub}</div>}
        {handle && (
          <div style={{ marginTop: fs * 0.2, padding: `${fs * 0.1}px ${fs * 0.26}px`, borderRadius: 999, border: `2px solid ${theme.accent}`, fontFamily: F.sans, fontWeight: 700, fontSize: fs * 0.24, color: theme.accent, letterSpacing: '0.02em' }}>
            {handle}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ b-roll */

export const BrollClip: React.FC<{ b: Broll; edit: Edit; dur: number; filter?: string }> = ({ b, edit, dur, filter }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const [z0, z1] = b.kb ?? [1.04, 1.14];
  const z = interpolate(frame, [0, dur], [z0, z1]);
  const inP = interpolate(frame, [0, 5], [0, 1], { ...clampOpt, easing: ease });
  const video = (
    <OffthreadVideo
      src={staticFile(b.src)}
      trimBefore={Math.round(b.srcIn * fps)}
      muted
      style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${z * (1.08 - 0.08 * inP)})`, filter }}
    />
  );
  if (b.mode === 'card') {
    const s = spring({ frame, fps, config: { damping: 15, stiffness: 160 } });
    const cw = width * (height > width ? 0.84 : 0.5);
    const chh = cw * (height > width ? 1.1 : 0.62);
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: `blur(${16 * s}px)`, opacity: s }} />
        <div
          style={{
            position: 'absolute',
            left: (width - cw) / 2,
            top: height * (height > width ? 0.2 : 0.17),
            width: cw,
            height: chh,
            borderRadius: 36,
            overflow: 'hidden',
            boxShadow: '0 50px 100px rgba(0,0,0,0.6)',
            border: '2px solid rgba(255,255,255,0.18)',
            transform: `translateY(${(1 - s) * 120}px) rotate(${(1 - s) * 4}deg) scale(${0.9 + 0.1 * s})`,
          }}
        >
          {video}
        </div>
      </AbsoluteFill>
    );
  }
  return <AbsoluteFill style={{ opacity: Math.min(1, inP * 2) }}>{video}</AbsoluteFill>;
};

/* ------------------------------------------------------------------ calques */

export const GfxLayer: React.FC<{ edit: Edit; theme: Theme; only?: string[]; except?: string[] }> = ({ edit, theme, only, except }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {edit.gfx
        .filter((g) => (!only || only.includes(g.type)) && (!except || !except.includes(g.type)))
        .map((g, i) => {
          const from = Math.round(g.start * fps);
          const dur = Math.max(2, Math.round(g.end * fps) - from);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const p = g as unknown as Record<string, any>;
          let el: React.ReactNode = null;
          switch (g.type) {
            case 'hook':
              el = <HookTitle text={p.text} theme={theme} dur={dur} y={p.y} size={p.size} />;
              break;
            case 'icon':
              el = <IconBadge icon={p.icon} label={p.label} x={p.x} y={p.y} theme={theme} dur={dur} />;
              break;
            case 'chart':
              el = <LineChart {...(p as React.ComponentProps<typeof LineChart>)} theme={theme} dur={dur} />;
              break;
            case 'counter':
              el = <Counter {...(p as React.ComponentProps<typeof Counter>)} theme={theme} dur={dur} />;
              break;
            case 'lower':
              el = <LowerThird name={p.name} role={p.role} theme={theme} dur={dur} />;
              break;
            case 'slam':
              el = <KeywordSlam text={p.text} sub={p.sub} x={p.x} y={p.y} align={p.align} theme={theme} dur={dur} />;
              break;
            case 'quote':
              el = <QuoteCard text={p.text} author={p.author} theme={theme} dur={dur} />;
              break;
            case 'flash':
              el = <Flash color={p.color} frames={p.frames} />;
              break;
            case 'leak':
              el = <LightLeak seed={i} duration={dur} color={p.color} />;
              break;
            case 'end':
              el = <EndCard title={p.title} sub={p.sub} handle={p.handle} theme={theme} dur={dur} />;
              break;
            case 'image':
              el = <Img src={staticFile(p.src)} style={{ position: 'absolute', ...(p.style as React.CSSProperties) }} />;
              break;
            default:
              el = null;
          }
          return (
            <Sequence key={i} from={from} durationInFrames={dur} name={`${g.type} ${i}`}>
              {el}
            </Sequence>
          );
        })}
    </>
  );
};

export const BrollLayer: React.FC<{ edit: Edit; filter?: string }> = ({ edit, filter }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {edit.broll.map((b, i) => {
        const from = Math.round(b.start * fps);
        const dur = Math.max(2, Math.round(b.end * fps) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={dur} name={`b-roll ${i + 1}`}>
            <BrollClip b={b} edit={edit} dur={dur} filter={filter} />
          </Sequence>
        );
      })}
    </>
  );
};
