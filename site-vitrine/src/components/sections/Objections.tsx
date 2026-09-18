import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

const OBJECTIONS = [
  ["« J'ai déjà un site. »", "Très bien. La question est de savoir ce qu'il fait après l'arrivée du visiteur."] ,
  ["« J'ai déjà Instagram. »", "Les réseaux attirent l'attention. Votre système doit ensuite transformer cette attention en action."] ,
  ["« Je fais déjà de la publicité. »", "L'acquisition ne corrige pas un parcours qui perd les prospects en route."] ,
  ["« Je reçois déjà des demandes. »", "L'enjeu est de rendre le parcours plus clair, plus qualifié et plus simple à suivre."] ,
];

export function Objections() {
  return (
    <Section tone="raised" className="py-24 sm:py-32">
      <Reveal>
        <Eyebrow>Les vraies questions</Eyebrow>
        <h2 className="font-display text-balance mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Vous n'avez peut-être pas besoin de plus de trafic.
          <br />
          <span className="text-[var(--color-muted)]">Vous avez peut-être besoin d'un meilleur parcours.</span>
        </h2>
      </Reveal>
      <div className="mt-12 grid gap-3 md:grid-cols-2">
        {OBJECTIONS.map(([question, answer], index) => (
          <Reveal key={question} delay={index * 0.06}>
            <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 sm:p-7">
              <h3 className="font-display text-lg font-semibold tracking-tight">{question}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{answer}</p>
            </article>
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.18}>
        <div className="mt-10 flex flex-col gap-4 border-t border-[var(--color-border)] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">Le diagnostic permet de distinguer ce qui mérite d'être conservé, corrigé ou reconstruit.</p>
          <Button href="/audit" variant="primary" trackEvent="cta_clicked" trackPayload={{ location: "objections" }}>Analyser mon entreprise →</Button>
        </div>
      </Reveal>
    </Section>
  );
}
