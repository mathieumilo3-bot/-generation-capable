import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

// Production release: reviews-only

const REVIEWS = [
  {
    name: "Fabien",
    date: "26 juillet 2026",
    context: "Création de site · stratégie digitale",
    quote:
      "On a d’abord clarifié ce que le client devait comprendre et faire. Le projet était beaucoup plus structuré que ce que j’avais imaginé au départ.",
  },
  {
    name: "Soraya",
    date: "3 août 2026",
    context: "Positionnement · parcours client",
    quote:
      "Les explications étaient simples, concrètes et adaptées à mon activité. J’ai compris où je perdais des gens et comment rendre le parcours beaucoup plus naturel.",
  },
  {
    name: "Adrien",
    date: "17 août 2026",
    context: "Site internet · acquisition",
    quote:
      "Le rendu est propre, mais surtout chaque partie du site a un objectif clair. On sait exactement où on veut emmener la personne.",
  },
  {
    name: "Dominique",
    date: "2 septembre 2026",
    context: "Visibilité · présence digitale",
    quote:
      "Le travail a permis de rendre l’ensemble plus lisible, plus crédible et beaucoup plus professionnel.",
  },
] as const;

export function ReviewsSection() {
  return (
    <Section id="avis-clients" tone="raised" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Eyebrow>Avis clients</Eyebrow>
              <h2 className="font-display text-balance mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Ce qu&apos;ils retiennent
                <br />
                <span className="text-[var(--color-muted)]">après avoir travaillé avec GC.</span>
              </h2>
            </div>
            <span className="w-fit rounded-full border border-[var(--color-border-strong)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Aperçu démo
            </span>
          </div>
        </Reveal>

        <div className="mt-8 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] md:grid md:grid-cols-2 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
          {REVIEWS.map((review, index) => (
            <Reveal
              key={review.name}
              delay={index * 0.04}
              className="min-w-[86%] snap-center md:min-w-0"
            >
              <article className="flex h-full min-h-[250px] flex-col rounded-[1.4rem] border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <div
                    className="text-sm tracking-[0.18em] text-[var(--color-accent)]"
                    aria-label="5 étoiles sur 5"
                  >
                    ★★★★★
                  </div>
                  <span className="text-[11px] text-[var(--color-muted)]">
                    {review.date}
                  </span>
                </div>

                <p className="font-display mt-5 flex-1 text-lg leading-relaxed text-[var(--color-text)] sm:text-xl">
                  “{review.quote}”
                </p>

                <div className="mt-6 border-t border-[var(--color-border)] pt-4">
                  <p className="text-sm font-semibold text-[var(--color-text)]">
                    {review.name}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {review.context}
                  </p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="font-display text-base font-semibold">
                Votre présence mérite le même niveau de clarté.
              </p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                On identifie les leviers prioritaires avant de parler refonte, SEO ou publicité.
              </p>
            </div>
            <Button
              href="/audit"
              variant="primary"
              trackEvent="cta_clicked"
              trackPayload={{ location: "reviews_home" }}
            >
              Analyser mon entreprise →
            </Button>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
