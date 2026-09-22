import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const FAQS = [
  ["Est-ce que vous refaites forcément mon site ?", "Non. Le diagnostic sert d'abord à comprendre ce qui existe déjà. Certaines entreprises ont besoin d'une refonte, d'autres surtout d'un meilleur parcours ou de briques complémentaires."],
  ["Est-ce réservé aux entreprises qui font de la publicité ?", "Non. Le système peut partir de votre trafic actuel : recherche, réseaux sociaux, recommandations, référencement, prospection ou campagnes."],
  ["Que se passe-t-il après l'audit ?", "Nous vous partageons les points prioritaires identifiés et le prochain niveau d'intervention pertinent pour votre situation."],
  ["Combien de temps faut-il pour commencer ?", "L'analyse commence par quelques informations simples sur votre entreprise. Les étapes suivantes dépendent du diagnostic et de vos objectifs."],
];

export function FAQ() {
  return (
    <Section className="py-16 sm:py-20">
      <Reveal>
        <Eyebrow>Questions fréquentes</Eyebrow>
        <h2 className="font-display mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">Avant de nous parler.</h2>
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
