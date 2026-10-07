import React from 'react';
import { Easing, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Clip, Edit, clamp, sampleTrack, zoomAt } from '../lib/edit';

// Un plan de la source, recadré pour la sortie (9:16 ou 16:9) en suivant le visage.
export const Footage: React.FC<{ clip: Clip; edit: Edit; filter?: string; muted?: boolean; volume?: number }> = ({
  clip,
  edit,
  filter,
  muted = true,
  volume = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const face = sampleTrack(clip.track ? edit.tracks[clip.track] : undefined, clip.srcIn + t);
  let z = zoomAt(clip, t);
  if (clip.punch) {
    z *= interpolate(frame, [0, 8], [1.07, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  }
  const sw = clip.w ?? edit.srcW;
  const sh = clip.h ?? edit.srcH;
  const cover = Math.max(width / sw, height / sh);
  const W = sw * cover * z;
  const H = sh * cover * z;
  const fy = clip.focusY ?? (height > width ? 0.37 : 0.4);
  const left = clamp(width / 2 - face.cx * W, width - W, 0);
  const top = clamp(height * fy - face.cy * H, height - H, 0);
  return (
    <OffthreadVideo
      src={staticFile(clip.src)}
      trimBefore={Math.round(clip.srcIn * fps)}
      muted={muted}
      volume={volume}
      style={{ position: 'absolute', left, top, width: W, height: H, filter, maxWidth: 'none' }}
    />
  );
};

export const ClipsTrack: React.FC<{ edit: Edit; filter?: string }> = ({ edit, filter }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {edit.clips.map((c, i) => {
        const from = Math.round(c.start * fps);
        const dur = Math.max(1, Math.round(c.end * fps) - from);
        return (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none" name={`plan ${i + 1}`}>
            <Footage clip={c} edit={edit} filter={filter} />
          </Sequence>
        );
      })}
    </>
  );
};
