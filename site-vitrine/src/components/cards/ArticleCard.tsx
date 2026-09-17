import Link from "next/link";
import type { Article } from "@/lib/data/articles";

export function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/ressources/${article.slug}`}
      className="group flex flex-col justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 transition-colors duration-300 hover:border-[var(--color-border-strong)]"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-muted)]">
          {article.readingTime} de lecture
        </p>
        <h3 className="font-display mt-4 text-xl font-medium leading-snug text-[var(--color-text)]">
          {article.title}
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
          {article.excerpt}
        </p>
      </div>
      <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text)] transition-colors group-hover:text-[var(--color-accent)]">
        Lire l&apos;article
        <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}
