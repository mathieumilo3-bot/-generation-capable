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
    badge: "Pour artisans & entreprises du bâtiment",
    title: "Attirez plus de clients locaux",
    accent: "avec Google et votre site.",
    body:
      "Entrez votre site. On vous montre ce qui peut freiner vos demandes, puis vos 3 priorités pour gagner en visibilité et en contacts.",
  },
  chantiers: {
    badge: "Pour artisans & entreprises du bâtiment",
    title: "Obtenez plus de chantiers",
    accent: "avec Google et votre site.",
    body:
      "Entrez votre site. On vous montre où des prospects peuvent vous échapper aujourd’hui, puis les 3 actions à traiter en priorité.",
  },
  site: {
    badge: "Diagnostic site artisan · Gratuit",
    title: "Faites de votre site",
    accent: "un vrai apporteur de clients.",
    body:
      "Entrez votre site. On vous montre ce qui peut bloquer la confiance, les appels et les demandes, puis les 3 corrections prioritaires.",
  },
  seo: {
    badge: "Diagnostic visibilité Google · Gratuit",
    title: "Faites-vous trouver",
    accent: "par plus de clients dans votre zone.",
    body:
      "Entrez votre site. On vérifie vos signaux locaux et on vous montre les 3 priorités pour améliorer votre visibilité et vos prises de contact.",
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
      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/25 bg-[rgba(255,255,255,0.025)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)] sm:text-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_14px_var(--color-accent)]" />
        {variant.badge}
      </div>

      <h1 className="font-display mx-auto mt-4 max-w-4xl text-balance text-[2.5rem] font-semibold leading-[0.98] tracking-[-0.05em] sm:mt-5 sm:text-6xl lg:text-[4.7rem]">
        {variant.title}
        <br />
        <span className="gold-text">{variant.accent}</span>
      </h1>

      <p className="mx-auto mt-4 max-w-xl text-[14px] leading-[1.65] text-[var(--color-muted)] sm:mt-5 sm:max-w-2xl sm:text-[17px]">
        {variant.body}
      </p>

      <div className="mx-auto mt-4 flex max-w-xl flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-medium text-[var(--color-muted)] sm:mt-5">
        <span>✓ 1er résultat sans email</span>
        <span className="hidden text-[var(--color-border-strong)] sm:inline">•</span>
        <span>✓ 3 priorités personnalisées</span>
      </div>
    </div>
  );
}
