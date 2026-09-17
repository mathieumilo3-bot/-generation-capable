import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { ArticleCard } from "@/components/cards/ArticleCard";
import { Button } from "@/components/ui/Button";
import { ARTICLES } from "@/lib/data/articles";

export function ContentPreview() {
  return (
    <Section tone="raised" className="py-24 sm:py-32">
      <Reveal>
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <Eyebrow>Ressources</Eyebrow>
            <h2 className="font-display text-balance mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Le digital décodé.
            </h2>
          </div>
          <Button href="/ressources" variant="secondary" className="shrink-0">
            Tous les articles →
          </Button>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {ARTICLES.slice(0, 4).map((article, index) => (
          <Reveal key={article.slug} delay={index * 0.08}>
            <ArticleCard article={article} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
