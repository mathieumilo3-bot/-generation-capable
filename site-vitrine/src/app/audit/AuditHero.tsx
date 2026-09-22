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
    badge: "Pour artisans & entreprises du bâtiment",
    title: "Plus de demandes de devis.",
    accent: "À partir de ce que vous avez déjà.",
    body:
      "On regarde ce qui vous fait perdre des clients sur Google, votre site et votre parcours de devis, puis on vous montre quoi corriger en priorité.",
    cta: "Voir ce qui me fait perdre des devis →",
    key: "default",
  },
  chantiers: {
    badge: "Pour artisans & entreprises du bâtiment",
    title: "Plus de chantiers.",
    accent: "Sans repartir de zéro.",
    body:
      "On regarde ce qui freine vos demandes aujourd’hui : visibilité Google, confiance, preuves et parcours de devis.",
    cta: "Voir ce qui bloque mes demandes →",
    key: "chantiers",
  },
  site: {
    badge: "Pour artisans & entreprises du bâtiment",
    title: "Plus de devis avec votre site.",
    accent: "Sans tout refaire pour rien.",
    body:
      "On identifie ce qui bloque la confiance et la prise de contact, puis on vous donne les priorités à corriger.",
    cta: "Analyser mon site gratuitement →",
    key: "site",
  },
  seo: {
    badge: "Pour artisans & entreprises du bâtiment",
    title: "Plus de demandes depuis Google.",
    accent: "Sans vous perdre dans le SEO.",
    body:
      "On regarde vos métiers, vos zones et vos pages pour voir ce qui vous empêche d’être trouvé au bon moment.",
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

const LEVERS = [
  {
    number: "01",
    title: "Être trouvé",
    body: "Quand un client cherche votre métier dans votre zone.",
  },
  {
    number: "02",
    title: "Donner confiance",
    body: "Réalisations, avis, garanties, photos, clarté.",
  },
  {
    number: "03",
    title: "Obtenir la demande",
    body: "Passer de « je regarde » à « je demande un devis ».",
  },
] as const;

export function AuditHero() {
  const [variant, setVariant] = useState<HeroVariant>(VARIANTS.default);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setVariant(variantFromContent(params.get("utm_content")));
  }, []);

  return (
    <div className="mx-auto max-w-5xl text-center">
      <div className="mx-auto inline-flex items-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)] sm:text-xs">
        {variant.badge}
      </div>

      <h1 className="font-display mx-auto mt-6 max-w-4xl text-balance text-[2.8rem] font-semibold leading-[0.96] tracking-[-0.05em] sm:text-6xl lg:text-[4.6rem]">
        {variant.title}
        <br />
        <span className="gold-text">{variant.accent}</span>
      </h1>

      <p className="mx-auto mt-6 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-lg">
        {variant.body}
      </p>

      <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
        {LEVERS.map((item) => (
          <div
            key={item.number}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <span className="text-[9px] font-semibold tracking-[0.18em] text-[var(--color-accent)]">
              {item.number}
            </span>
            <p className="font-display mt-2 text-base font-semibold">{item.title}</p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-5 max-w-2xl rounded-2xl border border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)] px-5 py-4">
        <p className="text-sm leading-relaxed">
          <span className="font-semibold">Vous repartez avec les 3 priorités à corriger</span>{" "}
          pour générer plus de demandes.
        </p>
      </div>

      <div className="mt-7 flex justify-center">
        <Button
          href="#audit-form"
          variant="primary"
          className="min-h-14 w-full max-w-md px-8 text-base sm:w-auto"
          trackEvent="audit_cta_clicked"
          trackPayload={{ location: "audit_hero", variant: variant.key }}
        >
          {variant.cta}
        </Button>
      </div>

      <p className="mt-4 text-xs text-[var(--color-muted)]">
        Audit gratuit · 1 min · Sans engagement
      </p>
    </div>
  );
}
