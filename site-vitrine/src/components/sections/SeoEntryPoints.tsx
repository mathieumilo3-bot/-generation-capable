import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const ENTRY_POINTS = [
  {
    href: "/solutions/creation-site-artisan",
    title: "Création de site pour artisans",
    description: "Un site clair, crédible et orienté demandes de devis.",
  },
  {
    href: "/solutions/marketing-digital-btp",
    title: "Marketing digital BTP",
    description: "Visibilité locale, acquisition et demandes de chantiers.",
  },
  {
    href: "/solutions/publicite-google-ads",
    title: "Google Ads",
    description: "Capter les recherches à forte intention et mesurer les demandes.",
  },
  {
    href: "/audit",
    title: "Audit gratuit",
    description: "Identifier les freins prioritaires avant d'investir davantage.",
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
              className="block h-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-muted)]"
            >
              <h3 className="font-display text-base font-semibold text-[var(--color-text)]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                {item.description}
              </p>
            </Link>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
