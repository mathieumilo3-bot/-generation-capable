import React from "react";
import { registerRoot, Composition } from "remotion";
import { Habillage, type HabillageProps } from "./Habillage";

const defaultProps: HabillageProps = {
  videoSrc: "",
  captions: [],
  zoomWindows: [],
  captionStyle: "bold_dynamic",
};

/**
 * durationInFrames/fps/width/height sont recalculés à chaque rendu via
 * calculateMetadata à partir des inputProps réels (durée du montage,
 * format 9:16) — jamais figés ici. Voir packages/render/src/remotion.ts
 * pour l'appel programmatique (renderMedia + inputProps).
 */
const RemotionRoot: React.FC = () => (
  <Composition
    id="Habillage"
    component={Habillage}
    durationInFrames={30}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={defaultProps}
    calculateMetadata={async ({ props }) => {
      const p = props as HabillageProps & { durationInFrames?: number; fps?: number };
      return {
        durationInFrames: p.durationInFrames ?? 30,
        fps: p.fps ?? 30,
      };
    }}
  />
);

registerRoot(RemotionRoot);
