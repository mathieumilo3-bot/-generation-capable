import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Clos & Cadre — démonstration Génération Capable";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#F6F3EE",
          color: "#1D1B19",
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 22, letterSpacing: 4, textTransform: "uppercase", color: "#8A4B2F", fontFamily: "sans-serif" }}>
          Rénovation · Extension · Surélévation — Ouest parisien
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 104, lineHeight: 1 }}>
            Clos <span style={{ color: "#8A4B2F", margin: "0 24px" }}>&amp;</span> Cadre
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 38, lineHeight: 1.25, maxWidth: 900, color: "#5C554D" }}>
            Un site conçu pour transformer un savoir-faire de chantier en demandes de projets qualifiées.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#5C554D", fontFamily: "sans-serif", borderTop: "1px solid #D9CFBF", paddingTop: 24 }}>
          <span>Site de démonstration — entreprise fictive</span>
          <span>Concept stratégique et design — Génération Capable</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
