"use client";

import { useState } from "react";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const RESULTS = [
  ["7 messages", "1 promesse"],
  ["3 actions", "1 CTA"],
  ["Preuve tardive", "Preuve avant la demande"],
];

function BrowserBar({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`flex h-9 items-center gap-1.5 border-b px-4 sm:h-11 sm:px-5 ${dark ? "border-white/10 bg-[#0b0a08]" : "border-black/10 bg-[#ebe8e1]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dark ? "bg-white/25" : "bg-black/25"}`} />
      <span className={`h-1.5 w-1.5 rounded-full ${dark ? "bg-white/15" : "bg-black/15"}`} />
      <span className={`h-1.5 w-1.5 rounded-full ${dark ? "bg-white/10" : "bg-black/10"}`} />
      <span className={`ml-2 h-3.5 w-28 rounded-full sm:w-40 ${dark ? "bg-white/[0.06]" : "bg-black/[0.06]"}`} />
    </div>
  );
}

function BeforeScreen() {
  return (
    <div className="absolute inset-0 bg-[#f1efe9] text-[#22201c]">
      <BrowserBar />
      <div className="flex h-[calc(100%-2.25rem)] flex-col p-4 sm:h-[calc(100%-2.75rem)] sm:p-7 lg:p-9">
        <div className="flex items-center justify-between border-b border-black/10 pb-3">
          <p className="font-display text-[9px] font-semibold uppercase tracking-[0.2em] sm:text-xs">Entreprise Démo</p>
          <div className="flex gap-3 text-[6px] font-medium uppercase tracking-[0.12em] text-black/50 sm:gap-5 sm:text-[8px]">
            <span>Accueil</span><span>Services</span><span>À propos</span><span>Contact</span>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-[1.05fr_0.95fr] gap-3 pt-4 sm:gap-7 sm:pt-7">
          <div className="flex min-w-0 flex-col justify-center">
            <p className="text-[6px] font-semibold uppercase tracking-[0.18em] text-black/40 sm:text-[8px]">Tous vos projets · Tous nos services</p>
            <h3 className="font-display mt-2 text-[clamp(1rem,3.2vw,2.7rem)] font-semibold leading-[1.03] tracking-tight">Vos travaux,<br />notre savoir-faire</h3>
            <p className="mt-2 max-w-xs text-[7px] leading-relaxed text-black/45 sm:mt-3 sm:text-[10px]">Une équipe polyvalente pour tous vos besoins. Découvrez nos prestations et contactez-nous.</p>
            <div className="mt-3 flex flex-wrap gap-1.5 sm:mt-5 sm:gap-2">
              {["Nos services", "Nos réalisations", "Nous contacter"].map((item) => (
                <span key={item} className="rounded-sm border border-black/20 px-2 py-1 text-[5px] font-semibold sm:px-3 sm:py-1.5 sm:text-[7px]">{item}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 self-center rounded-sm border border-black/10 bg-white/50 p-2 sm:gap-2 sm:p-3">
            {["Création", "Rénovation", "Conseil", "Entretien", "Étude", "Dépannage"].map((item) => (
              <div key={item} className="flex min-h-8 flex-col justify-between bg-black/[0.035] p-2 sm:min-h-14 sm:p-3">
                <span className="h-2 w-2 rounded-full border border-black/25" />
                <span className="text-[5px] font-medium text-black/50 sm:text-[7px]">{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-black/10 border-t border-black/10 pt-3 text-center text-[5px] font-semibold uppercase tracking-[0.12em] text-black/40 sm:pt-4 sm:text-[7px]">
          <span>7 services</span><span>3 actions</span><span>Preuve plus bas</span>
        </div>
      </div>
    </div>
  );
}

function AfterScreen() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#080705] text-[#f5f1e8]">
      <BrowserBar dark />
      <div aria-hidden className="absolute inset-y-11 right-0 w-[52%] bg-[radial-gradient(circle_at_65%_42%,rgba(229,185,74,0.22),transparent_24%),linear-gradient(135deg,transparent_5%,rgba(255,255,255,0.035)_50%,rgba(229,185,74,0.09))]" />
      <div className="relative flex h-[calc(100%-2.25rem)] flex-col p-4 sm:h-[calc(100%-2.75rem)] sm:p-7 lg:p-9">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <p className="font-display text-[9px] font-semibold uppercase tracking-[0.22em] text-[#e5b94a] sm:text-xs">GC / Démo</p>
          <div className="flex items-center gap-3 text-[6px] font-medium uppercase tracking-[0.12em] text-white/45 sm:gap-5 sm:text-[8px]">
            <span>Expertise</span><span>Réalisations</span><span className="rounded-full bg-[#e5b94a] px-2 py-1 text-[#080705] sm:px-3">Démarrer</span>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-[1.08fr_0.92fr] gap-3 pt-4 sm:gap-7 sm:pt-7">
          <div className="flex min-w-0 flex-col justify-center">
            <p className="text-[6px] font-semibold uppercase tracking-[0.2em] text-[#e5b94a] sm:text-[8px]">Une expertise. Un résultat.</p>
            <h3 className="font-display mt-2 text-[clamp(1rem,3.2vw,2.7rem)] font-semibold leading-[1.03] tracking-tight">Un projet pensé<br />pour durer.</h3>
            <p className="mt-2 max-w-xs text-[7px] leading-relaxed text-white/50 sm:mt-3 sm:text-[10px]">Une direction claire, des preuves visibles et une seule prochaine étape.</p>
            <div className="mt-3 sm:mt-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#e5b94a] px-3 py-1.5 text-[6px] font-semibold text-[#080705] shadow-[0_8px_30px_rgba(229,185,74,0.18)] sm:px-4 sm:py-2 sm:text-[8px]">Étudier mon projet <span>→</span></span>
            </div>
          </div>

          <div className="relative self-center overflow-hidden rounded-sm border border-white/10 bg-[#15120d] p-2 shadow-[0_24px_70px_rgba(0,0,0,0.65)] sm:p-3">
            <div className="aspect-[4/3] bg-[linear-gradient(145deg,#342a1d_0%,#17130e_42%,#090806_100%)] p-3 sm:p-5">
              <div className="flex h-full flex-col justify-between border border-white/10 p-3 sm:p-4">
                <div className="h-px w-12 bg-[#e5b94a]" />
                <div><p className="font-display text-[9px] leading-tight sm:text-base">Le détail inspire confiance.</p><p className="mt-1 text-[5px] text-white/40 sm:text-[7px]">Méthode · Qualité · Suivi</p></div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-3 text-center text-[5px] font-semibold uppercase tracking-[0.12em] text-white/45 sm:pt-4 sm:text-[7px]">
          <span>1 promesse</span><span>1 action</span><span>Preuve avant le CTA</span>
        </div>
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
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="font-display text-balance max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-[3.6rem]">La différence se voit<br /><span className="text-[var(--color-muted)]">avant de se lire.</span></h2>
          <p className="max-w-sm text-[15px] leading-relaxed text-[var(--color-muted)]">Faites glisser pour voir comment un parcours confus devient une expérience claire et désirable.</p>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="mt-12 overflow-hidden rounded-[1.5rem] border border-[var(--color-border-strong)] bg-black shadow-[0_40px_120px_rgba(0,0,0,0.45)] sm:rounded-[2rem]">
          <div className="relative aspect-[4/5] min-h-[440px] overflow-hidden sm:aspect-[16/9] sm:min-h-0 lg:aspect-[16/8]">
            <AfterScreen />
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}><BeforeScreen /></div>

            <div aria-hidden className="pointer-events-none absolute inset-y-0 z-20 w-px bg-white/85 shadow-[0_0_30px_rgba(0,0,0,0.7)]" style={{ left: `${position}%` }}>
              <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-[#080705]/90 text-sm text-[#e5b94a] shadow-2xl backdrop-blur sm:h-14 sm:w-14"><span className="-translate-x-0.5">‹</span><span className="translate-x-0.5">›</span></div>
            </div>

            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-between p-3 sm:p-5">
              <span className="rounded-full border border-black/10 bg-white/90 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-black shadow-lg backdrop-blur sm:text-[10px]">Avant</span>
              <span className="rounded-full border border-[#e5b94a]/30 bg-black/75 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-[#e5b94a] shadow-lg backdrop-blur sm:text-[10px]">Après</span>
            </div>

            <input aria-label="Comparer la version avant et la version après" type="range" min="8" max="92" value={position} onChange={(event) => setPosition(Number(event.target.value))} className="absolute inset-0 z-40 h-full w-full cursor-ew-resize opacity-0" />
          </div>

          <div className="grid divide-y divide-white/10 border-t border-white/10 bg-[#080705] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {RESULTS.map(([before, after]) => (
              <div key={before} className="flex items-center gap-4 px-5 py-5 sm:block sm:px-6 sm:py-6 lg:px-8">
                <p className="min-w-24 text-xs text-white/35 line-through decoration-white/25 sm:min-w-0">{before}</p>
                <p className="font-display text-sm font-semibold text-[#f5f1e8] sm:mt-2 sm:text-base"><span className="mr-2 text-[#e5b94a]">→</span>{after}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-[var(--color-muted)]">Démonstration visuelle d&apos;une restructuration — pas un résultat client inventé.</p>
      </Reveal>
    </Section>
  );
}
