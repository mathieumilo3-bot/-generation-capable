import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Étude de cas GC Agence : site, SEO et acquisition",
  description:
    "Étude de cas publique de GC Agence : architecture du site, SEO, audit, tracking, déploiement et méthode de travail, sans résultat inventé.",
  alternates: { canonical: "/realisations/gc-agence" },
};

const ITEMS = [
  {
    title: "Architecture commerciale",
    body: "Le site a été structuré autour de pages commerciales prioritaires, de ressources de soutien, d'un audit et d'un parcours vers la prise de rendez-vous.",
  },
  {
    title: "Socle SEO",
    body: "Titres, H1, canoniques, sitemap, robots.txt, données structurées et maillage interne ont été travaillés avant de chercher à multiplier les nouvelles pages.",
  },
  {
    title: "Acquisition et conversion",
    body: "Le diagnostic en ligne, Calendly et le suivi des sources marketing ont été reliés pour distinguer le trafic des demandes réellement exploitables.",
  },
  {
    title: "Déploiement vérifiable",
    body: "Le site est versionné sur GitHub et déployé sur Netlify. Les changements importants passent par des previews avant publication sur le domaine principal.",
  },
  {
    title: "Autorité externe",
    body: "Le travail ne s'arrête pas au site : profils d'agence, références publiques, citations d'entreprise et opportunités éditoriales sont recherchés sans achat de liens artificiels.",
  },
  {
    title: "Mesure avant promesse",
    body: "Aucune hausse de position, de trafic ou de chiffre d'affaires n'est affichée tant qu'elle n'est pas réellement observée dans les données disponibles.",
  },
];

export default function CaseStudyPage() {
  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Réalisations", url: `${SITE_URL}/realisations/gc-agence` },
          { name: "GC Agence", url: `${SITE_URL}/realisations/gc-agence` },
        ]}
      />
      <div className="mx-auto max-w-3xl">
        <Eyebrow>Étude de cas publique</Eyebrow>
        <h1 className="font-display mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          GC Agence : construire notre propre système avant de le proposer aux autres.
        </h1>
        <p className="mt-6 text-[16px] leading-relaxed text-[var(--color-muted)]">
          Cette étude de cas documente le travail réalisé sur gc-agence.com. Il s'agit d'un projet
          interne réel : aucune entreprise cliente n'est présentée et aucun résultat commercial
          n'est inventé. L'objectif est de montrer la méthode, les livrables et les choix réalisés.
        </p>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {ITEMS.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
            >
              <h2 className="font-display text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{item.body}</p>
            </article>
          ))}
        </div>

        <section className="mt-14 border-t border-[var(--color-border)] pt-10">
          <h2 className="font-display text-2xl font-semibold">Ce qui est déjà public et vérifiable</h2>
          <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
            <li>• Site principal : gc-agence.com</li>
            <li>• Pages commerciales dédiées à la création de site, au SEO et au référencement local.</li>
            <li>• Audit en ligne relié au parcours de prise de rendez-vous.</li>
            <li>• Sitemap, robots.txt et vérification Google Search Console en production.</li>
            <li>• Identité légale et SIREN affichés sur la page À propos.</li>
          </ul>
        </section>

        <section className="mt-14 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold">Résultats : ce que nous pouvons dire aujourd'hui</h2>
          <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
            Le système est publié et mesurable. En revanche, cette étude de cas ne revendique
            actuellement aucun gain de classement, de trafic ou de chiffre d'affaires. Ces éléments
            seront ajoutés uniquement lorsqu'ils pourront être observés et vérifiés.
          </p>
        </section>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            href="/audit"
            className="rounded-full bg-[var(--color-text)] px-6 py-3 text-sm font-semibold text-[var(--color-bg)]"
          >
            Analyser mon entreprise →
          </Link>
          <Link
            href="/a-propos"
            className="rounded-full border border-[var(--color-border)] px-6 py-3 text-sm font-semibold"
          >
            Vérifier l'entreprise →
          </Link>
        </div>
      </div>
    </Section>
  );
}
