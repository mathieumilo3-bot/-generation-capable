import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const ENTRY_POINTS = [
  {
    href: "/creation-site-internet",
    title: "Créer un site internet",
    description: "Site professionnel, architecture de services et conversion.",
  },
  {
    href: "/seo",
    title: "Être visible sur Google",
    description: "SEO, contenus, structure et progression organique.",
  },
  {
    href: "/solutions/agence-marketing-digital",
    title: "Marketing digital",
    description: "SEO, Ads, contenu, social et acquisition dans un même système.",
  },
  {
    href: "/solutions/referencement-local",
    title: "Référencement local",
    description: "Google Maps, recherches locales et zones réellement servies.",
  },
  {
    href: "/solutions/generation-de-leads",
    title: "Générer des leads",
    description: "Pages, formulaires et parcours orientés demandes qualifiées.",
  },
  {
    href: "/solutions/generation-leads-b2b",
    title: "Génération de leads B2B",
    description: "Pipeline, qualification et rendez-vous commerciaux.",
  },
  {
    href: "/solutions/publicite-google-ads",
    title: "Google Ads",
    description: "Capter rapidement les recherches à forte intention.",
  },
  {
    href: "/solutions/marketing-digital-btp",
    title: "Marketing digital BTP",
    description: "Visibilité locale, prestations et demandes de devis.",
  },
] as const;

export function SeoEntryPoints() {
  return (
    <Section className="py-20 sm:py-24">
      <Reveal>
        <Eyebrow>Accès directs</Eyebrow>
        <h2 className="font-display text-balance mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          Trouvez directement la solution qui correspond à votre recherche.
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Créer un site, être trouvé sur Google ou recevoir davantage de demandes :
          partez de votre priorité pour découvrir les actions adaptées à votre entreprise.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
