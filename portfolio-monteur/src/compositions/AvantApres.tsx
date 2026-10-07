import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Freeze,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { fmtNumber, Grain } from '../components/Graphics';
import { F } from '../fonts';
import { Edit } from '../lib/edit';
import { themeFor } from '../lib/theme';

export type AvantApresProps = {
  edit: Edit; // montage du reel (pour synchroniser le rush avec le reel)
  reel: string; // reel rendu (public/)
  rawSrc: string; // source non étalonnée (public/)
  intro: { srcIn: number; dur: number }; // passage brut montré seul, avec son direct
  wave: number[]; // forme d'onde du rush sur [srcMin, srcMax]
  srcMin: number;
  srcMax: number;
  credit?: string;
};

const ease = Easing.bezier(0.22, 1, 0.36, 1);
const cl = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const TRANS = 0.9;
const OUTRO = 4.2;

export const avantApresDuration = (p: AvantApresProps) => p.intro.dur + TRANS + p.edit.duration + OUTRO;

const tc = (s: number) => {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${String(m).padStart(2, '0')}:${r.toFixed(2).padStart(5, '0')}`;
};

// temps source correspondant à l'instant t du reel
const srcAt = (edit: Edit, t: number) => {
  const c = edit.clips.find((k) => t >= k.start && t < k.end) ?? edit.clips[edit.clips.length - 1];
  return c.srcIn + Math.min(t, c.end) - c.start;
};

const Label: React.FC<{ text: string; sub: string; color: string; p: number }> = ({ text, sub, color, p }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 18, opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>
    <span style={{ fontFamily: F.display, fontWeight: 900, fontStretch: '80%', fontSize: 54, color, letterSpacing: '0.02em' }}>{text}</span>
    <span style={{ fontFamily: F.mono, fontWeight: 500, fontSize: 19, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{sub}</span>
  </div>
);

export const AvantApres: React.FC<AvantApresProps> = (props) => {
  const { edit, reel, rawSrc, intro, wave, srcMin, srcMax, credit } = props;
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const theme = themeFor(edit);
  const t = frame / fps;
  const A = intro.dur;
  const B = A + TRANS;
  const C = B + edit.duration;

  // panneau "avant" : plein écran pendant l'intro, puis à gauche
  const k = interpolate(t, [A, B], [0, 1], { ...cl, easing: ease });
  const panelW = interpolate(k, [0, 1], [width, width * 0.5]);
  const panelH = panelW * (9 / 16);
  const panelX = interpolate(k, [0, 1], [0, width * 0.06]);
  const panelY = interpolate(k, [0, 1], [0, height * 0.2]);
  const radius = interpolate(k, [0, 1], [0, 26]);
  const phoneH = height * 0.8;
  const phoneW = phoneH * (9 / 16);
  const phoneX = width * 0.69 - phoneW / 2;
  const phoneIn = spring({ frame: frame - Math.round(A * fps), fps, config: { damping: 18, stiffness: 110 } });
  const reelT = Math.max(0, t - B);
  const src = t < B ? intro.srcIn + t : srcAt(edit, Math.min(reelT, edit.duration - 1 / fps));
  const cuts = edit.clips.filter((c) => c.start > 0 && c.start <= reelT).length;
  const words = edit.words.filter((w) => w.s <= reelT).length;
  const outro = interpolate(t, [C - 0.2, C + 0.6], [0, 1], { ...cl, easing: ease });
  const labels = interpolate(t, [A + 0.3, B + 0.3], [0, 1], cl);

  return (
    <AbsoluteFill style={{ background: 'radial-gradient(ellipse at 50% 40%, #1b1916 0%, #0a0a0a 70%)', overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          opacity: k,
        }}
      />

      {/* rush brut */}
      <div style={{ position: 'absolute', left: panelX, top: panelY, width: panelW, height: panelH, borderRadius: radius, overflow: 'hidden', boxShadow: k > 0 ? '0 40px 80px rgba(0,0,0,0.55)' : undefined }}>
        <Sequence durationInFrames={Math.round(B * fps)} layout="none">
          <OffthreadVideo src={staticFile(rawSrc)} trimBefore={Math.round(intro.srcIn * fps)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </Sequence>
        {edit.clips.map((c, i) => {
          const from = Math.round((B + c.start) * fps);
          const dur = Math.max(1, Math.round((B + c.end) * fps) - from);
          return (
            <Sequence key={i} from={from} durationInFrames={dur} layout="none">
              <OffthreadVideo src={staticFile(rawSrc)} trimBefore={Math.round(c.srcIn * fps)} muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            </Sequence>
          );
        })}
        <Sequence from={Math.round(C * fps)} layout="none">
          <OffthreadVideo
            src={staticFile(rawSrc)}
            trimBefore={Math.round(srcAt(edit, edit.duration - 1 / fps) * fps)}
            muted
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </Sequence>
        {/* viseur caméra */}
        <AbsoluteFill style={{ padding: 34 * (1 - 0.45 * k), fontFamily: F.mono, color: '#fff', fontSize: 22 * (1 - 0.3 * k), letterSpacing: '0.1em' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>
            <span>
              <span style={{ color: '#ff3b30', opacity: Math.floor(t * 2) % 2 ? 1 : 0.25 }}>●</span> RUSH BRUT
            </span>
            <span>{tc(src)}</span>
          </div>
        </AbsoluteFill>
      </div>

      {/* intro : grand titre AVANT */}
      <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 70, opacity: interpolate(t, [0.2, 0.7, A - 0.2, A + 0.1], [0, 1, 1, 0], cl) }}>
        <div style={{ fontFamily: F.display, fontWeight: 900, fontStretch: '78%', fontSize: 150, color: '#fff', lineHeight: 0.9, textShadow: '0 10px 50px rgba(0,0,0,0.6)' }}>AVANT</div>
        <div style={{ fontFamily: F.mono, fontSize: 24, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 14, textShadow: '0 2px 10px rgba(0,0,0,0.7)' }}>
          Rush brut · 16:9 · son direct · zéro retouche
        </div>
      </AbsoluteFill>

      {/* libellés + timeline du rush */}
      <div style={{ position: 'absolute', left: width * 0.06, top: height * 0.1, opacity: labels }}>
        <Label text="AVANT" sub="le rush" color="rgba(255,255,255,0.9)" p={labels} />
      </div>
      <div style={{ position: 'absolute', left: width * 0.06, top: height * 0.2 + width * 0.5 * (9 / 16) + 34, width: width * 0.5, opacity: labels }}>
        <Timeline edit={edit} wave={wave} srcMin={srcMin} srcMax={srcMax} src={src} accent={theme.accent} />
        <div style={{ display: 'flex', gap: 46, marginTop: 30 }}>
          <Stat n={cuts} label="coupes" accent={theme.accent} />
          <Stat n={words} label="mots animés" accent={theme.accent} />
          <Stat n={edit.gfx.filter((g) => !['flash', 'leak'].includes(g.type)).length} label="animations" accent={theme.accent} />
        </div>
      </div>

      {/* téléphone : le reel monté */}
      <div style={{ position: 'absolute', left: phoneX, top: (height - phoneH) / 2 + 36 + (1 - phoneIn) * height * 0.9, width: phoneW, height: phoneH }}>
        <div style={{ position: 'absolute', left: 0, top: -72, opacity: labels }}>
          <Label text="APRÈS" sub="le reel" color={theme.accent} p={labels} />
        </div>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 56, background: '#0d0d0d', boxShadow: `0 60px 120px rgba(0,0,0,0.7), 0 0 0 2px rgba(255,255,255,0.12), 0 0 90px ${theme.accent}22` }} />
        <div style={{ position: 'absolute', inset: 12, borderRadius: 46, overflow: 'hidden', background: '#000' }}>
          {t < B && (
            <Freeze frame={0}>
              <OffthreadVideo src={staticFile(reel)} muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            </Freeze>
          )}
          <Sequence from={Math.round(B * fps)} durationInFrames={Math.round(edit.duration * fps)} layout="none">
            <OffthreadVideo src={staticFile(reel)} style={{ width: '100%', height: '100%' }} />
          </Sequence>
          {t >= C && (
            <Freeze frame={Math.round(edit.duration * fps) - 1}>
              <OffthreadVideo src={staticFile(reel)} muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            </Freeze>
          )}
          <div style={{ position: 'absolute', top: 16, left: '50%', width: 110, height: 32, marginLeft: -55, borderRadius: 20, background: '#000' }} />
        </div>
      </div>

      {/* bilan */}
      {outro > 0 && (
        <AbsoluteFill style={{ background: `rgba(6,6,6,${0.82 * outro})`, backdropFilter: `blur(${outro * 16}px)`, justifyContent: 'center', alignItems: 'center' }}>
          <Outro p={outro} frame={frame - Math.round(C * fps)} edit={edit} rush={srcMax - srcMin} accent={theme.accent} credit={credit} />
        </AbsoluteFill>
      )}

      <Sequence durationInFrames={Math.round(B * fps)}>
        <Audio src={staticFile(rawSrc)} trimBefore={Math.round(intro.srcIn * fps)} volume={(f) => interpolate(f, [B * fps - 12, B * fps], [1, 0], cl)} />
      </Sequence>
      <Grain opacity={0.06} />
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ n: number; label: string; accent: string }> = ({ n, label, accent }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
    <span style={{ fontFamily: F.display, fontWeight: 850, fontStretch: '85%', fontSize: 64, color: accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{n}</span>
    <span style={{ fontFamily: F.mono, fontSize: 17, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</span>
  </div>
);

const Timeline: React.FC<{ edit: Edit; wave: number[]; srcMin: number; srcMax: number; src: number; accent: string }> = ({
  edit,
  wave,
  srcMin,
  srcMax,
  src,
  accent,
}) => {
  const W = 960;
  const H = 90;
  const x = (s: number) => ((s - srcMin) / (srcMax - srcMin)) * W;
  const kept = edit.clips.map((c) => [c.srcIn, c.srcIn + (c.end - c.start)] as const);
  const isKept = (s: number) => kept.some(([a, b]) => s >= a && s < b);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 26}`} style={{ overflow: 'visible' }}>
      <rect x={0} y={0} width={W} height={H} rx={12} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.1)" />
      {wave.map((v, i) => {
        const s = srcMin + ((i + 0.5) / wave.length) * (srcMax - srcMin);
        const bw = W / wave.length;
        const h = Math.max(2, v * (H - 16));
        return <rect key={i} x={i * bw + 0.6} y={H / 2 - h / 2} width={Math.max(1, bw - 1.2)} height={h} rx={1} fill={isKept(s) ? accent : 'rgba(255,80,80,0.45)'} opacity={isKept(s) ? 0.9 : 0.6} />;
      })}
      <line x1={x(src)} x2={x(src)} y1={-8} y2={H + 8} stroke="#fff" strokeWidth={3} />
      <circle cx={x(src)} cy={-8} r={6} fill="#fff" />
      <rect x={0} y={H + 12} width={16} height={16} rx={3} fill={accent} />
      <text x={26} y={H + 26} fill="rgba(255,255,255,0.6)" fontFamily="JetBrains Mono Variable" fontSize={19} letterSpacing="1.5">
        GARDÉ
      </text>
      <rect x={130} y={H + 12} width={16} height={16} rx={3} fill="rgba(255,80,80,0.6)" />
      <text x={156} y={H + 26} fill="rgba(255,255,255,0.6)" fontFamily="JetBrains Mono Variable" fontSize={19} letterSpacing="1.5">
        COUPÉ : BLANCS, HÉSITATIONS, REDITES
      </text>
    </svg>
  );
};

