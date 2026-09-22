"use client";

import { useEffect, useState } from "react";

type HeroVariant = {
  badge: string;
  title: string;
  accent: string;
  body: string;
};

const VARIANTS: Record<string, HeroVariant> = {
  default: {
    badge: "Diagnostic offert · Artisans & BTP",
    title: "Gagnez en visibilité.",
    accent: "Transformez-la en demandes de devis.",
    body:
      "Entrez votre site. On analyse ce qu’un prospect voit et on vous montre une première opportunité avant même de demander vos coordonnées.",
  },
  chantiers: {
    badge: "Diagnostic offert · Artisans & BTP",
    title: "Gagnez en visibilité.",
    accent: "Transformez-la en chantiers.",
    body:
      "Entrez votre site. On repère ce qui freine les demandes et on vous montre une première opportunité concrète immédiatement.",
  },
  site: {
    badge: "Diagnostic offert · Site artisan",
    title: "Votre site est visible.",
    accent: "Faites-le convertir.",
    body:
      "Entrez votre site. On regarde ce qui bloque la confiance et la prise de contact avant de vous demander quoi que ce soit d’autre.",
  },
  seo: {
    badge: "Diagnostic offert · Visibilité Google",
    title: "Soyez visible au bon moment.",
    accent: "Transformez cette visibilité en devis.",
    body:
      "Entrez votre site. On analyse vos signaux locaux et on vous montre une première priorité avant vos coordonnées.",
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
      <div className="mx-auto inline-flex items-center rounded-full border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)] sm:text-xs">
        {variant.badge}
      </div>

      <h1 className="font-display mx-auto mt-5 max-w-4xl text-balance text-[2.55rem] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-[4.5rem]">
        {variant.title}
        <br />
        <span className="gold-text">{variant.accent}</span>
      </h1>

      <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-lg">
        {variant.body}
      </p>

      <p className="mt-4 text-xs text-[var(--color-muted)]">
        Première lecture avant coordonnées · Gratuit · Sans engagement
      </p>
    </div>
  );
}
