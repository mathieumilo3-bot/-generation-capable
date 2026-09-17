import { Section, Eyebrow } from "@/components/ui/Section";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Reveal";

const BLOCKS = [
  {
    number: "01",
    title: "VISIBILITÉ",
    lead: "Être visible ne suffit pas.",
    body: "Du trafic sans intention n'est qu'une statistique. La question n'est pas d'être vu, mais d'être vu par les bonnes personnes.",
  },
  {
    number: "02",
    title: "CONFIANCE",
    lead: "Être crédible ne suffit pas.",
    body: "La confiance ouvre la porte, elle ne fait pas entrer le client. Il faut ensuite le guider vers une décision.",
  },
  {
    number: "03",
    title: "CONVERSION",
    lead: "Il faut transformer l'attention en action.",
    body: "Chaque étape sans action claire est une opportunité qui se dissout. Le système existe pour combler cet écart.",
  },
];

export function Problem() {
  return (
    <Section className="py-24 sm:py-32" tone="raised">
      <Reveal>
        <Eyebrow>Le constat</Eyebrow>
        <h2 className="font-display text-balance mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Le problème n&apos;est pas votre présence.
          <br />
          <span className="text-[var(--color-muted)]">
            Le problème, c&apos;est ce qu&apos;elle produit.
          </span>
        </h2>
      </Reveal>

      <div className="mt-16 grid gap-6 md:grid-cols-3">
        {BLOCKS.map((block, index) => (
          <Reveal key={block.number} delay={index * 0.12}>
            <Card className="h-full">
              <p className="font-display text-sm text-[var(--color-muted)]">
                {block.number}
              </p>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
                {block.title}
              </p>
              <p className="font-display mt-4 text-xl font-medium leading-snug text-[var(--color-text)]">
                {block.lead}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                {block.body}
              </p>
            </Card>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
