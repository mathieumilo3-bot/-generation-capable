import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { SITE_URL } from "@/lib/constants";
import { SEO_LANDINGS } from "@/lib/data/seo-landings";

export const metadata: Metadata = {
  title: "Solutions web, SEO, marketing digital et acquisition",
  description:
    "Création de site, SEO, marketing digital, Google Ads, génération de leads, acquisition B2B, conversion et stratégies métier pour artisans, TPE et PME.",
  alternates: { canonical: "/solutions" },
};

const CLUSTERS = [
  {
    id: "site-conversion",
    title: "Sites, conversion et tunnels",
    description:
      "Pour créer, refaire ou améliorer les pages qui transforment une visite en demande, devis ou rendez-vous.",
    slugs: [
      "audit-site-internet",
      "refonte-site-internet",
      "landing-page",
      "tunnel-de-vente",
      "site-internet-pme",
      "creation-site-artisan",
      "creation-site-dentiste",
    ],
  },
  {
    id: "seo-local",
    title: "SEO, Google et visibilité locale",
    description:
      "Pour apparaître sur Google, renforcer les positions organiques et capter les recherches locales à forte intention.",
    slugs: [
      "audit-seo",
      "visibilite-google",
      "referencement-local",
      "google-business-profile",
      "referencement-artisan",
      "marketing-local",
    ],
  },
  {
    id: "marketing-acquisition",
    title: "Marketing digital et acquisition",
    description:
      "Pour relier stratégie, publicité, contenu, réseaux sociaux et automatisation à des demandes mesurables.",
    slugs: [
      "agence-marketing-digital",
      "strategie-marketing-digital",
      "marketing-digital-pme",
      "audit-marketing-digital",
      "generation-de-leads",
      "publicite-google-ads",
      "publicite-meta-ads",
      "strategie-reseaux-sociaux",
      "content-marketing",
      "automatisation-marketing",
      "growth-marketing",
      "webmarketing",
      "communication-digitale",
      "consultant-marketing-digital",
    ],
  },
  {
    id: "b2b",
    title: "B2B, pipeline et génération de leads",
    description:
      "Pour les entreprises qui veulent transformer leur visibilité en leads qualifiés, rendez-vous et opportunités commerciales.",
    slugs: [
      "generation-leads-b2b",
      "agence-acquisition-b2b",
      "marketing-b2b",
      "inbound-marketing",
    ],
  },
  {
    id: "metiers",
    title: "Stratégies par métier",
    description:
      "Des pages adaptées aux recherches, preuves, parcours et canaux qui comptent réellement dans chaque secteur.",
    slugs: [
      "marketing-digital-artisan",
      "acquisition-artisan",
      "marketing-digital-btp",
      "marketing-digital-dentiste",
      "marketing-entreprise-nettoyage",
      "marketing-evenementiel-digital",
      "marketing-digital-restaurant",
    ],
  },
] as const;

const bySlug = new Map(SEO_LANDINGS.map((page) => [page.slug, page]));

export default function SolutionsPage() {
  const linkedSlugs = new Set(CLUSTERS.flatMap((cluster) => cluster.slugs));
  const uncategorized = SEO_LANDINGS.filter((page) => !linkedSlugs.has(page.slug as never));

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
        Le maillage est organisé par intention : site et conversion, SEO local, marketing digital,
        acquisition B2B et stratégies métier. Chaque cluster renvoie vers des pages commerciales
        distinctes afin d&apos;aider les visiteurs — et les moteurs — à comprendre quelles pages sont
        les plus importantes pour chaque sujet.
      </p>

      <nav aria-label="Thématiques principales" className="mt-10 flex flex-wrap gap-3">
        {CLUSTERS.map((cluster) => (
          <Link
            key={cluster.id}
            href={`#${cluster.id}`}
            className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-muted)]"
          >
            {cluster.title}
          </Link>
        ))}
      </nav>

      <div className="mt-16 space-y-16">
        {CLUSTERS.map((cluster) => {
          const pages = cluster.slugs
            .map((slug) => bySlug.get(slug))
            .filter((page): page is NonNullable<typeof page> => Boolean(page));

          return (
            <section key={cluster.id} id={cluster.id} className="scroll-mt-28">
              <div className="max-w-2xl">
                <h2 className="font-display text-2xl font-semibold text-[var(--color-text)] sm:text-3xl">
                  {cluster.title}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                  {cluster.description}
                </p>
              </div>

              <div className="mt-7 grid gap-4 md:grid-cols-2">
                {pages.map((page) => (
                  <Link
                    key={page.slug}
                    href={`/solutions/${page.slug}`}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-muted)]"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                      {page.eyebrow}
                    </p>
                    <h3 className="font-display mt-3 text-xl font-semibold text-[var(--color-text)]">
                      {page.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                      {page.metaDescription}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        {uncategorized.length > 0 && (
          <section>
            <h2 className="font-display text-2xl font-semibold text-[var(--color-text)]">
              Autres solutions
            </h2>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {uncategorized.map((page) => (
                <Link
                  key={page.slug}
                  href={`/solutions/${page.slug}`}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-muted)]"
                >
                  <h3 className="font-display text-xl font-semibold text-[var(--color-text)]">
                    {page.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                    {page.metaDescription}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </Section>
  );
}
