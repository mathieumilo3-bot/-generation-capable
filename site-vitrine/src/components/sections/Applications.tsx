import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { APPLICATIONS } from "@/lib/data/applications";

export function Applications() {
  return (
    <Section tone="raised" className="py-24 sm:py-32">
      <Reveal>
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <Eyebrow>Applications</Eyebrow>
            <h2 className="font-display text-balance mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              À quoi ressemble
              <br />
              le système chez vous.
            </h2>
          </div>
          <Button href="/applications" variant="secondary" className="shrink-0">
            Voir le détail →
          </Button>
        </div>
        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          Quatre configurations selon votre activité. Ce sont des cas
          d&apos;usage, pas des références clients.
        </p>
      </Reveal>

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        {APPLICATIONS.map((application, index) => (
          <Reveal key={application.id} delay={index * 0.08}>
            <article className="flex h-full flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 transition-colors duration-300 hover:border-[var(--color-border-strong)]">
              <div className="flex items-baseline gap-4">
                <span className="font-display text-sm text-[var(--color-accent)]">
                  {application.code}
                </span>
                <h3 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                  {application.name}
                </h3>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                {application.forWhom}
              </p>

              <p className="mt-6 text-[15px] leading-relaxed text-[var(--color-muted)]">
                {application.problem}
              </p>
              <p className="mt-4 text-[15px] leading-relaxed text-[var(--color-text)]">
                {application.system}
              </p>

              <ul className="mt-auto flex flex-wrap gap-2 pt-8">
                {application.signals.map((signal) => (
                  <li
                    key={signal}
                    className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-muted)]"
                  >
                    {signal}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
