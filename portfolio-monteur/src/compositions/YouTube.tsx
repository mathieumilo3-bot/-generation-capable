import React from 'react';
import { AbsoluteFill, Audio, staticFile } from 'remotion';
import { Captions, CaptionVariant } from '../components/Captions';
import { ClipsTrack } from '../components/Footage';
import { BrollLayer, GfxLayer, Grain, Vignette } from '../components/Graphics';
import { Edit } from '../lib/edit';
import { themeFor } from '../lib/theme';

export type YouTubeProps = { edit: Edit; captions?: boolean; variant?: CaptionVariant; letterbox?: boolean };

// Extrait YouTube 16:9 : plans face caméra (zooms), b-roll, motion design data, sous-titres sobres.
export const YouTube: React.FC<YouTubeProps> = ({ edit, captions = true, variant = 'editorial', letterbox = false }) => {
  const theme = themeFor(edit);
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <ClipsTrack edit={edit} />
      <BrollLayer edit={edit} />
      <Vignette strength={0.5} />
      <GfxLayer edit={edit} theme={theme} except={['end', 'flash', 'leak']} />
      {captions && (
        <>
          <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 70%, rgba(0,0,0,0.4) 100%)' }} />
          <Captions words={edit.words} theme={theme} variant={variant} maxChars={34} maxLines={1} maxWidth={edit.width * 0.8} />
        </>
      )}
      <GfxLayer edit={edit} theme={theme} only={['flash', 'leak']} />
      {letterbox && (
        <>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: edit.height * 0.1, background: '#000' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: edit.height * 0.1, background: '#000' }} />
        </>
      )}
      <GfxLayer edit={edit} theme={theme} only={['end']} />
      <Grain opacity={0.08} />
      {edit.audio && <Audio src={staticFile(edit.audio)} />}
    </AbsoluteFill>
  );
};
