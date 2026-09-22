import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Avis clients | GC Agence",
  description: "Aperçu de présentation non indexé du futur espace avis et réalisations de GC Agence.",
  robots: { index: false, follow: false },
};

const REVIEWS = [
  {
    name: "Fabien",
    date: "26 juillet 2026",
    context: "Création de site · stratégie digitale",
    quote:
      "J’ai aimé le fait qu’on ne parte pas directement dans le design. On a d’abord clarifié ce que le client devait comprendre et faire. Le projet était beaucoup plus structuré que ce que j’avais imaginé au départ.",
  },
  {
    name: "Soraya",
    date: "3 août 2026",
    context: "Positionnement · parcours client",
    quote:
      "Les explications étaient simples, concrètes et surtout adaptées à mon activité. J’ai compris où je perdais des gens et comment rendre le parcours beaucoup plus naturel.",
  },
  {
    name: "Adrien",
    date: "17 août 2026",
    context: "Site internet · acquisition",
    quote:
      "Le rendu est propre mais ce que j’ai surtout apprécié, c’est la logique derrière. Chaque partie du site a un objectif et on sait exactement où on veut emmener la personne.",
  },
  {
    name: "Dominique",
    date: "2 septembre 2026",
    context: "Visibilité · présence digitale",
    quote:
      "J’avais beaucoup d’informations mais rien n’était vraiment organisé. Le travail a permis de rendre l’ensemble plus lisible, plus crédible et beaucoup plus professionnel.",
  },
] as const;

const SITES = [
  {
    owner: "Fabien",
    title: "Atelier Croizé",
    sector: "Rénovation intérieure",
    src: "/demos/clients/fabien/index.html",
    description:
      "Une présence éditoriale haut de gamme, pensée pour rassurer vite et faire passer naturellement vers l’étude de projet.",
  },
  {
    owner: "Soraya",
    title: "Soraya Studio",
    sector: "Bien-être · accompagnement",
    src: "/demos/clients/soraya/index.html",
    description:
      "Un univers doux et premium, avec une offre clarifiée et des appels à l’action intégrés sans casser l’expérience.",
  },
] as const;

function PremiumSitePreview({
  site,
  index,
}: {
  site: (typeof SITES)[number];
  index: number;
}) {
  return (
    <article className="overflow-hidden rounded-[1.75rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
      <div className="flex flex-col gap-4 border-b border-[var(--color-border)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
            Projet {String(index + 1).padStart(2, "0")} · Après
          </p>
          <h3 className="font-display mt-2 text-2xl font-semibold">{site.title}</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {site.sector} · avis de {site.owner}
          </p>
        </div>
        <Link
          href={site.src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] px-4 py-2.5 text-xs font-semibold transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
        >
          Voir le site plein écran →
        </Link>
      </div>

      <div className="relative h-[560px] overflow-hidden bg-white sm:h-[650px]">
        <iframe
          src={site.src}
          title={`Aperçu du site premium ${site.title}`}
          className="pointer-events-none h-full w-full border-0"
          tabIndex={-1}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/10 to-transparent" />
      </div>

      <div className="border-t border-[var(--color-border)] p-5 sm:p-6">
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--color-muted)]">
          {site.description}
        </p>
      </div>
    </article>
  );
}

export default function DemoReviewsPage() {
  return (
    <>
      <Section className="pb-14 pt-16 sm:pb-20 sm:pt-24">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Eyebrow>Avis clients</Eyebrow>
              <h1 className="font-display text-balance mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                Des retours.
                <br />
                <span className="text-[var(--color-muted)]">Et surtout des sites à voir.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-base">
                Les témoignages donnent le ressenti. Les réalisations montrent concrètement
                le niveau de présentation, de clarté et de conversion recherché.
              </p>
            </div>

            <div className="rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
              Aperçu de présentation
            </div>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {REVIEWS.map((review) => (
              <article
                key={review.name}
                className="flex h-full flex-col rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_18px_55px_rgba(0,0,0,0.12)] sm:p-7"
              >
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
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="font-display text-base font-semibold">Et votre présence aujourd’hui ?</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                On regarde ce qui freine la confiance, la visibilité et la prise de contact.
              </p>
            </div>
            <Button
              href="/audit"
              variant="primary"
              trackEvent="cta_clicked"
              trackPayload={{ location: "demo_reviews_top_cta" }}
            >
              Analyser mon entreprise →
            </Button>
          </div>
        </div>
      </Section>

      <Section tone="raised" className="py-16 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Eyebrow>Réalisations</Eyebrow>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="font-display text-balance max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Pour l’instant,
              <br />
              <span className="text-[var(--color-muted)]">on montre seulement l’Après.</span>
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
              Deux premiers univers premium complets. Les deux prochains seront construits
              sur la même exigence avant d’être ajoutés ici.
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-10">
            {SITES.map((site, index) => (
              <PremiumSitePreview key={site.title} site={site} index={index} />
            ))}
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-[1.5rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 sm:flex-row sm:items-center">
            <div>
              <p className="font-display text-xl font-semibold">Votre site peut être le prochain.</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
                On identifie les changements prioritaires avant de parler refonte, SEO ou publicité.
              </p>
            </div>
            <Button
              href="/audit"
              variant="primary"
              trackEvent="cta_clicked"
              trackPayload={{ location: "demo_reviews_bottom_cta" }}
            >
              Voir mes priorités →
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
