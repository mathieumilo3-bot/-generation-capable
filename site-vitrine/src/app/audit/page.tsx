import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { FAQJsonLd } from "@/components/schema/JsonLd";
import { AuditFunnel } from "./AuditFunnel";

export const metadata: Metadata = {
  title: "Audit gratuit artisan : site, Google & demandes de devis",
  description:
    "Audit gratuit pour artisans et entreprises du BTP : visibilité locale, crédibilité, réalisations et parcours de demande de devis.",
  alternates: { canonical: "/audit" },
};

const FAQS = [
  {
    question: "L'audit est-il vraiment gratuit ?",
    answer: "Oui. Le diagnostic initial est gratuit et sans engagement.",
  },
  {
    question: "Que regardez-vous pour un artisan ?",
    answer:
      "Votre visibilité locale, la clarté de vos métiers et zones, vos preuves de savoir-faire et la facilité avec laquelle un prospect peut demander un devis.",
  },
];

export default function AuditPage() {
  return (
    <>
      <FAQJsonLd items={FAQS} />

      <Section className="pb-10 pt-10 sm:pb-14 sm:pt-16 lg:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mx-auto inline-flex items-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)] sm:text-xs">
            Audit artisans & BTP · Gratuit
          </div>

          <h1 className="font-display mx-auto mt-6 max-w-3xl text-balance text-[2.65rem] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            Votre site vous ramène
            <span className="gold-text"> vraiment des demandes de devis ?</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-lg">
            On vérifie ce qu&apos;un client voit avant de vous appeler :
            Google, vos métiers, vos réalisations, votre zone et la prise de contact.
          </p>

          <div className="mt-8 flex justify-center">
            <Button
              href="#audit-form"
              variant="primary"
              className="min-h-14 w-full max-w-sm px-8 text-base sm:w-auto"
              trackEvent="audit_cta_clicked"
              trackPayload={{ location: "audit_hero" }}
            >
              Vérifier mon site gratuitement →
            </Button>
          </div>

          <p className="mt-4 text-xs text-[var(--color-muted)]">
            Gratuit · Sans engagement · Réponse personnalisée
          </p>

          <div className="mx-auto mt-9 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
            {[
              ["01", "Être trouvé"],
              ["02", "Rassurer"],
              ["03", "Obtenir un devis"],
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
                  Diagnostic artisan
                </p>
                <p className="font-display mt-1 text-base font-medium">
                  On commence par votre présence en ligne
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
            Pas de jargon. On vous montre ce qui peut freiner une vraie demande de devis.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-4xl border-t border-[var(--color-border)] pt-10 sm:mt-16">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "Google & zone",
                body: "Vos métiers et zones doivent être compris rapidement par Google comme par le prospect.",
              },
              {
                title: "Réalisations & confiance",
                body: "Photos, avis, garanties et preuves doivent rassurer avant le premier appel.",
              },
              {
                title: "Devis & rappel",
                body: "La prise de contact doit être simple et donner assez d'informations pour rappeler vite.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
              >
                <h2 className="font-display text-base font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)] px-5 py-4 text-center">
            <p className="text-sm leading-relaxed">
              <span className="font-semibold">On ne refait pas tout pour faire joli.</span>{" "}
              On priorise ce qui peut réellement aider à générer et mieux traiter vos demandes.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
