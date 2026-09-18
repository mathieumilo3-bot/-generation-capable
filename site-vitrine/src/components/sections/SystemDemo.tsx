import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const STEPS = [
  ["01", "ATTIRER", "Une personne arrive depuis Google, les réseaux, une recommandation ou une campagne."],
  ["02", "COMPRENDRE", "En quelques secondes, elle comprend ce que vous faites, pour qui et pourquoi vous."],
  ["03", "SE RASSURER", "Les preuves, réponses et éléments de réassurance lèvent les frictions inutiles."],
  ["04", "AGIR", "Le prochain pas est évident : demander, réserver, appeler ou prendre rendez-vous."],
  ["05", "SUIVRE", "La demande entre dans un parcours de suivi au lieu de disparaître dans la nature."],
];

export function SystemDemo() {
  return (
    <Section className="py-24 sm:py-32">
      <Reveal>
        <Eyebrow>La démonstration</Eyebrow>
        <h2 className="font-display text-balance mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Voici ce que votre prospect
          <br />
          <span className="text-[var(--color-muted)]">doit vivre.</span>
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="mt-12 overflow-hidden rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[0_30px_100px_rgba(0,0,0,0.22)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-5 sm:px-8">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-accent)]">Capable / Parcours</p>
              <p className="mt-1 font-display text-base font-semibold">De l&apos;attention à la demande</p>
            </div>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)] sm:block">Système connecté</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {STEPS.map(([number, title, body], index) => (
              <div key={number} className="grid gap-4 px-6 py-7 sm:grid-cols-[80px_180px_1fr] sm:items-center sm:px-8">
                <span className="font-display text-xs text-[var(--color-accent)]">{number}</span>
                <p className="text-xs font-semibold uppercase tracking-[0.2em]">{title}</p>
                <p className="max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">{body}</p>
                {index < STEPS.length - 1 && <span className="hidden" />}
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--color-border)] bg-[var(--color-accent-soft)] px-6 py-5 sm:px-8">
            <p className="text-sm font-medium">Le site n&apos;est plus une vitrine isolée. Il devient une étape du système commercial.</p>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
