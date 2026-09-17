import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  robots: { index: false, follow: true },
  alternates: { canonical: "/politique-de-confidentialite" },
};

export default function PolitiqueConfidentialitePage() {
  return (
    <Section className="py-24 sm:py-32">
      <div className="mx-auto max-w-2xl">
        <Eyebrow>Confidentialité</Eyebrow>
        <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Politique de confidentialité
        </h1>
        <div className="mt-10 flex flex-col gap-6 text-[15px] leading-relaxed text-[var(--color-muted)]">
          <p>
            Le formulaire Capable Audit collecte les informations que vous
            transmettez volontairement (site, secteur, objectif,
            coordonnées) dans le seul but de préparer votre diagnostic et de
            vous recontacter.
          </p>
          <p>
            Cette page sera complétée avec la politique de confidentialité
            complète (base légale, durée de conservation, sous-traitants,
            droits d&apos;accès et de suppression) avant toute mise en
            production publique et connexion d&apos;un traitement de données
            réel.
          </p>
        </div>
      </div>
    </Section>
  );
}
