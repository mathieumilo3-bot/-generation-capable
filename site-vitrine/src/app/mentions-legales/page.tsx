import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Mentions légales",
  robots: { index: false, follow: true },
  alternates: { canonical: "/mentions-legales" },
};

export default function MentionsLegalesPage() {
  return (
    <Section className="py-24 sm:py-32">
      <div className="mx-auto max-w-2xl">
        <Eyebrow>Informations légales</Eyebrow>
        <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Mentions légales
        </h1>
        <div className="mt-10 flex flex-col gap-6 text-[15px] leading-relaxed text-[var(--color-muted)]">
          <p>
            Cette page sera complétée avec les informations légales de
            l&apos;entité exploitant Génération Capable (dénomination, forme
            juridique, siège social, immatriculation, contact, directeur de
            publication et hébergeur) avant toute mise en production
            publique.
          </p>
        </div>
      </div>
    </Section>
  );
}
