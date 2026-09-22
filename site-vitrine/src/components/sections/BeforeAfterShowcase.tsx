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
  ["Contact générique", "Besoin qualifié en 20 s"],
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
    <Section id="demonstration" className="overflow-hidden py-24 sm:py-32">
      <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end lg:gap-16">
        <Reveal>
          <Eyebrow>La transformation</Eyebrow>
          <h2 className="font-display text-balance mt-4 text-4xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
            Même entreprise.
            <br />
            <span className="text-[var(--color-muted)]">Pas la même valeur perçue.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="max-w-2xl lg:ml-auto">
            <p className="text-balance text-lg leading-relaxed text-[var(--color-muted)]">
              Le résultat est affiché en premier. Passez ensuite sur l&apos;ancienne
              version pour voir d&apos;où partait l&apos;entreprise avant la refonte.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.16em] text-white/35">
              Entreprise fictive · projection fonctionnelle · aucun résultat inventé
            </p>
          </div>
        </Reveal>
      </div>

      <div className="mt-12 overflow-hidden rounded-[1.35rem] border border-[var(--color-border-strong)] bg-[#0b0b0b] shadow-[0_42px_130px_rgba(0,0,0,0.5)] sm:rounded-[2rem]">
        <div className="flex flex-col gap-4 border-b border-[var(--color-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex gap-1.5" aria-hidden>
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]/60" />
            </span>
            <div>
              <span className="hidden text-xs text-[var(--color-muted)] sm:inline">
                Projet couvreur · Transformation GC
              </span>
              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/35 sm:text-[11px]">
                Après affiché en premier · l&apos;Avant arrive depuis la droite
              </p>
            </div>
          </div>

          <div
            className="grid grid-cols-2 rounded-full border border-white/10 bg-black p-1"
            role="group"
            aria-label="Choisir la version du site"
          >
            {(["apres", "avant"] as Version[]).map((key) => {
              const selected = version === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectVersion(key)}
                  aria-pressed={selected}
                  className={`min-w-28 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${selected ? "bg-[var(--color-accent)] text-black shadow-lg" : "text-[var(--color-muted)] hover:text-white"}`}
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
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
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
        </div>
      </div>

      <Reveal delay={0.16}>
        <div className="mt-6 grid overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] sm:grid-cols-3">
          {TRANSFORMATIONS.map(([before, after]) => (
            <div
              key={before}
              className="border-b border-[var(--color-border)] px-6 py-5 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
            >
              <p className="text-xs text-[var(--color-muted)]">{before}</p>
              <p className="font-display mt-1.5 text-base font-semibold text-[var(--color-text)]">
                → {after}
              </p>
            </div>
          ))}
        </div>
      </Reveal>

      <Reveal delay={0.2}>
        <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button
            href="/audit"
            variant="primary"
            trackEvent="cta_clicked"
            trackPayload={{ location: "before_after_primary" }}
          >
            Je veux la même transformation →
          </Button>
        </div>
      </Reveal>
    </Section>
  );
}
