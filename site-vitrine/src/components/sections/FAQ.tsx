import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const FAQS = [
  ["Je travaille surtout au bouche-à-oreille. À quoi sert le site ?", "Le bouche-à-oreille reste précieux. Le site sert à rassurer la personne qui a entendu parler de vous, à montrer vos réalisations et à capter aussi les recherches locales que le bouche-à-oreille ne couvre pas."],
  ["Je n'ai pas le temps de gérer du marketing tous les jours.", "Justement : le parcours doit fonctionner sans vous demander de publier en permanence. Les bases sont votre présence Google, vos pages métiers, vos réalisations et une demande de devis simple."],
  ["Vous refaites forcément tout mon site ?", "Non. On commence par ce qui existe. Parfois il faut une refonte ; parfois quelques pages, de meilleures preuves ou un formulaire de devis mieux pensé suffisent."],
  ["Vous travaillez seulement avec le bâtiment ?", "La priorité est donnée aux artisans, entreprises du bâtiment et activités locales, parce que le parcours client est très concret : recherche locale, confiance, devis puis rappel."],
];

export function FAQ() {
  return (
    <Section className="py-16 sm:py-20">
      <Reveal>
        <Eyebrow>Questions d&apos;artisans</Eyebrow>
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
