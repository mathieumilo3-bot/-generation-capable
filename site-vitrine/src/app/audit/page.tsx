import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { FAQJsonLd } from "@/components/schema/JsonLd";
import { AuditFunnel } from "./AuditFunnel";

export const metadata: Metadata = {
  title: "Audit gratuit : transformez votre site en clients",
  description:
    "Audit gratuit de votre site : visibilité Google, crédibilité et conversion. Identifiez rapidement ce qui bloque vos demandes de devis et vos prospects.",
  alternates: { canonical: "/audit" },
};

const FAQS = [
  {
    question: "L'audit est-il vraiment gratuit ?",
    answer:
      "Oui. Le diagnostic initial est gratuit et sans engagement.",
  },
  {
    question: "Que contient l'audit ?",
    answer:
      "Nous regardons votre visibilité, votre crédibilité et votre capacité à transformer les visiteurs en demandes.",
  },
];

export default function AuditPage() {
  return (
    <>
      <FAQJsonLd items={FAQS} />

      <Section className="pb-10 pt-10 sm:pb-14 sm:pt-16 lg:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)] sm:text-xs">
            Audit gratuit · Sans engagement
          </div>

          <h1 className="font-display mx-auto mt-6 max-w-3xl text-balance text-[2.65rem] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            Votre site vous ramène
            <span className="gold-text"> vraiment des clients ?</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-lg">
            On identifie rapidement ce qui bloque vos demandes de devis,
            votre visibilité Google et votre conversion.
          </p>

          <div className="mt-8 flex justify-center">
            <Button
              href="#audit-form"
              variant="primary"
              className="min-h-14 w-full max-w-sm px-8 text-base sm:w-auto"
              trackEvent="audit_cta_clicked"
              trackPayload={{ location: "audit_hero" }}
            >
              Obtenir mon audit gratuit →
            </Button>
          </div>

          <p className="mt-4 text-xs text-[var(--color-muted)]">
            Gratuit · Rapide · Réponse personnalisée
          </p>

          <div className="mx-auto mt-9 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
            {[
              ["01", "Visibilité"],
              ["02", "Crédibilité"],
              ["03", "Conversion"],
            ].map(([number, label]) => (
              <div
                key={label}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-4 sm:px-5"
              >
                <span className="text-[9px] font-semibold tracking-[0.18em] text-[var(--color-accent)]">
                  {number}
                </span>
                <p className="font-display mt-1.5 text-xs font-medium sm:text-sm">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section id="audit-form" className="scroll-mt-24 pb-20 pt-4 sm:pb-28 sm:pt-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[1.6rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:p-8 lg:p-10">
            <div className="mb-7 flex items-center justify-between border-b border-[var(--color-border)] pb-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
                  Diagnostic gratuit
                </p>
                <p className="font-display mt-1 text-base font-medium">
                  On commence par votre site
                </p>
              </div>

              <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-accent)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                1 min
              </span>
            </div>

            <AuditFunnel />
          </div>

          <p className="mt-5 text-center text-xs leading-relaxed text-[var(--color-muted)]">
            Pas de blabla. On vous montre ce qui bloque et quoi corriger en priorité.
          </p>
        </div>
      </Section>
    </>
  );
}
