import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { PRIMARY_CTA_LABEL, SITE_URL } from "@/lib/constants";
import { getSectorBySlug, SECTORS } from "@/lib/data/sectors";

type Props = { params: Promise<{ secteur: string }> };

const SECTOR_SOLUTIONS: Record<string, { href: string; label: string }[]> = {
  restaurants: [
    { href: "/solutions/marketing-digital-restaurant", label: "Marketing digital restaurant" },
    { href: "/solutions/google-business-profile", label: "Google Business Profile" },
    { href: "/solutions/strategie-reseaux-sociaux", label: "Stratégie réseaux sociaux" },
  ],
  cabinets: [
    { href: "/solutions/agence-marketing-digital", label: "Marketing digital" },
    { href: "/solutions/referencement-local", label: "Référencement local" },
    { href: "/solutions/landing-page", label: "Landing page" },
  ],
  immobilier: [
    { href: "/solutions/generation-de-leads", label: "Génération de leads" },
    { href: "/solutions/publicite-meta-ads", label: "Meta Ads" },
    { href: "/solutions/strategie-reseaux-sociaux", label: "Réseaux sociaux" },
  ],
  beaute: [
    { href: "/solutions/marketing-local", label: "Marketing local" },
    { href: "/solutions/google-business-profile", label: "Google Business Profile" },
    { href: "/solutions/publicite-meta-ads", label: "Meta Ads" },
  ],
  artisans: [
    { href: "/solutions/creation-site-artisan", label: "Création de site artisan" },
    { href: "/solutions/marketing-digital-btp", label: "Marketing digital BTP" },
    { href: "/solutions/marketing-digital-artisan", label: "Marketing digital artisan" },
  ],
  services: [
    { href: "/solutions/agence-marketing-digital", label: "Marketing digital" },
    { href: "/solutions/generation-de-leads", label: "Génération de leads" },
    { href: "/solutions/tunnel-de-vente", label: "Tunnel de vente" },
  ],
  coachs: [
    { href: "/solutions/content-marketing", label: "Content marketing" },
    { href: "/solutions/strategie-reseaux-sociaux", label: "Stratégie réseaux sociaux" },
    { href: "/solutions/tunnel-de-vente", label: "Tunnel de vente" },
  ],
  "entreprises-locales": [
    { href: "/solutions/marketing-local", label: "Marketing local" },
    { href: "/solutions/referencement-local", label: "Référencement local" },
    { href: "/solutions/google-business-profile", label: "Google Business Profile" },
  ],
};

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
  const relatedSolutions = SECTOR_SOLUTIONS[sector.slug] ?? [];

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

      {relatedSolutions.length > 0 && (
        <section className="mt-14 border-t border-[var(--color-border)] pt-10">
          <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
            Solutions liées à votre secteur
          </h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {relatedSolutions.map((solution) => (
              <Link
                key={solution.href}
                href={solution.href}
                className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-muted)]"
              >
                {solution.label}
              </Link>
            ))}
          </div>
        </section>
      )}

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
