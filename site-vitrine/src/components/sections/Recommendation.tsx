"use client";

import { useState } from "react";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

function Before() {
  return (
    <div className="absolute inset-0 bg-[#11110f] p-7 text-[#f3f0e9] sm:p-12">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <span className="font-display text-sm">Entreprise</span>
        <span className="text-[9px] uppercase tracking-[0.18em] text-white/35">Services · À propos · Contact</span>
      </div>
      <div className="flex h-[78%] flex-col justify-center">
        <p className="text-[9px] uppercase tracking-[0.2em] text-white/30">Tous vos besoins</p>
        <h3 className="font-display mt-3 max-w-md text-3xl leading-[1.05] text-white/75 sm:text-5xl">Des services pour tous vos projets.</h3>
        <div className="mt-7 flex gap-2">
          <span className="h-9 w-24 rounded-full border border-white/20" />
          <span className="h-9 w-24 rounded-full border border-white/20" />
          <span className="h-9 w-24 rounded-full border border-white/20" />
        </div>
        <div className="mt-10 grid max-w-lg grid-cols-3 gap-2 opacity-40">
          {Array.from({ length: 6 }).map((_, i) => <span key={i} className="h-12 rounded border border-white/15" />)}
        </div>
      </div>
    </div>
  );
}

function After() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#050505] p-7 text-[#f4f1ea] sm:p-12">
      <div aria-hidden className="absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-[#d8c2a0]/[0.06] blur-3xl" />
      <div className="relative flex items-center justify-between border-b border-white/[0.08] pb-4">
        <span className="font-display text-sm tracking-[0.12em]">GC</span>
        <span className="rounded-full border border-white/15 px-4 py-2 text-[9px] uppercase tracking-[0.15em]">Votre projet</span>
      </div>
      <div className="relative flex h-[78%] flex-col justify-center">
        <p className="text-[9px] uppercase tracking-[0.28em] text-[#cdb68f]">Une promesse. Une direction.</p>
        <h3 className="font-display mt-4 max-w-xl text-4xl leading-[0.98] sm:text-6xl">Votre expertise,<br /><span className="italic text-[#cdb68f]">évidente.</span></h3>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/45">Le visiteur comprend. Il fait confiance. Il sait quoi faire ensuite.</p>
        <span className="mt-7 inline-flex w-fit rounded-full bg-[#eee8dc] px-6 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#090909]">Démarrer un projet →</span>
      </div>
    </div>
  );
}

export function Recommendation() {
  const [position, setPosition] = useState(50);

  return (
    <Section className="overflow-hidden py-24 sm:py-32">
      <Reveal>
        <Eyebrow>Avant / Après</Eyebrow>
        <h2 className="font-display mt-4 max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
          Même entreprise.<br /><span className="text-[var(--color-muted)]">Perception différente.</span>
        </h2>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="mt-12 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#050505] shadow-[0_40px_120px_rgba(0,0,0,0.45)] sm:rounded-[2rem]">
          <div className="relative aspect-[4/5] min-h-[440px] overflow-hidden sm:aspect-[16/9] sm:min-h-0">
            <After />
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}><Before /></div>

            <div aria-hidden className="pointer-events-none absolute inset-y-0 z-20 w-px bg-white/70" style={{ left: `${position}%` }}>
              <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/90 text-[#cdb68f] shadow-2xl">‹›</div>
            </div>

            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-between p-4">
              <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/45">Avant</span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-[#cdb68f]">Après</span>
            </div>

            <input aria-label="Comparer la version avant et la version après" type="range" min="8" max="92" value={position} onChange={(e) => setPosition(Number(e.target.value))} className="absolute inset-0 z-40 h-full w-full cursor-ew-resize opacity-0" />
          </div>

          <div className="grid grid-cols-3 border-t border-white/10 bg-[#070707]">
            {[["7 messages","1 promesse"],["3 actions","1 action"],["Doute","Confiance"]].map(([a,b]) => (
              <div key={a} className="border-r border-white/10 px-3 py-5 text-center last:border-r-0 sm:px-8 sm:py-7">
                <p className="text-[10px] text-white/30 sm:text-xs">{a}</p>
                <p className="font-display mt-1 text-sm text-[#f4f1ea] sm:text-lg">{b}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.16em] text-white/25">Projection illustrative · aucun résultat client inventé</p>
      </Reveal>
    </Section>
  );
}
