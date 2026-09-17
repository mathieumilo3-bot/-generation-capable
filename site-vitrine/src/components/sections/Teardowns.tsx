import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { TEARDOWNS } from "@/lib/data/teardowns";

export function Teardowns() {
  const teardown = TEARDOWNS[0];

  return (
    <Section className="py-24 sm:py-32">
      <Reveal>
        <Eyebrow>Preuve par la démonstration</Eyebrow>
        <h2 className="font-display text-balance mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Nous préférons montrer.
        </h2>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Génération Capable démarre. Plutôt que d&apos;inventer des résultats,
          nous reconstruisons des pages d&apos;accueil à titre de démonstration —
          un concept illustratif, pas un client réel.
        </p>
      </Reveal>

      {teardown && (
        <Reveal delay={0.15}>
          <div className="mt-14 overflow-hidden rounded-2xl border border-[var(--color-border)]">
            <div className="border-b border-[var(--color-border)] bg-[var(--color-surface)] px-8 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)]">
                {teardown.sectorLabel}
              </p>
            </div>

            <div className="grid divide-y divide-[var(--color-border)] md:grid-cols-2 md:divide-x md:divide-y-0">
              <div className="p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-muted)]">
                  {teardown.before.label}
                </p>
                <ul className="mt-5 flex flex-col gap-3">
                  {teardown.before.points.map((point) => (
                    <li key={point} className="text-sm leading-relaxed text-[var(--color-muted)]">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[var(--color-accent-soft)]/40 p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
                  {teardown.after.label}
                </p>
                <ul className="mt-5 flex flex-col gap-3">
                  {teardown.after.points.map((point) => (
                    <li key={point} className="text-sm leading-relaxed text-[var(--color-text)]">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-[var(--color-border)] p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-muted)]">
                Pourquoi ?
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {teardown.why.map((reason) => (
                  <li key={reason} className="text-sm leading-relaxed text-[var(--color-muted)]">
                    — {reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      )}
    </Section>
  );
}
