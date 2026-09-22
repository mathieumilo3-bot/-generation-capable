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
    badge: "Diagnostic offert · Artisans & BTP",
    title: "Gagnez en visibilité.",
    accent: "Transformez-la en demandes de devis.",
    body:
      "On analyse où vous perdez des clients — Google, votre site, vos preuves et votre parcours — puis on vous donne les 3 actions prioritaires à mettre en place.",
    cta: "Recevoir mon diagnostic personnalisé →",
    key: "default",
  },
  chantiers: {
    badge: "Diagnostic offert · Artisans & BTP",
    title: "Gagnez en visibilité.",
    accent: "Transformez-la en chantiers.",
    body:
      "On identifie ce qui freine vos demandes aujourd’hui et les 3 actions à prioriser pour attirer plus de prospects réellement intéressés.",
    cta: "Voir mes 3 priorités →",
    key: "chantiers",
  },
  site: {
    badge: "Diagnostic offert · Site artisan",
    title: "Votre site est visible.",
    accent: "Faites-le convertir.",
    body:
      "On analyse ce qui bloque la confiance et la prise de contact, puis on vous donne les 3 corrections à faire en priorité.",
    cta: "Recevoir mon diagnostic site →",
    key: "site",
  },
  seo: {
    badge: "Diagnostic offert · Visibilité Google",
    title: "Soyez plus visible sur Google.",
    accent: "Transformez cette visibilité en devis.",
    body:
      "On analyse vos métiers, vos zones et vos pages pour identifier les 3 priorités qui peuvent générer plus de demandes locales.",
    cta: "Recevoir mon diagnostic Google →",
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
    title: "Visibilité locale",
    body: "Être trouvé au bon moment, dans la bonne zone.",
  },
  {
    number: "02",
    title: "Confiance",
    body: "Donner envie d’appeler avant même le premier échange.",
  },
  {
    number: "03",
    title: "Conversion",
    body: "Transformer une visite en vraie demande de devis.",
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
          <span className="font-semibold">Votre diagnostic vous donne un plan clair :</span>{" "}
          ce qui vous freine, ce qu’il faut corriger en premier et les 3 prochaines actions à mettre en place.
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
        Gratuit · Personnalisé · Sans engagement
      </p>
    </div>
  );
}
