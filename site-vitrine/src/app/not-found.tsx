import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { NAV_LINKS, PRIMARY_CTA_LABEL } from "@/lib/constants";
import { GcChrome } from "@/components/layout/GcChrome";

export const metadata: Metadata = {
  title: "Page introuvable",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <GcChrome>
      <Section className="py-28 sm:py-40">
        <div className="mx-auto max-w-xl text-center">
          <Eyebrow>Erreur 404</Eyebrow>
          <h1 className="font-display text-balance mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Cette page n&apos;existe pas.
          </h1>
          <p className="mt-6 text-[15px] leading-relaxed text-[var(--color-muted)]">
            Le lien est peut-être obsolète, ou l&apos;adresse comporte une
            erreur. Voici par où continuer.
          </p>

          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Button
              href="/audit"
              variant="primary"
              trackEvent="cta_clicked"
              trackPayload={{ location: "not_found" }}
            >
              {PRIMARY_CTA_LABEL} →
            </Button>
            <Button href="/" variant="secondary">
              Retour à l&apos;accueil
            </Button>
          </div>

          <nav className="mt-14 border-t border-[var(--color-border)] pt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-muted)]">
              Explorer
            </p>
            <ul className="mt-5 flex flex-wrap justify-center gap-x-8 gap-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/ressources"
                  className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
                >
                  Ressources
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </Section>
    </GcChrome>
  );
}
