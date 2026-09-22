"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type HeroVariant = {
  badge: string;
  title: string;
  accent: string;
  body: string;
  cta: string;
  key: string;
};

const VARIANTS: Record<string, HeroVariant> = {
  default: {
    badge: "Audit artisans & BTP · Gratuit",
    title: "Votre site vous ramène",
    accent: "vraiment des demandes de devis ?",
    body:
      "On vérifie ce qu’un client voit avant de vous appeler : Google, vos métiers, vos réalisations, votre zone et la prise de contact.",
    cta: "Vérifier mon site gratuitement →",
    key: "default",
  },
  chantiers: {
    badge: "Audit acquisition artisan · Gratuit",
    title: "Vous cherchez",
    accent: "plus de chantiers ?",
    body:
      "On vérifie comment Google, votre site et vos preuves transforment une recherche locale en vraie demande de devis.",
    cta: "Voir ce qui bloque mes demandes →",
    key: "chantiers",
  },
  site: {
    badge: "Audit site artisan · Gratuit",
    title: "Votre site vous aide-t-il",
    accent: "vraiment à décrocher des chantiers ?",
    body:
      "On regarde si votre site montre assez vite votre métier, vos réalisations, votre zone et la prochaine étape pour demander un devis.",
    cta: "Analyser mon site gratuitement →",
    key: "site",
  },
  seo: {
    badge: "Audit visibilité locale · Gratuit",
    title: "Vos futurs clients",
    accent: "vous trouvent-ils sur Google ?",
    body:
      "On vérifie vos métiers, vos zones, vos pages et les freins qui peuvent vous faire perdre des recherches locales qualifiées.",
    cta: "Vérifier ma visibilité Google →",
    key: "seo",
  },
};

function variantFromContent(content: string | null): HeroVariant {
  const value = (content || "").toLowerCase();
  if (value.includes("seo_artisan")) return VARIANTS.seo;
  if (value.includes("site_artisan")) return VARIANTS.site;
  if (value.includes("chantiers") || value.includes("artisan_devis")) return VARIANTS.chantiers;
  return VARIANTS.default;
}

export function AuditHero() {
  const [variant, setVariant] = useState<HeroVariant>(VARIANTS.default);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setVariant(variantFromContent(params.get("utm_content")));
  }, []);

  return (
    <div className="mx-auto max-w-4xl text-center">
      <div className="mx-auto inline-flex items-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)] sm:text-xs">
        {variant.badge}
      </div>

      <h1 className="font-display mx-auto mt-6 max-w-3xl text-balance text-[2.65rem] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
        {variant.title} <span className="gold-text">{variant.accent}</span>
      </h1>

      <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-lg">
        {variant.body}
      </p>

      <div className="mt-8 flex justify-center">
        <Button
          href="#audit-form"
          variant="primary"
          className="min-h-14 w-full max-w-sm px-8 text-base sm:w-auto"
          trackEvent="audit_cta_clicked"
          trackPayload={{ location: "audit_hero", variant: variant.key }}
        >
          {variant.cta}
        </Button>
      </div>

      <p className="mt-4 text-xs text-[var(--color-muted)]">
        Gratuit · Sans engagement · Réponse personnalisée
      </p>

      <div className="mx-auto mt-9 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">
        {[
          ["01", "Être trouvé"],
          ["02", "Rassurer"],
          ["03", "Obtenir un devis"],
        ].map(([number, label]) => (
          <div
            key={label}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-4 sm:px-5"
          >
            <span className="text-[9px] font-semibold tracking-[0.18em] text-[var(--color-accent)]">
              {number}
            </span>
            <p className="font-display mt-1.5 text-xs font-medium sm:text-sm">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
