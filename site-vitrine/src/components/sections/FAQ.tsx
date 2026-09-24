import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const FAQS = [
  [
    "Mon site existe déjà. Est-ce qu’il faut tout refaire ?",
    "Pas forcément. On commence par ce qui existe et on garde ce qui fonctionne. Une refonte n’a d’intérêt que si elle simplifie réellement le parcours du client.",
  ],
  [
    "Vous faites seulement le design ?",
    "Non. Le design sert la compréhension. On travaille aussi la structure, les preuves, la visibilité et l’action principale du site.",
  ],
  [
    "Vous travaillez uniquement avec les artisans ?",
    "Non. La méthode s’adapte aux artisans, PME, cabinets, commerces, agences et activités de service. Le parcours change selon la façon dont vos clients achètent.",
  ],
  [
    "Comment savoir quoi améliorer en premier ?",
    "Le diagnostic gratuit sert justement à ça : on regarde votre présence actuelle et on vous montre les priorités avant de parler de refonte ou de publicité.",
  ],
];

export function FAQ() {
  return (
    <Section className="py-16 sm:py-20">
      <Reveal>
        <Eyebrow>Questions fréquentes</Eyebrow>
        <h2 className="font-display mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Du concret avant tout.
        </h2>
      </Reveal>
      <div className="mt-12 max-w-4xl divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
        {FAQS.map(([question, answer], index) => (
          <Reveal key={question} delay={index * 0.05}>
            <details className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-base font-semibold tracking-tight [&::-webkit-details-marker]:hidden sm:text-lg">
                {question}
                <span className="shrink-0 text-xl font-normal text-[var(--color-accent)] transition-transform duration-300 group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 max-w-3xl pr-10 text-sm leading-relaxed text-[var(--color-muted)]">{answer}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
