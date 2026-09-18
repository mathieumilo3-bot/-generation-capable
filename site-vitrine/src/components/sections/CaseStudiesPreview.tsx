import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

const EXAMPLES = [
  ["LOCAL", "Entreprise locale", "Visibilité, preuve, prise de contact et qualification réunies dans un parcours unique."],
  ["SERVICE", "Entreprise de services", "Offre clarifiée, objections traitées et visiteur orienté vers le bon prochain pas."],
  ["EXPERT", "Expert / indépendant", "Attention issue des réseaux transformée en découverte, qualification et rendez-vous."],
];

export function CaseStudiesPreview() {
  return (
    <Section className="py-24 sm:py-32">
      <Reveal>
        <Eyebrow>Applications</Eyebrow>
        <h2 className="font-display text-balance mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Des architectures adaptées
          <br />
          <span className="text-[var(--color-muted)]">à votre modèle commercial.</span>
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {EXAMPLES.map(([type, title, text], index) => (
          <Reveal key={title} delay={index * 0.08}>
            <article className="group h-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-7 transition-all duration-500 hover:-translate-y-1 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)] sm:p-8">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-accent)]">{type}</span>
                <span className="text-xs text-[var(--color-muted)]">0{index + 1}</span>
              </div>
              <h3 className="font-display mt-16 text-2xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-[var(--color-muted)]">{text}</p>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.15}>
        <div className="mt-10 flex flex-col items-start justify-between gap-5 border-t border-[var(--color-border)] pt-8 sm:flex-row sm:items-center">
          <p className="max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
            Chaque système part de votre offre, de votre marché et du comportement attendu du prospect.
          </p>
          <Button href="/audit" variant="secondary">Faire analyser mon entreprise →</Button>
        </div>
      </Reveal>
    </Section>
  );
}
