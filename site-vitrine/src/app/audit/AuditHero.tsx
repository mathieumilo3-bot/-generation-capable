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
    badge: "Pour artisans du bâtiment",
    title: "Découvrez comment générer",
    accent: "plus de demandes de devis.",
    body:
      "Entrez votre site et découvrez en quelques secondes ce que vous pouvez améliorer pour gagner en visibilité et obtenir plus de demandes de devis.",
  },
  chantiers: {
    badge: "Pour artisans du bâtiment",
    title: "Découvrez comment gagner",
    accent: "plus de chantiers.",
    body:
      "Entrez votre site. En quelques secondes, découvrez ce qui peut freiner vos demandes de devis — et quoi corriger en priorité.",
  },
  site: {
    badge: "Diagnostic site pour artisans",
    title: "Découvrez comment votre site peut",
    accent: "générer plus de demandes.",
    body:
      "Entrez votre site. On vous montre la première amélioration qui peut renforcer la confiance et faciliter la prise de contact, puis les actions à prioriser.",
  },
  seo: {
    badge: "Diagnostic visibilité locale",
    title: "Découvrez comment gagner",
    accent: "en visibilité sur Google.",
    body:
      "Entrez votre site. On vérifie vos signaux locaux et on vous montre la première amélioration à prioriser pour être mieux trouvé et plus contacté.",
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
      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/22 bg-white/[0.025] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)] sm:px-4 sm:py-2 sm:text-[11px]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_10px_rgba(232,200,106,0.35)]" />
        {variant.badge}
      </div>

      <h1 className="font-display mx-auto mt-4 max-w-4xl text-balance text-[2.48rem] font-semibold leading-[0.97] tracking-[-0.052em] sm:mt-5 sm:text-6xl lg:text-[4.7rem]">
        {variant.title}
        <br />
        <span className="gold-text">{variant.accent}</span>
      </h1>

      <p className="mx-auto mt-4 max-w-[34rem] text-[14px] leading-[1.62] text-[var(--color-muted)] sm:mt-5 sm:text-[17px]">
        {variant.body}
      </p>

      <p className="mx-auto mt-4 max-w-xl text-[10.5px] font-medium tracking-[0.01em] text-[var(--color-muted)] sm:mt-5 sm:text-[11px]">
        Rapide
        <span className="mx-2 text-white/20">·</span>
        Gratuit
        <span className="mx-2 text-white/20">·</span>
        Premier résultat sans email
      </p>
    </div>
  );
}
