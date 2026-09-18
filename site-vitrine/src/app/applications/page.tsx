import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { BreadcrumbJsonLd } from "@/components/schema/JsonLd";
import { PRIMARY_CTA_LABEL, SITE_URL } from "@/lib/constants";
import { APPLICATIONS } from "@/lib/data/applications";

export const metadata: Metadata = {
  title: "Applications",
  description:
    "Quatre configurations du système Génération Capable selon votre activité : local, service, expert, growth. Des cas d'usage, pas des références clients.",
  alternates: { canonical: "/applications" },
};

export default function ApplicationsPage() {
  return (
    <Section className="py-24 sm:py-32">
      <BreadcrumbJsonLd
        items={[
          { name: "Accueil", url: SITE_URL },
          { name: "Applications", url: `${SITE_URL}/applications` },
        ]}
      />

      <Eyebrow>Applications</Eyebrow>
      <h1 className="font-display text-balance mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Le même système,
        <br />
        quatre configurations.
      </h1>
      <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
        Ces pages décrivent ce qu&apos;un système de ce type est conçu pour
        produire selon votre activité. Ce sont des cas d&apos;usage : aucune
        n&apos;est la description d&apos;une mission réalisée pour un client.
      </p>

      <div className="mt-16 flex flex-col divide-y divide-[var(--color-border)]">
        {APPLICATIONS.map((application) => (
          <article key={application.id} className="grid gap-8 py-12 lg:grid-cols-[auto_1fr]">
            <div className="lg:w-64">
              <div className="flex items-baseline gap-4">
                <span className="font-display text-sm text-[var(--color-accent)]">
                  {application.code}
                </span>
                <h2 className="font-display text-2xl font-semibold tracking-tight text-[var(--color-text)]">
                  {application.name}
                </h2>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
                {application.forWhom}
              </p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-muted)]">
                  Le problème
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-muted)]">
                  {application.problem}
                </p>
              </div>
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
                  Le système
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text)]">
                  {application.system}
                </p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {application.signals.map((signal) => (
                    <li
                      key={signal}
                      className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-muted)]"
                    >
                      {signal}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-14 border-t border-[var(--color-border)] pt-10">
        <Button
          href="/audit"
          variant="primary"
          trackEvent="cta_clicked"
          trackPayload={{ location: "applications_page" }}
        >
          {PRIMARY_CTA_LABEL} →
        </Button>
      </div>
    </Section>
  );
}
