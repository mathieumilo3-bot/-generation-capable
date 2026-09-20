import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { SectorCard } from "@/components/cards/SectorCard";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { SITE_URL } from "@/lib/constants";
import { SECTORS } from "@/lib/data/sectors";

export const metadata: Metadata = {
  title: "Secteurs : marketing digital, SEO et acquisition par métier",
  description:
    "Stratégies digitales adaptées aux restaurants, cabinets, immobilier, beauté, artisans, BTP, services, coachs et entreprises locales.",
  alternates: { canonical: "/secteurs" },
};

const PRIORITY_VERTICALS = [
  {
    href: "/solutions/marketing-digital-artisan",
    label: "Marketing digital artisan",
  },
  {
    href: "/solutions/marketing-digital-btp",
    label: "Marketing digital BTP",
  },
  {
    href: "/solutions/creation-site-dentiste",
    label: "Site internet dentiste",
  },
  {
    href: "/solutions/marketing-entreprise-nettoyage",
    label: "Marketing entreprise de nettoyage",
  },
  {
    href: "/solutions/marketing-digital-restaurant",
    label: "Marketing digital restaurant",
  },
  {
    href: "/solutions/marketing-evenementiel-digital",
    label: "Marketing digital événementiel",
  },
] as const;

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
      <h1 className="font-display text-balance mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        SEO, marketing digital et acquisition adaptés à votre activité.
      </h1>
      <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
        Chaque secteur a ses propres recherches, preuves et frictions. Commencez par votre activité,
        puis accédez aux pages métier les plus proches de votre besoin pour relier secteur,
        service et intention Google.
      </p>

      <nav aria-label="Solutions métier prioritaires" className="mt-9 flex flex-wrap gap-3">
        {PRIORITY_VERTICALS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-muted)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-14">
        {SECTORS.map((sector) => (
          <SectorCard key={sector.slug} sector={sector} />
        ))}
      </div>
    </Section>
  );
}
