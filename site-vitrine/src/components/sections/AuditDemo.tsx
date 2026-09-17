import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { AuditScore } from "@/components/ui/AuditScore";
import { Button } from "@/components/ui/Button";

const DEMO_SCORES = [
  { label: "Visibilité", score: 78 },
  { label: "Crédibilité", score: 71 },
  { label: "Conversion", score: 43 },
  { label: "Parcours", score: 52 },
];

export function AuditDemo() {
  return (
    <Section tone="raised" className="py-24 sm:py-32">
      <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
        <div>
          <Reveal>
            <Eyebrow>Capable Audit</Eyebrow>
            <h2 className="font-display text-balance mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Avant de construire,
              <br />
              nous analysons.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)]">
              Découvrez les opportunités cachées dans votre présence digitale
              — visibilité, crédibilité, conversion et parcours client.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-10">
              <Button
                href="/audit"
                variant="primary"
                trackEvent="cta_clicked"
                trackPayload={{ location: "audit_demo" }}
              >
                Obtenir mon audit →
              </Button>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <div className="rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg)] p-8 sm:p-10">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)]">
                Aperçu — interface de démonstration
              </p>
              <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            </div>

            <div className="mt-8 flex flex-col gap-7">
              {DEMO_SCORES.map((item, index) => (
                <AuditScore
                  key={item.label}
                  label={item.label}
                  score={item.score}
                  delay={index * 0.1}
                />
              ))}
            </div>

            <div className="mt-9 flex items-center gap-3 rounded-xl border border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)] px-5 py-4">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
              <p className="text-sm text-[var(--color-text)]">
                3 opportunités prioritaires détectées.
              </p>
            </div>

            <p className="mt-5 text-xs leading-relaxed text-[var(--color-muted)]">
              Illustration du format de restitution. Les scores affichés sont
              un exemple : votre audit réel est réalisé individuellement pour
              votre entreprise.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
