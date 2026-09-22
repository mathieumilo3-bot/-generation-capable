import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { FAQJsonLd } from "@/components/schema/JsonLd";
import { AuditFunnel } from "./AuditFunnel";
import { AuditHero } from "./AuditHero";

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
        <AuditHero />
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

      </Section>
    </>
  );
}
