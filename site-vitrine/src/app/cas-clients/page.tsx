import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { SITE_URL } from "@/lib/constants";

const APPLICATIONS = [
  {
    code: "LOCAL",
    title: "Entreprise locale",
    body: "Créer un parcours qui relie visibilité locale, preuve, prise de contact et qualification.",
    chain: "VISIBILITÉ → CONFIANCE → CONTACT",
  },
  {
    code: "SERVICE",
    title: "Entreprise de services",
    body: "Clarifier l'offre, traiter les objections et orienter chaque visiteur vers le bon prochain pas.",
    chain: "OFFRE → PARCOURS → RENDEZ-VOUS",
  },
  {
    code: "EXPERT",
    title: "Expert / indépendant",
    body: "Transformer l'attention issue des réseaux en découverte, qualification et opportunité commerciale.",
    chain: "ATTENTION → QUALIFICATION → ACTION",
  },
  {
    code: "GROWTH",
    title: "Entreprise en croissance",
    body: "Connecter les actifs digitaux pour disposer d'un système plus lisible, mesurable et évolutif.",
    chain: "ACQUISITION → CONVERSION → OPTIMISATION",
  },
];

export const metadata: Metadata = {
  title: "Applications",
  description:
    "Exemples d'architectures digitales conçues selon le modèle commercial, le parcours prospect et les objectifs de l'entreprise.",
  alternates: { canonical: "/cas-clients" },
};

export default function CasClientsPage() {
  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Applications", url: `${SITE_URL}/cas-clients` },
        ]}
      />

      <div className="max-w-3xl">
        <Eyebrow>Applications</Eyebrow>
        <h1 className="font-display text-balance mt-4 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Une architecture différente
          <br />
          <span className="text-[var(--color-muted)]">pour chaque modèle commercial.</span>
        </h1>
        <p className="mt-7 max-w-2xl text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
          Voici comment nous pensons un système digital selon le contexte,
          l'offre et l'action attendue du prospect.
        </p>
      </div>

      <div className="mt-16 grid gap-4 md:grid-cols-2">
        {APPLICATIONS.map((item, index) => (
          <article
            key={item.code}
            className="group relative overflow-hidden rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-7 transition-all duration-500 hover:-translate-y-1 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)] sm:p-9"
          >
            <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[var(--color-accent)]/[0.035] blur-3xl transition-opacity duration-500 group-hover:opacity-100" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-accent)]">
                  {item.code}
                </span>
                <span className="font-display text-sm text-[var(--color-muted)]">0{index + 1}</span>
              </div>
              <h2 className="font-display mt-16 text-2xl font-semibold tracking-tight sm:text-3xl">
                {item.title}
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
                {item.body}
              </p>
              <div className="mt-8 border-t border-[var(--color-border)] pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)]">
                  Logique
                </p>
                <p className="mt-2 font-display text-sm font-medium text-[var(--color-text)]">
                  {item.chain}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-14 flex flex-col gap-6 border-t border-[var(--color-border)] pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
          Le point de départ reste toujours le même : votre entreprise, votre marché
          et le comportement que vous voulez déclencher.
        </p>
        <Button href="/audit" variant="primary">
          Analyser mon entreprise →
        </Button>
      </div>
    </Section>
  );
}
