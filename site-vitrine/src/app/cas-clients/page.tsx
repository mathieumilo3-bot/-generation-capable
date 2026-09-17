import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { SITE_URL } from "@/lib/constants";
import { CASE_STUDIES } from "@/lib/data/case-studies";

export const metadata: Metadata = {
  title: "Cas clients",
  description:
    "Les transformations réelles menées par Génération Capable — contexte, intervention, système et résultats mesurés.",
  alternates: { canonical: "/cas-clients" },
};

export default function CasClientsPage() {
  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Cas clients", url: `${SITE_URL}/cas-clients` },
        ]}
      />
      <Eyebrow>Cas clients</Eyebrow>
      <h1 className="font-display text-balance mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Des transformations, pas des promesses.
      </h1>

      <div className="mt-14 rounded-2xl border border-dashed border-[var(--color-border-strong)] p-10 text-center sm:p-16">
        {CASE_STUDIES.length === 0 ? (
          <>
            <p className="font-display text-2xl font-medium text-[var(--color-text)]">
              Premières transformations
            </p>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)]">
              Génération Capable démarre son activité. Chaque cas publié ici
              sera une réalisation réelle et vérifiable : contexte, problème,
              intervention, système déployé, résultats mesurés et témoignage.
              Rien n&apos;est inventé.
            </p>
            <div className="mt-8">
              <Button href="/audit" variant="secondary">
                Devenir une première transformation →
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </Section>
  );
}
