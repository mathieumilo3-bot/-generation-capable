import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

const ENTRY_POINTS = [
  {
    href: "/solutions/creation-site-artisan",
    title: "Création de site pour artisans",
    description: "Un site clair, crédible et orienté demandes de devis.",
    cta: "Voir la solution",
  },
  {
    href: "/solutions/marketing-digital-btp",
    title: "Marketing digital BTP",
    description: "Visibilité locale, acquisition et demandes de chantiers.",
    cta: "Voir la stratégie",
  },
  {
    href: "/solutions/publicite-google-ads",
    title: "Google Ads",
    description: "Capter les recherches à forte intention et mesurer les demandes.",
    cta: "Voir le système",
  },
  {
    href: "/audit",
    title: "Audit gratuit",
    description: "Identifier les freins prioritaires avant d'investir davantage.",
    cta: "Lancer mon audit",
  },
] as const;

export function SeoEntryPoints() {
  return (
    <Section className="py-14 sm:py-16">
      <Reveal>
        <Eyebrow>Accès directs</Eyebrow>
        <h2 className="font-display text-balance mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Allez directement à votre priorité.
        </h2>
      </Reveal>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ENTRY_POINTS.map((item, index) => (
          <Reveal key={item.href} delay={index * 0.04}>
            <Link
              href={item.href}
              className="group flex h-full min-h-[190px] flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-muted)]"
            >
              <h3 className="font-display text-base font-semibold text-[var(--color-text)]">
                {item.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--color-muted)]">
                {item.description}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
                <span className="text-xs font-semibold text-[var(--color-text)]">
                  {item.cta}
                </span>
                <span
                  aria-hidden
                  className="text-[var(--color-accent)] transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.12}>
        <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="font-display text-base font-semibold text-[var(--color-text)]">
              Vous ne savez pas quelle priorité choisir ?
            </p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
              On part de votre situation et on identifie les premières actions utiles.
            </p>
          </div>
          <Button
            href="/audit"
            variant="primary"
            trackEvent="cta_clicked"
            trackPayload={{ location: "seo_entry_points_footer" }}
          >
            Analyser mon entreprise →
          </Button>
        </div>
      </Reveal>
    </Section>
  );
}
