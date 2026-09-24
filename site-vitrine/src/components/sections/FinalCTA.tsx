import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";

export function FinalCTA() {
  return (
    <Section tone="black" className="py-20 text-center sm:py-24">
      <Reveal className="flex flex-col items-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
          Votre présence peut être plus simple
        </p>
        <h2 className="font-display text-balance mt-5 max-w-3xl text-3xl font-semibold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
          Voyons ce qui bloque
          <br />
          et ce qu&apos;il faut
          <br />
          simplifier.
        </h2>

        <div className="mt-8">
          <Button href="/audit" variant="primary" trackEvent="cta_clicked" trackPayload={{ location: "final_cta" }}>
            Analyser mon site gratuitement →
          </Button>
        </div>

        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Audit gratuit · Sans engagement
        </p>
      </Reveal>
    </Section>
  );
}
