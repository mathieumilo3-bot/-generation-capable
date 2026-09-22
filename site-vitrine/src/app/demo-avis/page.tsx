import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Avis clients | GC Agence",
  description: "Aperçu de présentation non indexé du futur espace avis et transformations de GC Agence.",
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

const PROJECTS = [
  {
    sector: "Couverture",
    beforeTitle: "Site vitrine classique",
    beforeCopy: "Navigation dense, message générique, demande de devis peu guidée.",
    afterTitle: "Parcours orienté besoin",
    afterCopy: "Promesse immédiate, qualification courte et prochaine étape évidente.",
    accent: "01",
  },
  {
    sector: "Bien-être",
    beforeTitle: "Offre difficile à comprendre",
    beforeCopy: "Plusieurs prestations au même niveau, peu de hiérarchie et peu de réassurance.",
    afterTitle: "Offre clarifiée",
    afterCopy: "Une entrée simple, des bénéfices lisibles et une prise de rendez-vous naturelle.",
    accent: "02",
  },
  {
    sector: "Nettoyage",
    beforeTitle: "Présence trop générique",
    beforeCopy: "Services empilés, zone d’intervention peu visible et contact sans qualification.",
    afterTitle: "Demande cadrée",
    afterCopy: "Services prioritaires, zone claire et formulaire adapté au besoin réel.",
    accent: "03",
  },
  {
    sector: "Événementiel",
    beforeTitle: "Portfolio sans direction",
    beforeCopy: "Beaucoup d’images mais peu d’aide pour comprendre l’offre et passer à l’action.",
    afterTitle: "Expérience premium",
    afterCopy: "Univers visuel fort, offres structurées et passage fluide vers la demande.",
    accent: "04",
  },
] as const;

function SiteMockup({
  mode,
  sector,
  title,
  copy,
}: {
  mode: "before" | "after";
  sector: string;
  title: string;
  copy: string;
}) {
  const isAfter = mode === "after";

  return (
    <div
      className={
        isAfter
          ? "overflow-hidden rounded-2xl border border-[var(--color-accent)]/30 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.28)]"
          : "overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[#e8e8e8]"
      }
    >
      <div
        className={
          isAfter
            ? "flex items-center justify-between border-b border-white/10 bg-[#0c0c0c] px-4 py-3"
            : "flex items-center justify-between border-b border-black/10 bg-[#d8d8d8] px-4 py-3"
        }
      >
        <div className="flex gap-1.5" aria-hidden>
          <span className={isAfter ? "h-2 w-2 rounded-full bg-white/20" : "h-2 w-2 rounded-full bg-black/20"} />
          <span className={isAfter ? "h-2 w-2 rounded-full bg-white/20" : "h-2 w-2 rounded-full bg-black/20"} />
          <span className={isAfter ? "h-2 w-2 rounded-full bg-[var(--color-accent)]" : "h-2 w-2 rounded-full bg-black/20"} />
        </div>
        <span
          className={
            isAfter
              ? "text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45"
              : "text-[9px] font-semibold uppercase tracking-[0.18em] text-black/45"
          }
        >
          {isAfter ? "Après GC" : "Avant"}
        </span>
      </div>

      <div className={isAfter ? "min-h-[250px] bg-gradient-to-br from-[#0b0b0b] to-[#171717] p-5 text-white" : "min-h-[250px] bg-[#f0f0f0] p-5 text-[#333]"}>
        <div
          className={
            isAfter
              ? "mb-7 flex items-center justify-between"
              : "mb-5 flex items-center justify-between border-b border-black/10 pb-3"
          }
        >
          <p className={isAfter ? "font-display text-sm font-semibold" : "text-xs font-bold uppercase"}>
            {sector}
          </p>
          <span
            className={
              isAfter
                ? "rounded-full border border-white/15 px-3 py-1 text-[9px] text-white/60"
                : "border border-black/20 bg-white px-2 py-1 text-[9px]"
            }
          >
            {isAfter ? "Votre projet →" : "Contact"}
          </span>
        </div>

        <div className={isAfter ? "max-w-[88%]" : "max-w-full"}>
          <p
            className={
              isAfter
                ? "font-display text-2xl font-semibold leading-tight tracking-tight"
                : "font-serif text-xl font-bold leading-tight text-[#315d7d]"
            }
          >
            {title}
          </p>
          <p
            className={
              isAfter
                ? "mt-3 text-xs leading-relaxed text-white/55"
                : "mt-3 text-[11px] leading-relaxed text-[#666]"
            }
          >
            {copy}
          </p>
        </div>

        <div className={isAfter ? "mt-7 grid grid-cols-3 gap-2" : "mt-6 grid grid-cols-3 gap-1"}>
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className={
                isAfter
                  ? "h-14 rounded-xl border border-white/10 bg-white/[0.035]"
                  : "h-12 border border-black/15 bg-white"
              }
            />
          ))}
        </div>
      </div>
    </div>
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
                Le résultat se voit.
                <br />
                <span className="text-[var(--color-muted)]">L’expérience se raconte.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-base">
                Une présentation claire des retours et des transformations pour comprendre
                rapidement ce qui change entre une présence simplement en ligne et une
                présence réellement pensée pour convertir.
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
          <Eyebrow>Transformations</Eyebrow>
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="font-display text-balance max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Quatre univers.
              <br />
              <span className="text-[var(--color-muted)]">La même logique de conversion.</span>
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
              Chaque projet part d’un contexte différent. Le travail consiste à simplifier
              ce que le prospect voit, comprend et fait ensuite.
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-10">
            {PROJECTS.map((project) => (
              <article
                key={project.sector}
                className="overflow-hidden rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-bg)] p-4 sm:p-6"
              >
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                      Transformation {project.accent}
                    </p>
                    <h3 className="font-display mt-2 text-2xl font-semibold">{project.sector}</h3>
                  </div>
                  <span className="text-xs text-[var(--color-muted)]">Avant → Après</span>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <SiteMockup
                    mode="before"
                    sector={project.sector}
                    title={project.beforeTitle}
                    copy={project.beforeCopy}
                  />
                  <SiteMockup
                    mode="after"
                    sector={project.sector}
                    title={project.afterTitle}
                    copy={project.afterCopy}
                  />
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-[1.5rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 sm:flex-row sm:items-center">
            <div>
              <p className="font-display text-xl font-semibold">Votre site peut être le prochain.</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
                Le diagnostic permet de voir les changements prioritaires avant de parler refonte, SEO ou publicité.
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
