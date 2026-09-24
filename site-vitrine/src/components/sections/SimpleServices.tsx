import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

const SERVICES = [
  {
    number: "01",
    title: "Un site qui explique vite",
    body: "Une structure claire, des preuves visibles et une action principale évidente. Le visiteur comprend ce que vous faites sans fouiller.",
    href: "/creation-site-internet",
    cta: "Voir la création de site",
  },
  {
    number: "02",
    title: "Être trouvé au bon moment",
    body: "SEO local, Google et pages utiles pour capter les recherches qui correspondent réellement à votre activité.",
    href: "/solutions/referencement-local",
    cta: "Voir la visibilité",
  },
  {
    number: "03",
    title: "Transformer en demandes",
    body: "On simplifie le passage entre intérêt et contact : devis, rendez-vous, réservation, appel ou formulaire selon votre business.",
    href: "/solutions",
    cta: "Voir les solutions",
  },
] as const;

export function SimpleServices() {
  return (
    <Section id="services" className="py-16 sm:py-20">
      <Reveal>
        <Eyebrow>Ce qu’on fait</Eyebrow>
        <h2 className="font-display mt-4 max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Trois choses. Pas quinze prestations posées au hasard.
        </h2>
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-base">
          Le site, la visibilité et le parcours de conversion doivent raconter la même chose et pousser vers la même action.
        </p>
      </Reveal>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {SERVICES.map((service, index) => (
          <Reveal key={service.number} delay={index * 0.05}>
            <article className="flex h-full flex-col rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-7">
              <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--color-accent)]">{service.number}</span>
              <h3 className="font-display mt-5 text-2xl font-semibold tracking-tight">{service.title}</h3>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-[var(--color-muted)]">{service.body}</p>
              <div className="mt-6">
                <Button href={service.href} variant="secondary">
                  {service.cta} →
                </Button>
              </div>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
