import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

type Review = {
  quote: string;
  name: string;
  date: string;
  context: string;
};

const REVIEWS: Review[] = [
  // Ajouter ici uniquement des avis réels et autorisés.
];

export function ReviewsSection() {
  if (REVIEWS.length === 0) return null;

  return (
    <Section id="avis" tone="raised" className="py-16 sm:py-20">
      <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <Reveal>
          <Eyebrow>Avis clients</Eyebrow>
          <h2 className="font-display text-balance mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Ce qu&apos;ils disent
            <br />
            <span className="text-[var(--color-muted)]">après avoir travaillé avec GC.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.08}>
          <Link
            href="/avis"
            className="inline-flex items-center justify-center rounded-full border border-[var(--color-border-strong)] px-5 py-3 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Déposer un avis →
          </Link>
        </Reveal>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {REVIEWS.map((review, index) => (
          <Reveal key={`${review.name}-${index}`} delay={index * 0.05}>
            <article className="flex h-full flex-col rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm tracking-[0.18em] text-[var(--color-accent)]" aria-label="5 étoiles sur 5">
                  ★★★★★
                </div>
                <span className="text-[11px] text-[var(--color-muted)]">{review.date}</span>
              </div>
              <p className="font-display mt-5 flex-1 text-[1.08rem] leading-relaxed text-[var(--color-text)] sm:text-lg">
                “{review.quote}”
              </p>
              <div className="mt-6 border-t border-[var(--color-border)] pt-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">{review.name}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{review.context}</p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
