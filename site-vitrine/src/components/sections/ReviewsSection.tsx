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
  {
    name: "Fabien Croizé",
    date: "26 juillet 2026",
    context: "Avis fictif · démonstration visuelle",
    quote:
      "J’ai apprécié la façon dont GC a repris mon projet : les échanges étaient clairs, les priorités bien posées et j’ai surtout compris ce qu’il fallait améliorer pour rendre ma présence en ligne plus crédible et plus efficace.",
  },
  {
    name: "Soraya",
    date: "3 août 2026",
    context: "Avis fictif · démonstration visuelle",
    quote:
      "Ce que j’ai aimé, c’est qu’on ne m’a pas juste parlé de design. GC a vraiment réfléchi au parcours du client, à ce qu’il devait comprendre et à la manière de l’amener naturellement vers une prise de contact.",
  },
  {
    name: "Adrien",
    date: "17 août 2026",
    context: "Avis fictif · démonstration visuelle",
    quote:
      "Très bonne expérience. Les recommandations étaient concrètes et faciles à comprendre. J’ai senti qu’il y avait une vraie logique derrière le site et pas simplement l’objectif de faire quelque chose de joli.",
  },
  {
    name: "Dominique",
    date: "2 septembre 2026",
    context: "Avis fictif · démonstration visuelle",
    quote:
      "J’avais besoin de remettre de l’ordre dans ma présence digitale. L’approche était structurée, directe et adaptée à mon activité. Le résultat donne tout de suite une image plus professionnelle.",
  },
];

export function ReviewsSection() {
  return (
    <Section id="avis" tone="raised" className="py-16 sm:py-20">
      <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <Reveal>
          <Eyebrow>Avis clients</Eyebrow>
          <h2 className="font-display text-balance mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Ce que ça donnera
            <br />
            <span className="text-[var(--color-muted)]">avec de vrais retours.</span>
          </h2>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
            Aperçu temporaire du futur bloc témoignages. Les quatre avis ci-dessous
            sont fictifs et servent uniquement à tester le rendu avant l’intégration
            de vrais avis clients.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent-soft)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Démonstration · avis fictifs
          </div>
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
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
                  {review.context}
                </p>
              </div>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.12}>
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">
              Vous avez déjà travaillé avec GC ?
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Votre avis n&apos;est jamais publié automatiquement.
            </p>
          </div>
          <Link
            href="/avis"
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] px-5 py-3 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Déposer un avis →
          </Link>
        </div>
      </Reveal>
    </Section>
  );
}
