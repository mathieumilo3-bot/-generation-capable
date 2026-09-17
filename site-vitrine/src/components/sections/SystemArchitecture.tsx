"use client";

import { motion } from "framer-motion";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const CHAIN = ["VISIBILITÉ", "SITE", "PARCOURS", "QUALIFICATION", "RENDEZ-VOUS", "CLIENT"];

export function SystemArchitecture() {
  return (
    <Section id="systeme" className="py-24 sm:py-32">
      <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
        <div>
          <Reveal>
            <Eyebrow>Le système</Eyebrow>
            <h2 className="font-display text-balance mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
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
              Chaque élément est conçu pour fonctionner avec les autres — la
              visibilité alimente le site, le site oriente le parcours, le
              parcours qualifie, la qualification déclenche le rendez-vous.
            </p>
          </Reveal>
        </div>

        <div className="relative">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-[var(--color-border)]" />
          <ul className="flex flex-col gap-2">
            {CHAIN.map((step, index) => (
              <motion.li
                key={step}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="relative flex items-center gap-6 py-4 pl-0"
              >
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] text-[11px] font-semibold text-[var(--color-accent)]">
                  {index + 1}
                </span>
                <span className="font-display text-lg font-medium tracking-tight text-[var(--color-text)] sm:text-xl">
                  {step}
                </span>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
