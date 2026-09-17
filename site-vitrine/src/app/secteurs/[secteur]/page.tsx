import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { PRIMARY_CTA_LABEL, SITE_URL } from "@/lib/constants";
import { getSectorBySlug, SECTORS } from "@/lib/data/sectors";

type Props = { params: Promise<{ secteur: string }> };

export function generateStaticParams() {
  return SECTORS.map((sector) => ({ secteur: sector.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { secteur } = await params;
  const sector = getSectorBySlug(secteur);
  if (!sector) return {};

  return {
    title: sector.label,
    description: sector.metaDescription,
    alternates: { canonical: `/secteurs/${sector.slug}` },
  };
}

export default async function SectorPage({ params }: Props) {
  const { secteur } = await params;
  const sector = getSectorBySlug(secteur);
  if (!sector) notFound();

  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Secteurs", url: `${SITE_URL}/secteurs` },
          { name: sector.name, url: `${SITE_URL}/secteurs/${sector.slug}` },
        ]}
      />
      <Eyebrow>{sector.label}</Eyebrow>
      <h1 className="font-display text-balance mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Un système digital pensé pour {sector.forPhrase}.
      </h1>

      <div className="mt-14 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
            Le problème typique
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
            {sector.problem}
          </p>
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
            Le système recommandé
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
            {sector.recommendedSystem}
          </p>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
        <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
          Exemple d&apos;application
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
          {sector.example}
        </p>
      </div>

      <div className="mt-14">
        <Button
          href="/audit"
          variant="primary"
          trackEvent="cta_clicked"
          trackPayload={{ location: `sector_${sector.slug}` }}
        >
          {PRIMARY_CTA_LABEL} →
        </Button>
      </div>
    </Section>
  );
}
