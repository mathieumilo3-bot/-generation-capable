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
    title: "Soyez trouvé.",
    accent: "Soyez choisi.",
    body:
      "Votre présence en ligne doit faire plus que vous montrer. Elle doit donner envie de vous appeler. Entrez votre site : on vous montre gratuitement ce qui peut vous aider à gagner plus de clients et de chantiers.",
  },
  chantiers: {
    badge: "Diagnostic offert · Artisans & BTP",
    title: "Attirez l’attention.",
    accent: "Décrochez plus de chantiers.",
    body:
      "Entrez votre site. On repère ce qui peut freiner un prospect avant l’appel et on vous montre une première opportunité concrète immédiatement.",
  },
  site: {
    badge: "Diagnostic offert · Site artisan",
    title: "Votre site doit vendre",
    accent: "votre savoir-faire.",
    body:
      "Pas juste l’afficher. Entrez votre site : on vous montre ce qui peut rassurer plus vite, déclencher plus d’appels et mieux convertir votre visibilité.",
  },
  seo: {
    badge: "Diagnostic offert · Visibilité Google",
    title: "Soyez trouvé au bon moment.",
    accent: "Donnez envie de vous appeler.",
    body:
      "Entrez votre site. On analyse les signaux qui peuvent vous rendre plus visible et plus convaincant auprès des clients de votre zone.",
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
      <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--color-accent)]/35 bg-[var(--color-accent-soft)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)] sm:text-xs">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_14px_var(--color-accent)]" />
        {variant.badge}
      </div>

      <h1 className="font-display mx-auto mt-5 max-w-4xl text-balance text-[2.75rem] font-semibold leading-[0.94] tracking-[-0.055em] sm:text-6xl lg:text-[4.8rem]">
        {variant.title}
        <br />
        <span className="gold-text">{variant.accent}</span>
      </h1>

      <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted)] sm:text-lg">
        {variant.body}
      </p>

      <div className="mx-auto mt-5 flex max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[11px] font-medium text-[var(--color-muted)]">
        <span>✓ Analyse réelle</span>
        <span className="text-[var(--color-border-strong)]">•</span>
        <span>✓ Premier résultat sans email</span>
        <span className="text-[var(--color-border-strong)]">•</span>
        <span>✓ Sans engagement</span>
      </div>
    </div>
  );
}
