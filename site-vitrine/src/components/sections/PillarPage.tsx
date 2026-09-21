import Link from "next/link";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { BreadcrumbJsonLd, ServiceJsonLd } from "@/components/schema/JsonLd";
import { PRIMARY_CTA_LABEL, SITE_URL } from "@/lib/constants";
import { CALENDLY_URL } from "@/lib/booking";

export type PillarBlock = { heading: string; body: string };

type CommercialSection = {
  heading: string;
  intro: string;
  points: { heading: string; body: string }[];
  proofNote?: string;
};

export function PillarPage({
  eyebrow,
  title,
  intro,
  blocks,
  path,
  ctaContext,
  relatedLinks = [],
  commercialSection,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  blocks: PillarBlock[];
  path: string;
  ctaContext: string;
  relatedLinks?: { href: string; label: string; description: string }[];
  commercialSection?: CommercialSection;
}) {
  const bookingUrl = `${CALENDLY_URL}?utm_source=gc_agence&utm_medium=website&utm_campaign=seo_commercial&utm_content=${encodeURIComponent(
    ctaContext
  )}`;

  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: title, url: `${SITE_URL}${path}` },
        ]}
      />
      <ServiceJsonLd
        name={title}
        description={intro}
        url={`${SITE_URL}${path}`}
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

        {commercialSection && (
          <section className="mt-14 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
            <h2 className="font-display text-2xl font-semibold text-[var(--color-text)]">
              {commercialSection.heading}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
              {commercialSection.intro}
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {commercialSection.points.map((point) => (
                <div
                  key={point.heading}
                  className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5"
                >
                  <h3 className="font-display text-base font-semibold text-[var(--color-text)]">
                    {point.heading}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                    {point.body}
                  </p>
                </div>
              ))}
            </div>

            {commercialSection.proofNote && (
              <p className="mt-6 text-sm leading-relaxed text-[var(--color-muted)]">
                {commercialSection.proofNote}
              </p>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button
                href="/audit"
                variant="primary"
                trackEvent="cta_clicked"
                trackPayload={{ location: `${ctaContext}_commercial_audit` }}
              >
                {PRIMARY_CTA_LABEL} →
              </Button>
              <Button
                href={bookingUrl}
                variant="secondary"
                target="_blank"
                rel="noopener noreferrer"
                trackEvent="cta_clicked"
                trackPayload={{ location: `${ctaContext}_commercial_booking` }}
              >
                Réserver un échange de 30 min →
              </Button>
            </div>
          </section>
        )}

        {relatedLinks.length > 0 && (
          <section className="mt-14 border-t border-[var(--color-border)] pt-10">
            <h2 className="font-display text-xl font-semibold text-[var(--color-text)]">
              Préparer votre projet
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {relatedLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-muted)]">
                  <h3 className="font-display text-base font-semibold">{link.label}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{link.description}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-14 border-t border-[var(--color-border)] pt-10">
          <p className="mb-5 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
            {commercialSection
              ? "Commencez par le diagnostic si vous voulez identifier les priorités avant de parler budget. Si votre besoin est déjà défini, vous pouvez réserver directement un échange."
              : "Commencez par le diagnostic pour identifier les priorités avant de parler budget et éviter de lancer des actions inutiles."}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              href="/audit"
              variant="primary"
              trackEvent="cta_clicked"
              trackPayload={{ location: ctaContext }}
            >
              {PRIMARY_CTA_LABEL} →
            </Button>
            {commercialSection && (
              <Button
                href={bookingUrl}
                variant="secondary"
                target="_blank"
                rel="noopener noreferrer"
                trackEvent="cta_clicked"
                trackPayload={{ location: `${ctaContext}_booking` }}
              >
                Réserver 30 min →
              </Button>
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
