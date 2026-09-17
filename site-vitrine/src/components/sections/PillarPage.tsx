import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { SITE_URL } from "@/lib/constants";

export type PillarBlock = { heading: string; body: string };

export function PillarPage({
  eyebrow,
  title,
  intro,
  blocks,
  path,
  ctaContext,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  blocks: PillarBlock[];
  path: string;
  ctaContext: string;
}) {
  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: title, url: `${SITE_URL}${path}` },
        ]}
      />
      <div className="mx-auto max-w-2xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="font-display text-balance mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-6 text-[15px] leading-relaxed text-[var(--color-muted)]">
          {intro}
        </p>

        <div className="mt-14 flex flex-col gap-10">
          {blocks.map((block) => (
            <div key={block.heading}>
              <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
                {block.heading}
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
                {block.body}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-14 border-t border-[var(--color-border)] pt-10">
          <Button
            href="/audit"
            variant="primary"
            trackEvent="cta_clicked"
            trackPayload={{ location: ctaContext }}
          >
            Analyser mon entreprise →
          </Button>
        </div>
      </div>
    </Section>
  );
}
