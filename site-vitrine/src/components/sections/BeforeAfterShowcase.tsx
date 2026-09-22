"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/tracking";

type Version = "avant" | "apres";

const VERSIONS: Record<Version, { label: string; src: string }> = {
  avant: {
    label: "Avant",
    src: "/demos/couvreur/avant.html",
  },
  apres: {
    label: "Après GC",
    src: "/demos/couvreur/apres.html",
  },
};

const TRANSFORMATIONS = [
  ["Message dispersé", "Une promesse claire"],
  ["Contact générique", "Besoin qualifié"],
  ["Vitrine passive", "Parcours orienté demande"],
] as const;

export function BeforeAfterShowcase() {
  const [version, setVersion] = useState<Version>("apres");
  const [direction, setDirection] = useState(1);
  const active = VERSIONS[version];

  function selectVersion(next: Version) {
    if (next === version) return;
    setDirection(next === "avant" ? 1 : -1);
    setVersion(next);
    track("cta_clicked", {
      location: "before_after_switch",
      version: next,
    });
  }

  return (
    <Section id="demonstration" className="overflow-hidden py-16 sm:py-20">
      <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr] lg:items-end lg:gap-12">
        <Reveal>
          <Eyebrow>La transformation</Eyebrow>
          <h2 className="font-display text-balance mt-4 text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl">
            Même entreprise.
            <br />
            <span className="text-[var(--color-muted)]">Pas la même valeur perçue.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="max-w-2xl lg:ml-auto">
            <p className="text-balance text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
              Le résultat d&apos;abord. Puis l&apos;ancienne version pour mesurer
              immédiatement la différence.
            </p>
            <p className="mt-3 text-[10px] uppercase tracking-[0.16em] text-white/35 sm:text-xs">
              Démonstration fictive · aucun résultat inventé
            </p>
          </div>
        </Reveal>
      </div>

      <div className="mt-8 overflow-hidden rounded-[1.35rem] border border-[var(--color-border-strong)] bg-[#0b0b0b] shadow-[0_32px_90px_rgba(0,0,0,0.42)] sm:rounded-[1.75rem]">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]/60" />
            </span>
            <span className="hidden text-xs text-[var(--color-muted)] sm:inline">
              Exemple de transformation
            </span>
          </div>

          <div
            className="grid grid-cols-2 rounded-full border border-white/10 bg-black p-1"
            role="group"
            aria-label="Comparer avant et après"
          >
            {(["apres", "avant"] as Version[]).map((key) => {
              const selected = version === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectVersion(key)}
                  aria-pressed={selected}
                  className={`min-w-24 rounded-full px-3 py-2 text-xs font-semibold transition-all duration-300 sm:min-w-28 sm:text-sm ${selected ? "bg-[var(--color-accent)] text-black shadow-lg" : "text-[var(--color-muted)] hover:text-white"}`}
                >
                  {VERSIONS[key].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="relative h-[680px] overflow-hidden bg-[#f5f2ec] sm:h-[720px] lg:h-[760px]">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={active.src}
              initial={{ opacity: 0, x: direction * 110 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -110 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              <iframe
                src={active.src}
                title={`Kerné Couverture — version ${active.label}`}
                className="h-full w-full border-0"
                loading={version === "apres" ? "eager" : "lazy"}
              />
            </motion.div>
          </AnimatePresence>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" />
        </div>
      </div>

      <Reveal delay={0.12}>
        <div className="mt-5 grid overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] sm:grid-cols-3">
          {TRANSFORMATIONS.map(([before, after]) => (
            <div
              key={before}
              className="border-b border-[var(--color-border)] px-5 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
            >
              <p className="text-[11px] text-[var(--color-muted)]">{before}</p>
              <p className="font-display mt-1 text-sm font-semibold text-[var(--color-text)] sm:text-base">
                → {after}
              </p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.16}>
        <div className="mt-6">
          <Button
            href="/audit"
            variant="primary"
            trackEvent="cta_clicked"
            trackPayload={{ location: "before_after_primary" }}
          >
            Analyser mon site gratuitement →
          </Button>
        </div>
      </Reveal>
    </Section>
  );
}
