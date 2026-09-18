"use client";

import { motion } from "framer-motion";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const CHAIN = [
  ["01", "VISIBILITÉ"],
  ["02", "SITE"],
  ["03", "PARCOURS"],
  ["04", "QUALIFICATION"],
  ["05", "RENDEZ-VOUS"],
  ["06", "CLIENT"],
];

export function SystemArchitecture() {
  return (
    <Section id="systeme" className="py-24 sm:py-32">
      <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
        <div>
          <Reveal>
            <Eyebrow>Le système</Eyebrow>
            <h2 className="font-display text-balance mt-4 text-3xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Nous ne construisons pas
              <br />
              seulement des sites.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="font-display mt-8 text-2xl font-medium leading-snug text-[var(--color-accent)] sm:text-3xl">
              Nous construisons le système autour.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)]">
              Chaque élément est pensé pour alimenter le suivant : attirer,
              rassurer, orienter, qualifier puis convertir.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 sm:p-8">
            <div className="bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
            <div className="relative">
              <div className="mb-7 flex items-center justify-between border-b border-[var(--color-border)] pb-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-muted)]">
                  Architecture de conversion
                </p>
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                  Connecté
                </span>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-4 bottom-4 w-px bg-gradient-to-b from-[var(--color-accent)] via-[var(--color-border-strong)] to-transparent" />
                <ul className="relative flex flex-col gap-2">
                  {CHAIN.map(([number, step], index) => (
                    <motion.li
                      key={step}
                      initial={{ opacity: 0, x: 18 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                      className="group relative flex items-center gap-5 rounded-xl border border-transparent px-2 py-3 transition-all duration-300 hover:border-[var(--color-border)] hover:bg-white/[0.025]"
                    >
                      <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] font-display text-[10px] font-semibold text-[var(--color-accent)]">
                        {number}
                      </span>
                      <span className="font-display text-base font-semibold tracking-tight sm:text-lg">
                        {step}
                      </span>
                      {index < CHAIN.length - 1 && (
                        <span className="ml-auto text-xs text-[var(--color-muted)] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                          →
                        </span>
                      )}
                    </motion.li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-6">
                {["ATTENTION", "INTENTION", "ACTION"].map((item) => (
                  <div key={item} className="rounded-lg bg-black/20 px-3 py-3 text-center">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[var(--color-muted)]">
                      {item}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
