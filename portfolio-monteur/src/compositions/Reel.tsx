import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { Captions, CaptionVariant } from '../components/Captions';
import { ClipsTrack } from '../components/Footage';
import { BrollLayer, GfxLayer, Grain, ProgressBar, Vignette } from '../components/Graphics';
import { Edit } from '../lib/edit';
import { themeFor } from '../lib/theme';

export type ReelProps = { edit: Edit; variant?: CaptionVariant; progress?: boolean; grain?: number };

// Reel / TikTok / Short vertical : face caméra recadré, sous-titres mot à mot, habillage.
export const Reel: React.FC<ReelProps> = ({ edit, variant = 'bold', progress = true, grain = 0.07 }) => {
  const theme = themeFor(edit);
  const endAt = edit.gfx.find((g) => g.type === 'end')?.start ?? Infinity;
  const words = edit.words.filter((w) => w.s < endAt - 0.1);
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <ClipsTrack edit={edit} />
      <BrollLayer edit={edit} />
      <Vignette strength={0.42} />
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 52%, rgba(0,0,0,0.32) 74%, rgba(0,0,0,0.1) 100%)' }} />
      <GfxLayer edit={edit} theme={theme} except={['end', 'flash', 'leak']} />
      <Captions words={words} theme={theme} variant={variant} maxChars={variant === 'editorial' ? 20 : 15} />
      <GfxLayer edit={edit} theme={theme} only={['flash', 'leak']} />
      {progress && <ProgressBar theme={theme} />}
      <GfxLayer edit={edit} theme={theme} only={['end']} />
      {grain > 0 && <Grain opacity={grain} />}
      {edit.audio && <Audio src={staticFile(edit.audio)} />}
    </AbsoluteFill>
  );
};
