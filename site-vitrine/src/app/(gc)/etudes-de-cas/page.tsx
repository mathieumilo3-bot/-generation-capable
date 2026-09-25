import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { SITE_URL } from "@/lib/constants";
import { CONCEPT_CREDIT, DEMONSTRATIONS } from "@/lib/data/demonstrations";

export const metadata: Metadata = {
  title: "Études de cas",
  description:
    "Démonstrations sectorielles de Génération Capable : des sites complets conçus pour des entreprises fictives, avec la réflexion stratégique qui les explique.",
  alternates: { canonical: "/etudes-de-cas" },
};

export default function CaseStudiesPage() {
  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Études de cas", url: `${SITE_URL}/etudes-de-cas` },
        ]}
      />
      <Eyebrow>Études de cas</Eyebrow>
      <h1 className="font-display text-balance mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Des démonstrations complètes, secteur par secteur.
      </h1>
      <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
        Chaque démonstration est un site entier, conçu pour une entreprise fictive d&apos;un secteur donné, et accompagné de la réflexion
        qui l&apos;a produit. Ce sont des concepts : aucune n&apos;est présentée comme un client ni ne revendique de résultat.
      </p>

      <ul className="mt-16 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {DEMONSTRATIONS.map((demo) => (
          <li key={demo.slug} className="grid gap-6 py-10 lg:grid-cols-[1fr_2fr_auto] lg:items-start lg:gap-12">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">{demo.sector}</p>
              <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight">{demo.company}</h2>
              <p className="mt-2 text-xs text-[var(--color-accent)]">{CONCEPT_CREDIT}</p>
            </div>
            <p className="text-[15px] leading-relaxed text-[var(--color-muted)]">{demo.summary}</p>
            <div className="flex flex-col gap-3 text-sm">
              <Link href={demo.caseStudyPath} className="text-[var(--color-text)] underline decoration-[var(--color-accent)] underline-offset-4">
                Lire l&apos;étude de cas →
              </Link>
              <Link href={demo.demoPath} className="text-[var(--color-muted)] hover:text-[var(--color-text)]">
                Ouvrir la démonstration
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
