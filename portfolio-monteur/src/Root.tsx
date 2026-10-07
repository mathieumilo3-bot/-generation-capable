import React from 'react';
import { CalculateMetadataFunction, Composition } from 'remotion';
import './fonts';
import { AvantApres, avantApresDuration, AvantApresProps } from './compositions/AvantApres';
import { Reel, ReelProps } from './compositions/Reel';
import { YouTube, YouTubeProps } from './compositions/YouTube';
import { demoEdit } from './demo';

const fromEdit: CalculateMetadataFunction<{ edit: ReelProps['edit'] }> = ({ props }) => ({
  durationInFrames: Math.round(props.edit.duration * props.edit.fps),
  fps: props.edit.fps,
  width: props.edit.width,
  height: props.edit.height,
});

export const Root: React.FC = () => (
  <>
    <Composition
      id="Reel"
      component={Reel}
      defaultProps={{ edit: demoEdit('9:16'), variant: 'bold' } as ReelProps}
      calculateMetadata={fromEdit as CalculateMetadataFunction<ReelProps>}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="YouTube"
      component={YouTube}
      defaultProps={{ edit: demoEdit('16:9'), captions: true, variant: 'editorial' } as YouTubeProps}
      calculateMetadata={fromEdit as CalculateMetadataFunction<YouTubeProps>}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="Teaser"
      component={YouTube}
      defaultProps={{ edit: demoEdit('16:9'), captions: false, letterbox: true } as YouTubeProps}
      calculateMetadata={fromEdit as CalculateMetadataFunction<YouTubeProps>}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="AvantApres"
      component={AvantApres}
      defaultProps={
        {
          edit: demoEdit('9:16'),
          reel: 'test/reel.mp4',
          rawSrc: 'test/talk.mp4',
          intro: { srcIn: 0, dur: 3 },
          wave: Array.from({ length: 160 }, (_, i) => 0.25 + 0.7 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.11))),
          srcMin: 0,
          srcMax: 10,
          credit: 'Ton Nom',
        } as AvantApresProps
      }
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.round(avantApresDuration(props) * props.edit.fps),
        fps: props.edit.fps,
        width: 1920,
        height: 1080,
      })}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);
