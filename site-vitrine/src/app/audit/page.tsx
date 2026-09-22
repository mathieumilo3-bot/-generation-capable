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
    <div className="audit-experience">
      <FAQJsonLd items={FAQS} />

      <Section className="pb-20 pt-8 sm:pb-24 sm:pt-12 lg:pt-14">
        <AuditHero />

        <div id="audit-form" className="mx-auto mt-6 max-w-2xl scroll-mt-24 sm:mt-8">
          <div className="audit-result-glow rounded-[1.7rem] border border-[var(--color-border-strong)] bg-[rgba(10,10,10,0.94)] p-4 backdrop-blur-xl sm:p-7">
            <AuditFunnel />
          </div>
        </div>
      </Section>
    </div>
  );
}
