import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Démo avis clients | GC Agence",
  description: "Maquette non indexée du futur bloc d'avis clients de GC Agence.",
  robots: { index: false, follow: false },
};

const DEMO_REVIEWS = [
  {
    name: "Fabien C.",
    date: "26 juillet 2026",
    quote:
      "J’ai apprécié la façon dont le projet a été repris : les échanges étaient clairs, les priorités bien posées et j’ai surtout compris ce qu’il fallait améliorer pour rendre ma présence en ligne plus crédible et plus efficace.",
  },
  {
    name: "Soraya",
    date: "3 août 2026",
    quote:
      "Ce que j’ai aimé, c’est qu’on ne m’a pas juste parlé de design. Toute la réflexion était centrée sur le parcours du client, ce qu’il devait comprendre et la manière de l’amener naturellement vers une prise de contact.",
  },
  {
    name: "Adrien",
    date: "17 août 2026",
    quote:
      "Très bonne expérience. Les recommandations étaient concrètes et faciles à comprendre. On sent qu’il y a une vraie logique derrière le site et pas simplement l’objectif de faire quelque chose de joli.",
  },
  {
    name: "Dominique",
    date: "2 septembre 2026",
    quote:
      "J’avais besoin de remettre de l’ordre dans ma présence digitale. L’approche était structurée, directe et adaptée à l’activité. Le résultat donne tout de suite une image plus professionnelle.",
  },
];

export default function DemoReviewsPage() {
  return (
    <Section className="py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow>Mode démo</Eyebrow>
            <h1 className="font-display text-balance mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              Aperçu du futur bloc
              <br />
              <span className="text-[var(--color-muted)]">avis clients.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-base">
              Cette page sert uniquement à visualiser le rendu. Les textes ci-dessous sont des exemples de maquette et ne sont pas des témoignages réels.
            </p>
          </div>

          <div className="rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent-soft)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            Maquette non publiée comme preuve
          </div>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {DEMO_REVIEWS.map((review) => (
            <article
              key={review.name}
              className="flex h-full flex-col rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.12)] sm:p-7"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm tracking-[0.18em] text-[var(--color-accent)]" aria-label="5 étoiles sur 5">
                  ★★★★★
                </div>
                <span className="text-[11px] text-[var(--color-muted)]">{review.date}</span>
              </div>

              <p className="font-display mt-5 flex-1 text-[1.12rem] leading-relaxed text-[var(--color-text)] sm:text-xl">
                “{review.quote}”
              </p>

              <div className="mt-6 border-t border-[var(--color-border)] pt-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">{review.name}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
                  Exemple de maquette
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-14 border-t border-[var(--color-border)] pt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Eyebrow>Avant / Après</Eyebrow>
              <h2 className="font-display mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Une preuve visuelle
                <br />
                <span className="text-[var(--color-muted)]">en quelques secondes.</span>
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
              Exemple de mise en page. Plus tard, on remplacera ces aperçus par les vraies captures de projets clients.
            </p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            <div className="overflow-hidden rounded-[1.4rem] border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">Avant</p>
                  <p className="mt-1 text-sm font-semibold">Version précédente</p>
                </div>
                <span className="rounded-full border border-[var(--color-border)] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                  Démo
                </span>
              </div>
              <div className="relative h-[360px] overflow-hidden bg-white">
                <iframe
                  src="/demos/couvreur/avant.html"
                  title="Aperçu avant"
                  className="pointer-events-none h-full w-full border-0"
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.4rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[0_20px_70px_rgba(0,0,0,0.18)]">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">Après GC</p>
                  <p className="mt-1 text-sm font-semibold">Nouvelle expérience</p>
                </div>
                <span className="rounded-full bg-[var(--color-accent)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-black">
                  Après
                </span>
              </div>
              <div className="relative h-[360px] overflow-hidden bg-white">
                <iframe
                  src="/demos/couvreur/apres.html"
                  title="Aperçu après"
                  className="pointer-events-none h-full w-full border-0"
                  tabIndex={-1}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="text-sm font-semibold text-[var(--color-text)]">Prêt pour les vrais avis.</p>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Dès que tu as les textes réels, on remplace ces exemples sans toucher au design.
            </p>
          </div>
          <Link
            href="/avis"
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] px-5 py-3 text-sm font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            Déposer un vrai avis →
          </Link>
        </div>
      </div>
    </Section>
  );
}
