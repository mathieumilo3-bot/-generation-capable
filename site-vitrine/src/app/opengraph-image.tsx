import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/constants";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          background: "#050505",
          color: "#F5F5F0",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 24,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#A3A39C",
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 999, background: "#CFC7B8" }} />
          Digital Revenue Systems
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 68,
            fontWeight: 600,
            lineHeight: 1.1,
            maxWidth: 900,
          }}
        >
          Votre présence digitale devrait travailler pour vous.
        </div>
        <div style={{ display: "flex", marginTop: 48, fontSize: 28, color: "#A3A39C" }}>
          {SITE_NAME}
        </div>
      </div>
    ),
    { ...size }
  );
}
