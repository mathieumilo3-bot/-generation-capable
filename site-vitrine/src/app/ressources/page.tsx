import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { ArticleCard } from "@/components/cards/ArticleCard";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { SITE_URL } from "@/lib/constants";
import { ARTICLES } from "@/lib/data/articles";

export const metadata: Metadata = {
  title: "Ressources marketing digital, SEO et acquisition",
  description:
    "Guides pratiques sur le SEO, la création de site, le marketing digital, Google Ads, la génération de leads, le B2B et la conversion.",
  alternates: { canonical: "/ressources" },
};

const TOPIC_HUBS = [
  {
    title: "Créer ou refaire un site",
    href: "/creation-site-internet",
    description: "Prix, structure, refonte et pages qui convertissent.",
  },
  {
    title: "Être visible sur Google",
    href: "/seo",
    description: "SEO, visibilité organique, local et Google Business.",
  },
  {
    title: "Marketing digital",
    href: "/solutions/agence-marketing-digital",
    description: "Stratégie, Ads, contenu, social et acquisition.",
  },
  {
    title: "Générer des leads",
    href: "/solutions/generation-de-leads",
    description: "Demandes de devis, qualification et conversion.",
  },
  {
    title: "Acquisition B2B",
    href: "/solutions/generation-leads-b2b",
    description: "Pipeline, leads qualifiés et rendez-vous B2B.",
  },
  {
    title: "Marketing local",
    href: "/solutions/marketing-local",
    description: "Google Maps, zones servies et recherches locales.",
  },
] as const;

export default function RessourcesPage() {
  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Ressources", url: `${SITE_URL}/ressources` },
        ]}
      />

      <Eyebrow>Ressources</Eyebrow>
      <h1 className="font-display text-balance mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Guides SEO, marketing digital et acquisition.
      </h1>
      <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[var(--color-muted)]">
        Les guides répondent aux questions que vos prospects tapent avant de choisir un prestataire.
        Chaque sujet renvoie ensuite vers la solution commerciale la plus proche afin de créer un
        parcours clair entre information, service et diagnostic.
      </p>

      <section className="mt-12">
        <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
          Accéder directement aux sujets commerciaux
        </h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TOPIC_HUBS.map((topic) => (
            <Link
              key={topic.href}
              href={topic.href}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-muted)]"
            >
              <h3 className="font-display text-base font-semibold text-[var(--color-text)]">
                {topic.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                {topic.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-16 border-t border-[var(--color-border)] pt-12">
        <h2 className="font-display text-2xl font-semibold text-[var(--color-text)]">
          Tous les guides
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {ARTICLES.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      </section>
    </Section>
  );
}
