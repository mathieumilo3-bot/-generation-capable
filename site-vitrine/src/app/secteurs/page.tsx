import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";
import { SectorCard } from "@/components/cards/SectorCard";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { SITE_URL } from "@/lib/constants";
import { SECTORS } from "@/lib/data/sectors";

export const metadata: Metadata = {
  title: "Secteurs",
  description:
    "Des systèmes digitaux adaptés à votre activité : restaurants, cabinets, immobilier, beauté, artisans, services, coachs et entreprises locales.",
  alternates: { canonical: "/secteurs" },
};

export default function SecteursPage() {
  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Secteurs", url: `${SITE_URL}/secteurs` },
        ]}
      />
      <Eyebrow>Secteurs</Eyebrow>
      <h1 className="font-display text-balance mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Des systèmes adaptés à votre activité.
      </h1>
      <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
        Chaque secteur a ses propres frictions. Sélectionnez le vôtre pour
        voir le problème typique, le système recommandé et un exemple
        d&apos;application.
      </p>

      <div className="mt-14">
        {SECTORS.map((sector) => (
          <SectorCard key={sector.slug} sector={sector} />
        ))}
      </div>
    </Section>
  );
}
