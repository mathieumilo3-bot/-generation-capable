import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { CALENDLY_URL } from "@/lib/booking";

export const metadata: Metadata = {
  title: "Diagnostic acquisition GC",
  description:
    "Diagnostic de votre visibilité, de votre site et de votre parcours commercial pour identifier les priorités qui peuvent générer davantage de demandes.",
  robots: {
    index: false,
    follow: true,
  },
};

const SNAP_UTM =
  "utm_source=snapchat&utm_medium=paid_social&utm_campaign=snap_prospecting&utm_content=landing_snap";

const auditHref = `/audit?${SNAP_UTM}`;
const bookingHref = `${CALENDLY_URL}?${SNAP_UTM}`;

const POINTS = [
  {
    number: "01",
    title: "Être trouvé",
    text: "Voir si votre présence actuelle capte réellement les recherches et les prospects qui comptent.",
  },
  {
    number: "02",
    title: "Convaincre",
    text: "Repérer ce qui crée du doute sur votre site, votre offre et vos preuves avant la prise de contact.",
  },
  {
    number: "03",
    title: "Faire agir",
    text: "Réduire les frictions entre l'arrivée sur votre page et la demande de devis ou le rendez-vous.",
  },
] as const;

export default function SnapLandingPage() {
  return (
    <>
      <Section className="pb-16 pt-20 sm:pb-24 sm:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <Eyebrow>GC · Diagnostic acquisition</Eyebrow>
          <h1 className="font-display text-balance mt-5 text-4xl font-semibold leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
            Votre présence en ligne doit produire
            <span className="gold-text"> des demandes.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-[16px] leading-relaxed text-[var(--color-muted)] sm:text-lg">
            On analyse votre site, votre visibilité et votre parcours commercial pour identifier
            les corrections qui méritent d&apos;être traitées en premier.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              href={auditHref}
              variant="primary"
              trackEvent="cta_clicked"
              trackPayload={{ location: "snap_landing_audit", source: "snapchat" }}
            >
              Recevoir mon diagnostic →
            </Button>
            <Button
              href={bookingHref}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              trackEvent="booking_started"
              trackPayload={{ location: "snap_landing_booking", source: "snapchat" }}
            >
              Réserver 30 min →
            </Button>
          </div>

          <p className="mt-5 text-xs text-[var(--color-muted)]">
            Sans engagement · Analyse personnalisée · Aucun résultat inventé
          </p>
        </div>
      </Section>

      <Section className="pb-20 sm:pb-28">
        <div className="mx-auto grid max-w-5xl gap-3 md:grid-cols-3">
          {POINTS.map((point) => (
            <article
              key={point.number}
              className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                {point.number}
              </span>
              <h2 className="font-display mt-4 text-xl font-semibold">{point.title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{point.text}</p>
            </article>
          ))}
        </div>

        <div className="mx-auto mt-10 max-w-3xl rounded-3xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-7 text-center sm:p-10">
          <p className="font-display text-2xl font-semibold sm:text-3xl">
            Pas besoin de deviner ce qui bloque.
          </p>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
            Le diagnostic part de votre activité réelle. On regarde ce qui attire, ce qui rassure
            et ce qui empêche aujourd&apos;hui un prospect de passer à l&apos;action.
          </p>
          <Button
            href={auditHref}
            variant="primary"
            trackEvent="cta_clicked"
            trackPayload={{ location: "snap_landing_bottom", source: "snapchat" }}
            className="mt-7"
          >
            Analyser mon entreprise →
          </Button>
        </div>
      </Section>
    </>
  );
}
