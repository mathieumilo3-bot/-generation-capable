import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { PRIMARY_CTA_LABEL, SITE_URL } from "@/lib/constants";
import { ARTICLES, getArticleBySlug } from "@/lib/data/articles";

type Props = { params: Promise<{ article: string }> };

const RELATED_LINKS: Record<string, { href: string; label: string }[]> = {
  "prix-creation-site-internet": [
    { href: "/creation-site-internet", label: "Création de site internet" },
    { href: "/solutions/refonte-site-internet", label: "Refonte de site internet" },
  ],
  "comment-etre-visible-sur-google": [
    { href: "/seo", label: "Référencement SEO" },
    { href: "/solutions/visibilite-google", label: "Visibilité Google" },
    { href: "/solutions/audit-seo", label: "Audit SEO" },
  ],
  "seo-local-artisan": [
    { href: "/solutions/referencement-artisan", label: "Référencement artisan" },
    { href: "/solutions/referencement-local", label: "Référencement local" },
  ],
  "optimiser-google-business-profile": [
    { href: "/solutions/google-business-profile", label: "Optimisation Google Business Profile" },
    { href: "/solutions/referencement-local", label: "SEO local" },
  ],
  "prix-referencement-seo": [
    { href: "/seo", label: "Référencement SEO" },
    { href: "/solutions/audit-seo", label: "Audit SEO" },
  ],
  "site-internet-artisan-guide": [
    { href: "/solutions/creation-site-artisan", label: "Création de site pour artisan" },
    { href: "/solutions/referencement-artisan", label: "Référencement artisan" },
  ],
  "generer-demandes-devis-en-ligne": [
    { href: "/solutions/generation-de-leads", label: "Génération de leads" },
    { href: "/solutions/landing-page", label: "Landing page" },
    { href: "/solutions/acquisition-artisan", label: "Acquisition artisan" },
  ],
  "refonte-site-seo-erreurs": [
    { href: "/solutions/refonte-site-internet", label: "Refonte de site internet" },
    { href: "/solutions/audit-seo", label: "Audit SEO" },
  ],
  "plan-marketing-digital-pme": [
    { href: "/solutions/strategie-marketing-digital", label: "Stratégie marketing digital" },
    { href: "/solutions/marketing-digital-pme", label: "Marketing digital PME" },
    { href: "/solutions/audit-marketing-digital", label: "Audit marketing digital" },
  ],
  "budget-marketing-digital-pme": [
    { href: "/solutions/marketing-digital-pme", label: "Marketing digital PME" },
    { href: "/solutions/agence-marketing-digital", label: "Agence marketing digital" },
  ],
  "seo-ou-google-ads": [
    { href: "/seo", label: "Référencement SEO" },
    { href: "/solutions/publicite-google-ads", label: "Google Ads" },
    { href: "/solutions/strategie-marketing-digital", label: "Stratégie marketing digital" },
  ],
  "google-ads-pme-guide": [
    { href: "/solutions/publicite-google-ads", label: "Google Ads" },
    { href: "/solutions/landing-page", label: "Landing page" },
    { href: "/solutions/generation-de-leads", label: "Génération de leads" },
  ],
  "strategie-reseaux-sociaux-entreprise": [
    { href: "/solutions/strategie-reseaux-sociaux", label: "Stratégie réseaux sociaux" },
    { href: "/solutions/content-marketing", label: "Content marketing" },
    { href: "/solutions/publicite-meta-ads", label: "Meta Ads" },
  ],
  "marketing-digital-artisan-guide": [
    { href: "/solutions/marketing-digital-artisan", label: "Marketing digital artisan" },
    { href: "/solutions/referencement-artisan", label: "Référencement artisan" },
    { href: "/solutions/publicite-google-ads", label: "Google Ads" },
  ],
  "generation-leads-b2b-guide": [
    { href: "/solutions/generation-leads-b2b", label: "Génération de leads B2B" },
    { href: "/solutions/agence-acquisition-b2b", label: "Acquisition B2B" },
    { href: "/solutions/marketing-b2b", label: "Marketing B2B" },
  ],
  "cout-par-lead-qualifie": [
    { href: "/solutions/generation-leads-b2b", label: "Génération de leads B2B" },
    { href: "/solutions/growth-marketing", label: "Growth marketing" },
  ],
  "inbound-ou-outbound-b2b": [
    { href: "/solutions/inbound-marketing", label: "Inbound marketing" },
    { href: "/solutions/marketing-b2b", label: "Marketing B2B" },
    { href: "/solutions/generation-leads-b2b", label: "Lead generation B2B" },
  ],
  "webmarketing-pme-plan": [
    { href: "/solutions/webmarketing", label: "Webmarketing" },
    { href: "/solutions/marketing-digital-pme", label: "Marketing digital PME" },
  ],
  "growth-marketing-pme": [
    { href: "/solutions/growth-marketing", label: "Growth marketing" },
    { href: "/solutions/audit-marketing-digital", label: "Audit marketing digital" },
  ],
  "audit-acquisition-digitale": [
    { href: "/solutions/agence-acquisition-b2b", label: "Acquisition B2B" },
    { href: "/solutions/audit-marketing-digital", label: "Audit marketing digital" },
    { href: "/solutions/generation-de-leads", label: "Génération de leads" },
  ],
};

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ article: article.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { article: slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) return {};

  return {
    title: article.title,
    description: article.excerpt,
    alternates: { canonical: `/ressources/${article.slug}` },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { article: slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();
  const relatedLinks = RELATED_LINKS[article.slug] ?? [
    { href: "/solutions", label: "Voir toutes les solutions" },
    { href: "/audit", label: "Analyser mon entreprise" },
  ];

  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Ressources", url: `${SITE_URL}/ressources` },
          { name: article.title, url: `${SITE_URL}/ressources/${article.slug}` },
        ]}
      />
      <ArticleJsonLd
        title={article.title}
        description={article.excerpt}
        url={`${SITE_URL}/ressources/${article.slug}`}
        datePublished={article.publishedAt}
      />

      <article className="mx-auto max-w-2xl">
        <Eyebrow>{article.readingTime} de lecture</Eyebrow>
        <h1 className="font-display text-balance mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {article.title}
        </h1>

        <div className="mt-10 flex flex-col gap-6">
          {article.content.map((paragraph, index) => (
            <p key={index} className="text-[16px] leading-relaxed text-[var(--color-muted)]">
              {paragraph}
            </p>
          ))}
        </div>

        <div className="mt-14 border-t border-[var(--color-border)] pt-10">
          <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">À explorer ensuite</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {relatedLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-muted)]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-10 border-t border-[var(--color-border)] pt-10">
          <Button
            href="/audit"
            variant="primary"
            trackEvent="cta_clicked"
            trackPayload={{ location: `article_${article.slug}` }}
          >
            {PRIMARY_CTA_LABEL} →
          </Button>
        </div>
      </article>
    </Section>
  );
}
