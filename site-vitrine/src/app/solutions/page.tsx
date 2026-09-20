import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { SITE_URL } from "@/lib/constants";
import { SEO_LANDINGS } from "@/lib/data/seo-landings";

export const metadata: Metadata = {
  title: "Solutions web, SEO, acquisition et conversion",
  description:
    "Création de site, audit, SEO local, Google Business, génération de leads, landing pages et tunnels de vente pour entreprises, artisans et PME.",
  alternates: { canonical: "/solutions" },
};

export default function SolutionsPage() {
  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Solutions", url: `${SITE_URL}/solutions` },
        ]}
      />

      <Eyebrow>Solutions</Eyebrow>
      <h1 className="font-display text-balance mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Toutes les portes d&apos;entrée vers plus de visibilité, de demandes et de clients.
      </h1>
      <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[var(--color-muted)]">
        Chaque page répond à une intention précise : créer ou refaire un site, apparaître sur Google, améliorer le référencement local, générer des leads ou convertir davantage de visiteurs en demandes qualifiées.
      </p>

      <div className="mt-14 grid gap-4 md:grid-cols-2">
        {SEO_LANDINGS.map((page) => (
          <Link
            key={page.slug}
            href={`/solutions/${page.slug}`}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-muted)]"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
              {page.eyebrow}
            </p>
            <h2 className="font-display mt-3 text-xl font-semibold text-[var(--color-text)]">
              {page.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
              {page.metaDescription}
            </p>
          </Link>
        ))}
      </div>
    </Section>
  );
}
