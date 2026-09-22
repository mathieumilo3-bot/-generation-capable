"use client";

import { useState } from "react";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

const CLIENTS = [
  {
    name: "Fabien",
    date: "26 juillet 2026",
    context: "Création de site · stratégie digitale",
    quote:
      "J’ai aimé le fait qu’on ne parte pas directement dans le design. On a d’abord clarifié ce que le client devait comprendre et faire. Le projet était beaucoup plus structuré que ce que j’avais imaginé au départ.",
    site: "Atelier Croizé",
    sector: "Rénovation intérieure",
    src: "/demos/clients/fabien/index.html",
  },
  {
    name: "Soraya",
    date: "3 août 2026",
    context: "Positionnement · parcours client",
    quote:
      "Les explications étaient simples, concrètes et surtout adaptées à mon activité. J’ai compris où je perdais des gens et comment rendre le parcours beaucoup plus naturel.",
    site: "Soraya Studio",
    sector: "Bien-être · accompagnement",
    src: "/demos/clients/soraya/index.html",
  },
  {
    name: "Adrien",
    date: "17 août 2026",
    context: "Site internet · acquisition",
    quote:
      "Le rendu est propre mais ce que j’ai surtout apprécié, c’est la logique derrière. Chaque partie du site a un objectif et on sait exactement où on veut emmener la personne.",
    site: "Maison Nette",
    sector: "Nettoyage premium",
    src: "/demos/clients/adrien/index.html",
  },
  {
    name: "Dominique",
    date: "2 septembre 2026",
    context: "Visibilité · présence digitale",
    quote:
      "J’avais beaucoup d’informations mais rien n’était vraiment organisé. Le travail a permis de rendre l’ensemble plus lisible, plus crédible et beaucoup plus professionnel.",
    site: "Maison D.",
    sector: "Événementiel",
    src: "/demos/clients/dominique/index.html",
  },
] as const;

export function ReviewsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = CLIENTS[activeIndex];

  return (
    <Section id="avis-clients" tone="raised" className="scroll-mt-24 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Eyebrow>Avis clients & réalisations</Eyebrow>
              <h2 className="font-display text-balance mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Leur retour.
                <br />
                <span className="text-[var(--color-muted)]">Puis le site juste en dessous.</span>
              </h2>
            </div>
            <span className="w-fit rounded-full border border-[var(--color-border-strong)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
              Aperçu démo
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-8 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CLIENTS.map((client, index) => {
              const selected = index === activeIndex;
              return (
                <button
                  key={client.name}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-pressed={selected}
                  className={`shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-300 ${selected ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-black" : "border-[var(--color-border-strong)] bg-[var(--color-bg)] text-[var(--color-muted)] hover:text-[var(--color-text)]"}`}
                >
                  {client.name}
                </button>
              );
            })}
          </div>
        </Reveal>

        <div className="mt-5 overflow-hidden rounded-[1.75rem] border border-[var(--color-border-strong)] bg-[var(--color-bg)] shadow-[0_30px_100px_rgba(0,0,0,0.18)]">
          <div className="grid gap-0 lg:grid-cols-[0.78fr_1.22fr]">
            <div className="flex flex-col justify-between border-b border-[var(--color-border)] p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm tracking-[0.18em] text-[var(--color-accent)]" aria-label="5 étoiles sur 5">
                    ★★★★★
                  </div>
                  <span className="text-[11px] text-[var(--color-muted)]">{active.date}</span>
                </div>

                <p className="font-display mt-6 text-xl leading-relaxed text-[var(--color-text)] sm:text-2xl">
                  “{active.quote}”
                </p>
              </div>

              <div className="mt-8 border-t border-[var(--color-border)] pt-5">
                <p className="text-sm font-semibold text-[var(--color-text)]">{active.name}</p>
                <p className="mt-1 text-xs text-[var(--color-muted)]">{active.context}</p>
                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                    Site présenté
                  </p>
                  <p className="font-display mt-1 text-lg font-semibold">{active.site}</p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">{active.sector}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#f3f1ec] p-3 sm:p-4">
              <div className="overflow-hidden rounded-[1.25rem] border border-black/10 bg-white shadow-[0_18px_60px_rgba(0,0,0,0.14)]">
                <div className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-3">
                  <div className="flex gap-1.5" aria-hidden>
                    <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
                    <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-black/45">
                    Après GC
                  </span>
                </div>
                <div className="relative h-[460px] overflow-hidden bg-white sm:h-[560px]">
                  <iframe
                    key={active.src}
                    src={active.src}
                    title={`Site premium ${active.site}`}
                    className="pointer-events-none h-full w-full border-0"
                    loading="lazy"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/10 to-transparent" />
                </div>
              </div>

              <div className="flex flex-col gap-3 px-1 pb-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[var(--color-muted)]">
                  Aperçu limité pour garder la page rapide et lisible.
                </p>
                <Link
                  href={active.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-black/15 bg-black px-5 py-3 text-xs font-semibold text-white transition-opacity hover:opacity-85"
                >
                  Voir le site en plein écran →
                </Link>
              </div>
            </div>
          </div>
        </div>

        <Reveal delay={0.1}>
          <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="font-display text-base font-semibold">Votre site doit donner cette sensation dès les premières secondes.</p>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                On identifie les changements prioritaires avant de parler refonte, SEO ou publicité.
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
