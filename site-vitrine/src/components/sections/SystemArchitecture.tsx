"use client";

import { motion } from "framer-motion";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const CHAIN = [
  ["01", "ÊTRE TROUVÉ"],
  ["02", "RASSURER"],
  ["03", "MONTRER LE SAVOIR-FAIRE"],
  ["04", "DEMANDE DE DEVIS"],
  ["05", "RAPPEL"],
  ["06", "CHANTIER"],
];

export function SystemArchitecture() {
  return (
    <Section id="systeme" className="py-16 sm:py-20">
      <div className="grid gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-20">
        <div>
          <Reveal>
            <Eyebrow>Le parcours client</Eyebrow>
            <h2 className="font-display text-balance mt-4 text-3xl font-semibold leading-[1.08] tracking-tight sm:text-5xl">
              Un bon site artisan
              <br />
              ne doit pas juste être beau.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="font-display mt-8 text-2xl font-medium leading-snug text-[var(--color-accent)] sm:text-3xl">
              Il doit faciliter le prochain chantier.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--color-muted)]">
              Le prospect doit vous trouver, comprendre ce que vous faites, voir des preuves,
              puis demander un devis sans friction. Le reste sert ce parcours.
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.12}>
          <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 sm:p-8">
            <div className="bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
            <div className="relative">
              <div className="mb-7 flex items-center justify-between border-b border-[var(--color-border)] pb-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-muted)]">
                  Parcours d&apos;une demande
                </p>
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                  Clair
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
                      <span className="font-display text-sm font-semibold tracking-tight sm:text-lg">{step}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
