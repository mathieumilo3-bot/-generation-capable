import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";
import { ArticleCard } from "@/components/cards/ArticleCard";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { SITE_URL } from "@/lib/constants";
import { ARTICLES } from "@/lib/data/articles";

export const metadata: Metadata = {
  title: "Ressources — Le digital décodé",
  description:
    "Analyses et décryptages sur la présence digitale, l'acquisition et la conversion pour les entreprises locales.",
  alternates: { canonical: "/ressources" },
};

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
      <h1 className="font-display text-balance mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Le digital décodé.
      </h1>

      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {ARTICLES.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </Section>
  );
}
