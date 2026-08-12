import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

export interface HabillageCaptionWord {
  word: string;
  startFrame: number;
  endFrame: number;
  emphasize: boolean;
}

export interface HabillageCaption {
  startFrame: number;
  endFrame: number;
  words: HabillageCaptionWord[];
}

export interface HabillageZoomWindow {
  startFrame: number;
  endFrame: number;
  scale: number;
}

export interface HabillageProps {
  /** Chemin RELATIF à publicDir (voir packages/render/src/remotion.ts) — jamais un chemin absolu ni une URL. */
  videoSrc: string;
  captions: HabillageCaption[];
  zoomWindows: HabillageZoomWindow[];
  captionStyle: "bold_dynamic" | "minimal_clean" | "karaoke_word" | "classic_lowerthird";
}

/**
 * La seule responsabilité de cette composition : l'habillage (sous-titres
 * animés + zoom), jamais le montage lui-même. La vidéo source est déjà
 * coupée/assemblée par FFmpeg (packages/render/src/ffmpeg.ts) — Remotion
 * ne fait que la recomposer avec une couche de texte et un effet de zoom
 * interpolé image par image, ce qu'un graphe de filtres ffmpeg exprime
 * très mal (§4 du dossier stratégique : Remotion pour l'habillage, FFmpeg
 * pour le reste).
 */
export const Habillage: React.FC<HabillageProps> = ({ videoSrc, captions, zoomWindows, captionStyle }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const activeZoom = zoomWindows.find((z) => frame >= z.startFrame && frame <= z.endFrame);
  let scale = 1;
  if (activeZoom) {
    const rampFrames = 8;
    const inRamp = interpolate(frame, [activeZoom.startFrame, activeZoom.startFrame + rampFrames], [1, activeZoom.scale], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const outRamp = interpolate(
      frame,
      [activeZoom.endFrame - rampFrames, activeZoom.endFrame],
      [activeZoom.scale, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    scale = frame > activeZoom.endFrame - rampFrames ? outRamp : inRamp;
  }

  const activeCaption = captions.find((c) => frame >= c.startFrame && frame <= c.endFrame);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <OffthreadVideo
        src={staticFile(videoSrc)}
        style={{
          width,
          height,
          objectFit: "cover",
          transform: `scale(${scale})`,
          transformOrigin: "50% 50%",
        }}
      />
      {activeCaption ? <CaptionOverlay caption={activeCaption} frame={frame} style={captionStyle} width={width} /> : null}
    </AbsoluteFill>
  );
};

const CaptionOverlay: React.FC<{
  caption: HabillageCaption;
  frame: number;
  style: HabillageProps["captionStyle"];
  width: number;
}> = ({ caption, frame, style, width }) => {
  const bold = style === "bold_dynamic" || style === "karaoke_word";
  const fontSize = bold ? 58 : 44;
  return (
    <div
      style={{
        position: "absolute",
        bottom: "12%",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        padding: "0 6%",
      }}
    >
      <div
        style={{
          maxWidth: width * 0.88,
          textAlign: "center",
          fontFamily: "Helvetica, Arial, sans-serif",
          fontWeight: bold ? 800 : 600,
          fontSize,
          lineHeight: 1.25,
          color: "white",
          textShadow: "0 2px 10px rgba(0,0,0,0.85)",
          ...(style === "classic_lowerthird"
            ? { background: "rgba(0,0,0,0.55)", padding: "10px 24px", borderRadius: 8 }
            : {}),
        }}
      >
        {caption.words.map((w, i) => {
          const active = style === "karaoke_word" ? frame >= w.startFrame && frame <= w.endFrame : true;
          const emphasized = w.emphasize && frame >= w.startFrame;
          return (
            <span
              key={i}
              style={{
                marginRight: 10,
                color: emphasized ? "#ffd23f" : active ? "white" : "rgba(255,255,255,0.55)",
              }}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
