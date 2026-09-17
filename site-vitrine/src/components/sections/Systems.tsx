import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { SystemCard } from "@/components/cards/SystemCard";
import { SYSTEMS } from "@/lib/data/systems";

export function Systems() {
  return (
    <Section id="systemes" tone="raised" className="py-24 sm:py-32">
      <Reveal>
        <Eyebrow>Les systèmes</Eyebrow>
        <h2 className="font-display text-balance mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Quatre systèmes.
          <br />
          <span className="text-[var(--color-muted)]">Une seule mécanique.</span>
        </h2>
      </Reveal>

      <div className="mt-16 grid gap-6 md:grid-cols-2">
        {SYSTEMS.map((system, index) => (
          <Reveal key={system.id} delay={index * 0.08}>
            <SystemCard system={system} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