const Outro: React.FC<{ p: number; frame: number; edit: Edit; rush: number; accent: string; credit?: string }> = ({ p, frame, edit, rush, accent, credit }) => {
  const { fps } = useVideoConfig();
  const c = (d: number) => interpolate(frame - d, [0, fps * 0.9], [0, 1], { ...cl, easing: Easing.out(Easing.exp) });
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const items: [string, string][] = [
    [mmss(rush * c(4)), 'de rush'],
    [mmss(edit.duration * c(10)), 'de reel'],
    [fmtNumber(Math.round((edit.clips.length - 1) * c(16))), 'coupes'],
    [fmtNumber(Math.round(edit.words.length * c(22))), 'mots animés'],
  ];
  return (
    <div style={{ opacity: p, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 50 }}>
      <div style={{ display: 'flex', gap: 90 }}>
        {items.map(([n, l], i) => (
          <div key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: c(i * 6) }}>
            <span style={{ fontFamily: F.display, fontWeight: 900, fontStretch: '80%', fontSize: 120, color: i === 1 ? accent : '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{n}</span>
            <span style={{ fontFamily: F.mono, fontSize: 22, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.16em', textTransform: 'uppercase' }}>{l}</span>
          </div>
        ))}
      </div>
      {credit && (
        <div style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 46, color: 'rgba(255,255,255,0.85)', opacity: c(34) }}>
          Montage <span style={{ color: accent }}>{credit}</span>
        </div>
      )}
    </div>
  );
};
