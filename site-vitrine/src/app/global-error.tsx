"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: it replaces the root layout, so it cannot rely on
 * the site's fonts, CSS variables or components — everything is inlined.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] root layout error:", error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#050505",
          color: "#f5f5f0",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "32rem", textAlign: "center" }}>
          <p
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#e5b94a",
              margin: 0,
            }}
          >
            Erreur
          </p>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 600,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
              marginTop: "1rem",
            }}
          >
            Le site est momentanément indisponible.
          </h1>
          <p style={{ marginTop: "1.5rem", color: "#a3a39c", lineHeight: 1.6 }}>
            Un incident technique empêche le chargement. Merci de réessayer
            dans un instant.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "2.5rem",
              border: "none",
              borderRadius: "999px",
              background: "#f5f5f0",
              color: "#050505",
              padding: "14px 28px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
          {error.digest && (
            <p style={{ marginTop: "2rem", fontSize: "12px", color: "#a3a39c" }}>
              Référence de l&apos;incident : {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
