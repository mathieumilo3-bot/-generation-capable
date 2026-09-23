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
    title: "Découvrez ce qui vous fait perdre",
    accent: "des demandes de devis.",
    body:
      "Entrez uniquement le nom de votre entreprise. On retrouve votre présence en ligne, on identifie les freins prioritaires et on vous montre quoi corriger en premier.",
  },
  chantiers: {
    badge: "Pour artisans du bâtiment",
    title: "Découvrez ce qui vous empêche de gagner",
    accent: "plus de chantiers.",
    body:
      "Entrez uniquement le nom de votre entreprise. On retrouve votre présence en ligne et on vous montre les points qui peuvent freiner vos demandes de chantier.",
  },
  site: {
    badge: "Diagnostic site pour artisans",
    title: "Découvrez comment votre site peut",
    accent: "générer plus de demandes.",
    body:
      "Entrez le nom de votre entreprise. On retrouve votre site et vos signaux publics, puis on vous montre la première amélioration à prioriser.",
  },
  seo: {
    badge: "Diagnostic visibilité locale",
    title: "Découvrez comment gagner",
    accent: "en visibilité sur Google.",
    body:
      "Entrez le nom de votre entreprise. On vérifie votre présence publique et vos signaux locaux, puis on vous montre quoi prioriser pour être mieux trouvé et plus contacté.",
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
    // Variant depends on campaign parameters only available in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        Gratuit
        <span className="mx-2 text-white/20">·</span>
        Aucun site à chercher
        <span className="mx-2 text-white/20">·</span>
        Premier résultat avant l’email
      </p>
    </div>
  );
}
