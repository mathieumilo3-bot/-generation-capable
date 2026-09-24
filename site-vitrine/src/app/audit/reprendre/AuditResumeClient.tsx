"use client";

import { useEffect, useState } from "react";

export function AuditResumeClient() {
  const [status, setStatus] = useState<"loading" | "pending" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const raw = window.location.hash.replace(/^#/, "");
      const params = new URLSearchParams(raw);

      // Links from the V2 "votre vitrine est prête" e-mail open the preview directly.
      const previewId = params.get("preview") || "";
      const previewToken = params.get("t") || "";
      if (previewId && previewToken) {
        window.location.replace(`/audit/preview-v2/vitrine#id=${encodeURIComponent(previewId)}&t=${encodeURIComponent(previewToken)}`);
        return;
      }

      const id = params.get("id") || "";
      const token = params.get("token") || "";

      if (!id || !token) {
        if (!cancelled) setStatus("error");
        return;
      }

      try {
        const response = await fetch("/api/audit/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "result", id, token }),
          cache: "no-store",
        });
        if (!response.ok) {
          if (!cancelled) setStatus("error");
          return;
        }

        const payload = await response.json();
        if (payload?.status === "ready" && payload.report) {
          sessionStorage.setItem(
            "gc_audit_result",
            JSON.stringify({
              report: payload.report,
              entreprise: payload.entreprise || "",
              discovery: null,
              attribution: {},
            })
          );
          window.location.replace("/audit/merci");
          return;
        }

        if (!cancelled) setStatus("pending");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "error") {
    return (
      <div className="mx-auto max-w-xl rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-8 text-center">
        <h1 className="font-display text-2xl font-semibold">Lien de diagnostic invalide.</h1>
        <a href="/audit" className="mt-5 inline-block text-sm underline underline-offset-4">
          Relancer un diagnostic
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-8 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
        Diagnostic GC
      </p>
      <h1 className="font-display mt-3 text-2xl font-semibold">
        {status === "pending" ? "Votre analyse est presque prête." : "Ouverture de votre diagnostic…"}
      </h1>
      {status === "pending" && (
        <>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
            Le lien est bon, mais le diagnostic n’est pas encore finalisé. Réessayez dans quelques instants.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="audit-primary-cta mt-5 inline-flex min-h-[48px] items-center justify-center rounded-xl px-5 text-sm font-semibold"
          >
            Vérifier à nouveau →
          </button>
        </>
      )}
    </div>
  );
}
