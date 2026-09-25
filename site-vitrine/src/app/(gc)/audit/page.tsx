import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";
import { AuditFunnel } from "./AuditFunnel";

export const metadata: Metadata = {
  title: "Analyser mon entreprise — Capable Audit",
  description:
    "Obtenez un diagnostic initial de votre présence digitale : visibilité, crédibilité, conversion et parcours client. Sans engagement.",
  alternates: { canonical: "/audit" },
};

const AXES = ["Visibilité", "Crédibilité", "Conversion", "Parcours"];

export default function AuditPage() {
  return (
    <Section className="py-16 sm:py-24 lg:py-28">
      <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:gap-20">
        <div className="lg:sticky lg:top-28">
          <Eyebrow>Capable Audit</Eyebrow>
          <h1 className="font-display text-balance mt-5 text-4xl font-semibold leading-[1.04] tracking-tight sm:text-5xl lg:text-6xl">
            Regardons ce que
            <br />
            votre présence
            <br />
            <span className="gold-text">produit vraiment.</span>
          </h1>
          <p className="mt-7 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-base">
            Un diagnostic initial de votre présence digitale pour identifier
            les points de friction et les opportunités les plus évidentes.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-2 sm:max-w-sm">
            {AXES.map((axis, index) => (
              <div
                key={axis}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                  0{index + 1}
                </span>
                <p className="mt-2 font-display text-sm font-medium">{axis}</p>
              </div>
            ))}
          </div>

          <p className="mt-7 text-xs text-[var(--color-muted)]">
            4 étapes · Sans engagement · Réponse personnalisée
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.25)] sm:p-10">
          <div className="mb-8 flex items-center justify-between border-b border-[var(--color-border)] pb-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-muted)]">
                Diagnostic initial
              </p>
              <p className="mt-1 font-display text-sm font-medium">Votre entreprise</p>
            </div>
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              En ligne
            </span>
          </div>
          <AuditFunnel />
        </div>
      </div>
    </Section>
  );
}
