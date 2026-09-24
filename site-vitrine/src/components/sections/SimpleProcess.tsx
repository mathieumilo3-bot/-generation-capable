import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const STEPS = [
  {
    number: "01",
    title: "On regarde l’existant",
    body: "Votre site, votre présence Google, vos offres, vos preuves et le chemin actuel jusqu’au contact.",
  },
  {
    number: "02",
    title: "On choisit les priorités",
    body: "On garde ce qui marche et on corrige ce qui bloque. Pas de refonte inutile juste pour refaire.",
  },
  {
    number: "03",
    title: "On construit un parcours simple",
    body: "Le prospect comprend, se rassure et sait quoi faire ensuite. Chaque page a un rôle précis.",
  },
] as const;

export function SimpleProcess() {
  return (
    <Section id="methode" tone="raised" className="py-16 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <Reveal>
          <div>
            <Eyebrow>Comment on travaille</Eyebrow>
            <h2 className="font-display mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Une méthode normale, lisible et utile.
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-base">
              Avant de parler design, on remet le parcours client dans le bon ordre.
            </p>
          </div>
        </Reveal>

        <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {STEPS.map((step, index) => (
            <Reveal key={step.number} delay={index * 0.05}>
              <div className="grid gap-3 py-6 sm:grid-cols-[70px_1fr] sm:gap-6">
                <span className="text-xs font-semibold tracking-[0.16em] text-[var(--color-accent)]">{step.number}</span>
                <div>
                  <h3 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{step.title}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--color-muted)]">{step.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
