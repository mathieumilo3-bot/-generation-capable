import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#050505",
          color: "#cfc7b8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, letterSpacing: "-0.04em" }}>
          GC
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 10,
            width: 34,
            height: 2,
            background: "#cfc7b8",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
