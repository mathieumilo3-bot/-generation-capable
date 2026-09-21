import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { SITE_URL } from "@/lib/constants";
import { LEGAL_ENTITY } from "@/lib/data/legal";

export const metadata: Metadata = {
  title: "À propos de GC Agence",
  description:
    "Découvrez GC Agence, ses domaines d'intervention : création de site internet, SEO, marketing digital, acquisition et génération de leads.",
  alternates: { canonical: "/a-propos" },
};

const EXPERTISES = [
  ["Création de site internet", "/creation-site-internet"],
  ["Référencement SEO", "/seo"],
  ["Marketing digital", "/solutions/agence-marketing-digital"],
  ["Référencement local", "/solutions/referencement-local"],
  ["Génération de leads", "/solutions/generation-de-leads"],
  ["Acquisition B2B", "/solutions/generation-leads-b2b"],
  ["Google Ads", "/solutions/publicite-google-ads"],
  ["Audit digital", "/audit"],
] as const;

export default function AboutPage() {
  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "À propos de GC Agence", url: `${SITE_URL}/a-propos` },
        ]}
      />
      <Eyebrow>GC Agence</Eyebrow>
      <h1 className="font-display mt-4 max-w-4xl text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Une agence orientée visibilité, acquisition et conversion.
      </h1>
      <p className="mt-6 max-w-3xl text-[16px] leading-relaxed text-[var(--color-muted)]">
        GC Agence regroupe des services de création de site internet, référencement naturel,
        marketing digital et acquisition. L&apos;objectif est de relier la visibilité d&apos;une
        entreprise à un parcours capable de produire des demandes qualifiées et de les convertir
        en opportunités commerciales.
      </p>

      <section className="mt-10 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Entreprise</p>
          <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{LEGAL_ENTITY.denomination}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{LEGAL_ENTITY.formeJuridique}</p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">SIREN</p>
          <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{LEGAL_ENTITY.siren}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <a
              href="https://www.pappers.fr/entreprise/le-dorven-enzo-981319957"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Vérifier sur Pappers
            </a>
            <a
              href="https://www.societe.com/societe/monsieur-enzo-le-dorven-981319957.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
            >
              Société.com
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">Siège</p>
          <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">Pontivy, Morbihan</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Prestations proposées en France</p>
        </div>
      </section>

      <section className="mt-14 border-t border-[var(--color-border)] pt-10">
        <h2 className="font-display text-2xl font-semibold">Domaines d&apos;intervention</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {EXPERTISES.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm font-medium transition-colors hover:border-[var(--color-muted)]"
            >
              {label} →
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-14 max-w-3xl border-t border-[var(--color-border)] pt-10">
        <h2 className="font-display text-2xl font-semibold">Comment GC Agence travaille</h2>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-muted)]">
          Le diagnostic sert à identifier les blocages de visibilité, de trafic, de conversion et
          de suivi avant de recommander les actions adaptées. Les pages du site détaillent ensuite
          les leviers par besoin et par secteur, sans créer de résultats clients ou d&apos;implantations
          locales qui ne seraient pas réels.
        </p>
        <Link
          href="/audit"
          className="mt-7 inline-flex rounded-full bg-[var(--color-text)] px-6 py-3 text-sm font-semibold text-[var(--color-bg)]"
        >
          Analyser mon entreprise →
        </Link>
      </section>
    </Section>
  );
}
