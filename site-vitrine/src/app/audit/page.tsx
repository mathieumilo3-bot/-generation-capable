import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { FAQJsonLd } from "@/components/schema/JsonLd";
import { AuditFunnel } from "./AuditFunnel";
import { AuditHero } from "./AuditHero";

export const metadata: Metadata = {
  title: "Diagnostic gratuit artisan : visibilité → demandes de devis",
  description:
    "Diagnostic gratuit pour artisans et entreprises du BTP : visibilité locale, confiance et conversion en demandes de devis.",
  alternates: { canonical: "/audit" },
};

const FAQS = [
  {
    question: "Le diagnostic est-il vraiment gratuit ?",
    answer: "Oui. La première lecture et le diagnostic sont gratuits et sans engagement.",
  },
  {
    question: "Que regardez-vous pour un artisan ?",
    answer:
      "Votre visibilité locale, vos preuves de savoir-faire, la confiance inspirée par votre présence en ligne et la facilité pour demander un devis.",
  },
];

export default function AuditPage() {
  return (
    <>
      <FAQJsonLd items={FAQS} />

      <Section className="pb-20 pt-9 sm:pb-24 sm:pt-14 lg:pt-16">
        <AuditHero />

        <div id="audit-form" className="mx-auto mt-7 max-w-2xl scroll-mt-24 sm:mt-9">
          <div className="rounded-[1.7rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.32)] sm:p-7">
            <AuditFunnel />
          </div>
        </div>
      </Section>
    </>
  );
}
