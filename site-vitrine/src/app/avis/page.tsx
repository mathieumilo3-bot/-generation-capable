import type { Metadata } from "next";
import { Section, Eyebrow } from "@/components/ui/Section";
import { ReviewForm } from "./ReviewForm";

export const metadata: Metadata = {
  title: "Donner votre avis sur GC Agence",
  description:
    "Partagez votre expérience réelle avec GC Agence : qualité de l'accompagnement, site internet, SEO, acquisition et suivi.",
  robots: { index: false, follow: true },
};

export default function ReviewsPage() {
  return (
    <Section className="py-16 sm:py-24">
      <div className="mx-auto max-w-2xl">
        <Eyebrow>Votre expérience</Eyebrow>
        <h1 className="font-display mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Votre avis nous aide à construire la suite.
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-base">
          Cette page est réservée aux personnes qui ont réellement travaillé avec GC Agence,
          reçu un audit, un accompagnement ou une prestation. Donnez votre avis librement :
          positif, mitigé ou négatif.
        </p>

        <div className="mt-10 rounded-[1.75rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 sm:p-8">
          <ReviewForm />
        </div>

        <p className="mt-5 text-xs leading-relaxed text-[var(--color-muted)]">
          Aucun avis n&apos;est publié automatiquement. Si vous autorisez sa publication,
          GC Agence pourra l&apos;utiliser comme témoignage en conservant le sens de votre message.
        </p>
      </div>
    </Section>
  );
}
