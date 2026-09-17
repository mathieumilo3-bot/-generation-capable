import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { CASE_STUDIES } from "@/lib/data/case-studies";

export function CaseStudiesPreview() {
  return (
    <Section className="py-24 sm:py-32">
      <Reveal>
        <Eyebrow>Cas clients</Eyebrow>
        <h2 className="font-display text-balance mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Des transformations,
          <br />
          <span className="text-[var(--color-muted)]">pas des promesses.</span>
        </h2>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-14 rounded-2xl border border-dashed border-[var(--color-border-strong)] p-10 text-center sm:p-16">
          {CASE_STUDIES.length === 0 ? (
            <>
              <p className="font-display text-2xl font-medium text-[var(--color-text)]">
                Premières transformations
              </p>
              <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)]">
                Génération Capable démarre son activité. Les cas clients
                publiés ici seront exclusivement de vraies réalisations,
                documentées avec le contexte, l&apos;intervention et les
                résultats mesurés.
              </p>
              <div className="mt-8">
                <Button href="/audit" variant="secondary">
                  Devenir une première transformation →
                </Button>
              </div>
            </>
          ) : (
            <p className="text-[var(--color-muted)]">Cas clients à venir.</p>
          )}
        </div>
      </Reveal>
    </Section>
  );
}
