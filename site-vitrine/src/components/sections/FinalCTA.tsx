import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { PRIMARY_CTA_LABEL } from "@/lib/constants";

export function FinalCTA() {
  return (
    <Section tone="black" className="py-28 text-center sm:py-36">
      <Reveal className="flex flex-col items-center">
        <h2 className="font-display text-balance max-w-3xl text-3xl font-semibold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
          Et si votre présence
          <br />
          commençait enfin
          <br />
          à travailler pour vous ?
        </h2>

        <div className="mt-10">
          <Button
            href="/audit"
            variant="primary"
            trackEvent="cta_clicked"
            trackPayload={{ location: "final_cta" }}
          >
            {PRIMARY_CTA_LABEL} →
          </Button>
        </div>

        <p className="mt-5 text-sm text-[var(--color-muted)]">
          Diagnostic initial · Sans engagement
        </p>
      </Reveal>
    </Section>
  );
}
