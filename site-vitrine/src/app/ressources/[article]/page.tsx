import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { PRIMARY_CTA_LABEL, SITE_URL } from "@/lib/constants";
import { ARTICLES, getArticleBySlug } from "@/lib/data/articles";

type Props = { params: Promise<{ article: string }> };

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
