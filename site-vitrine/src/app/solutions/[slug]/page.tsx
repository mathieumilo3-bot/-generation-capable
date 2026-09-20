import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import {
  BreadcrumbJsonLd,
  FAQJsonLd,
  ServiceJsonLd,
} from "@/components/schema/JsonLd";
import { PRIMARY_CTA_LABEL, SITE_URL } from "@/lib/constants";
import {
  getSeoLandingBySlug,
  SEO_LANDINGS,
} from "@/lib/data/seo-landings";
import { getArticleBySlug } from "@/lib/data/articles";

type Props = { params: Promise<{ slug: string }> };

const RELATED_ARTICLES: Record<string, string[]> = {
  "agence-marketing-digital": ["plan-marketing-digital-pme", "budget-marketing-digital-pme"],
  "strategie-marketing-digital": ["plan-marketing-digital-pme", "webmarketing-pme-plan"],
  "marketing-digital-pme": ["budget-marketing-digital-pme", "plan-marketing-digital-pme"],
  "audit-marketing-digital": ["audit-acquisition-digitale", "comment-etre-visible-sur-google"],
  "marketing-local": ["seo-local-artisan", "optimiser-google-business-profile"],
  "publicite-google-ads": ["google-ads-pme-guide", "seo-ou-google-ads"],
  "publicite-meta-ads": ["strategie-reseaux-sociaux-entreprise", "budget-marketing-digital-pme"],
  "strategie-reseaux-sociaux": ["strategie-reseaux-sociaux-entreprise", "webmarketing-pme-plan"],
  "content-marketing": ["comment-etre-visible-sur-google", "strategie-reseaux-sociaux-entreprise"],
  "marketing-digital-artisan": ["marketing-digital-artisan-guide", "seo-local-artisan"],
  "generation-leads-b2b": ["generation-leads-b2b-guide", "cout-par-lead-qualifie", "inbound-ou-outbound-b2b"],
  "agence-acquisition-b2b": ["generation-leads-b2b-guide", "audit-acquisition-digitale"],
  "marketing-b2b": ["inbound-ou-outbound-b2b", "generation-leads-b2b-guide"],
  "growth-marketing": ["growth-marketing-pme", "audit-acquisition-digitale"],
  "webmarketing": ["webmarketing-pme-plan", "budget-marketing-digital-pme"],
  "communication-digitale": ["strategie-reseaux-sociaux-entreprise", "webmarketing-pme-plan"],
  "inbound-marketing": ["inbound-ou-outbound-b2b", "generation-leads-b2b-guide"],
  "consultant-marketing-digital": ["audit-acquisition-digitale", "plan-marketing-digital-pme"],
  "generation-de-leads": ["generer-demandes-devis-en-ligne", "cout-par-lead-qualifie"],
  "referencement-artisan": ["seo-local-artisan", "site-internet-artisan-guide"],
  "creation-site-artisan": ["site-internet-artisan-guide", "prix-creation-site-internet"],
  "marketing-digital-btp": ["marketing-digital-btp-guide", "seo-local-artisan"],
  "creation-site-dentiste": ["site-internet-dentiste-seo-local", "comment-etre-visible-sur-google"],
  "marketing-digital-dentiste": ["site-internet-dentiste-seo-local", "optimiser-google-business-profile"],
  "marketing-entreprise-nettoyage": ["marketing-entreprise-nettoyage-guide", "generer-demandes-devis-en-ligne"],
  "marketing-evenementiel-digital": ["marketing-evenementiel-digital-guide", "strategie-reseaux-sociaux-entreprise"],
  "marketing-digital-restaurant": ["marketing-digital-restaurant-guide", "optimiser-google-business-profile"],
};

export function generateStaticParams() {
  return SEO_LANDINGS.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = getSeoLandingBySlug(slug);
  if (!page) return {};

  return {
    title: page.title,
    description: page.metaDescription,
    alternates: { canonical: `/solutions/${page.slug}` },
    openGraph: {
      title: page.title,
      description: page.metaDescription,
      url: `${SITE_URL}/solutions/${page.slug}`,
      type: "website",
    },
  };
}

export default async function SeoLandingPage({ params }: Props) {
  const { slug } = await params;
  const page = getSeoLandingBySlug(slug);
  if (!page) notFound();

  const related = page.related
    .map((relatedSlug) => getSeoLandingBySlug(relatedSlug))
    .filter(Boolean);
  const relatedArticles = (RELATED_ARTICLES[page.slug] ?? [])
    .map((articleSlug) => getArticleBySlug(articleSlug))
    .filter(Boolean);

  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Solutions", url: `${SITE_URL}/solutions` },
          { name: page.h1, url: `${SITE_URL}/solutions/${page.slug}` },
        ]}
      />
      <ServiceJsonLd
        name={page.h1}
        description={page.metaDescription}
        url={`${SITE_URL}/solutions/${page.slug}`}
      />
      <FAQJsonLd items={page.faqs} />

      <div className="mx-auto max-w-3xl">
        <Eyebrow>{page.eyebrow}</Eyebrow>
        <h1 className="font-display text-balance mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {page.h1}
        </h1>
        <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[var(--color-muted)]">
          {page.intro}
        </p>

        <div className="mt-14 flex flex-col gap-10">
          {page.blocks.map((block) => (
            <section key={block.heading}>
              <h2 className="font-display text-2xl font-semibold text-[var(--color-text)]">
                {block.heading}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
                {block.body}
              </p>
            </section>
          ))}
        </div>

        <section className="mt-16 border-t border-[var(--color-border)] pt-12">
          <h2 className="font-display text-2xl font-semibold text-[var(--color-text)]">
            Questions fréquentes
          </h2>
          <div className="mt-6 divide-y divide-[var(--color-border)]">
            {page.faqs.map((faq) => (
              <details key={faq.question} className="group py-5">
                <summary className="cursor-pointer list-none font-display text-base font-semibold text-[var(--color-text)]">
                  {faq.question}
                </summary>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        {related.length > 0 && (
          <section className="mt-16 border-t border-[var(--color-border)] pt-12">
            <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
              À explorer ensuite
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {related.map((item) =>
                item ? (
                  <Link
                    key={item.slug}
                    href={`/solutions/${item.slug}`}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-muted)]"
                  >
                    {item.title}
                  </Link>
                ) : null
              )}
            </div>
          </section>
        )}

        {relatedArticles.length > 0 && (
          <section className="mt-16 border-t border-[var(--color-border)] pt-12">
            <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
              Guides liés à ce sujet
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {relatedArticles.map((article) =>
                article ? (
                  <Link
                    key={article.slug}
                    href={`/ressources/${article.slug}`}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-muted)]"
                  >
                    <p className="font-display text-base font-semibold text-[var(--color-text)]">
                      {article.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                      {article.excerpt}
                    </p>
                  </Link>
                ) : null
              )}
            </div>
          </section>
        )}

        <div className="mt-16 border-t border-[var(--color-border)] pt-10">
          <p className="mb-5 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
            Vous voulez savoir quelles corrections et quelles pages ont le plus de potentiel pour votre entreprise ? Lancez le diagnostic et partez de votre situation réelle.
          </p>
          <Button
            href="/audit"
            variant="primary"
            trackEvent="cta_clicked"
            trackPayload={{ location: `seo_landing_${page.slug}` }}
          >
            {PRIMARY_CTA_LABEL} →
          </Button>
        </div>
      </div>
    </Section>
  );
}
