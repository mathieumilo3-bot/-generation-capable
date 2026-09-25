"use client";

import { useEffect } from "react";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error:", error);
  }, [error]);

  return (
    <Section className="py-28 sm:py-40">
      <div className="mx-auto max-w-xl text-center">
        <Eyebrow>Erreur</Eyebrow>
        <h1 className="font-display text-balance mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Quelque chose s&apos;est mal passé.
        </h1>
        <p className="mt-6 text-[15px] leading-relaxed text-[var(--color-muted)]">
          Un incident technique nous empêche d&apos;afficher cette page. Vous
          pouvez réessayer, ou nous contacter directement via le diagnostic.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-text)] px-7 py-3.5 text-sm font-medium text-[var(--color-bg)] transition-all duration-300 hover:bg-[var(--color-accent)]"
          >
            Réessayer
          </button>
          <Button href="/" variant="secondary">
            Retour à l&apos;accueil
          </Button>
        </div>

        {error.digest && (
          <p className="mt-10 text-xs text-[var(--color-muted)]">
            Référence de l&apos;incident : {error.digest}
          </p>
        )}
      </div>
    </Section>
  );
}
