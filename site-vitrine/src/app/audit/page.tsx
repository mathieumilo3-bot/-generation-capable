import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { FAQJsonLd } from "@/components/schema/JsonLd";
import { AuditFunnel } from "./AuditFunnel";
import { AuditHero } from "./AuditHero";
import { AuditOfferSections } from "./AuditOfferSections";

export const metadata: Metadata = {
  title: "Site web artisan : création, visibilité & diagnostic gratuit | GC",
  description:
    "GC crée et optimise des sites web pour artisans et entreprises du BTP : visibilité locale, pages métiers, preuves et parcours de devis. Commencez par le diagnostic gratuit.",
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
  {
    question: "Je n’ai pas encore de site internet, le diagnostic sert-il quand même ?",
    answer:
      "Oui. GC peut analyser votre présence publique actuelle et identifier la base à construire : site web artisan, pages services, visibilité locale, preuves et parcours de devis.",
  },
  {
    question: "GC crée aussi les sites internet ?",
    answer:
      "Oui. Le diagnostic sert de point de départ. GC peut ensuite concevoir ou refondre le site, structurer les pages métiers et locales, intégrer les preuves et simplifier la demande de devis.",
  },
];

export default function AuditPage() {
  return (
    <div className="audit-experience">
      <FAQJsonLd items={FAQS} />

      <Section className="pb-20 pt-6 sm:pb-24 sm:pt-10 lg:pt-12">
        <AuditHero />

        <div id="audit-form" className="mx-auto mt-5 max-w-2xl scroll-mt-24 sm:mt-7">
          <div className="audit-form-shell rounded-[1.9rem] p-[18px] backdrop-blur-xl sm:p-7">
            <AuditFunnel />
          </div>
        </div>

        <AuditOfferSections />
      </Section>
    </div>
  );
}
