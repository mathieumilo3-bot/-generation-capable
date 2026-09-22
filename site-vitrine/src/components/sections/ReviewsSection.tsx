import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

type Review = {
  quote: string;
  name: string;
  context: string;
};

const REVIEWS: Review[] = [
  // Ajoute ici uniquement des avis réels, avec l'accord de leur auteur.
];

export function ReviewsSection() {
  return (
    <Section id="avis" tone="raised" className="py-16 sm:py-20">
      <div className="grid gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-start lg:gap-12">
        <Reveal>
          <Eyebrow>Avis clients</Eyebrow>
          <h2 className="font-display text-balance mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Des retours réels.
            <br />
            <span className="text-[var(--color-muted)]">Rien d&apos;inventé.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
            Les témoignages affichés ici sont publiés uniquement avec l&apos;accord
            de personnes ayant réellement travaillé avec GC. Pas de faux avis,
            pas de résultats maquillés.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
              Vous avez déjà travaillé avec GC ?
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
              Votre retour peut être positif, mitigé ou critique. Il n&apos;est jamais
              publié automatiquement.
            </p>
            <Link
              href="/avis"
              className="mt-5 inline-flex items-center justify-center rounded-full border border-[var(--color-border-strong)] px-5 py-3 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              Déposer un avis →
            </Link>
          </div>
        </Reveal>
      </div>

      {REVIEWS.length > 0 && (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {REVIEWS.map((review, index) => (
            <Reveal key={`${review.name}-${index}`} delay={index * 0.05}>
              <article className="h-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
                <p className="font-display text-lg leading-relaxed text-[var(--color-text)]">
                  “{review.quote}”
                </p>
                <div className="mt-5 border-t border-[var(--color-border)] pt-4">
                  <p className="text-sm font-semibold">{review.name}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{review.context}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      )}
    </Section>
  );
}
