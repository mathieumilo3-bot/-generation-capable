import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { SectorCard } from "@/components/cards/SectorCard";
import { Button } from "@/components/ui/Button";
import { SECTORS } from "@/lib/data/sectors";

export function SectorsPreview() {
  return (
    <Section tone="raised" className="py-24 sm:py-32">
      <Reveal>
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <Eyebrow>Secteurs</Eyebrow>
            <h2 className="font-display text-balance mt-4 max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Des systèmes adaptés à votre activité.
            </h2>
          </div>
          <Button href="/secteurs" variant="secondary" className="shrink-0">
            Tous les secteurs →
          </Button>
        </div>
      </Reveal>

      <div className="mt-12">
        {SECTORS.slice(0, 5).map((sector) => (
          <SectorCard key={sector.slug} sector={sector} />
        ))}
      </div>
    </Section>
  );
}
