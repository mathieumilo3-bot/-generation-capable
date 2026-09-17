"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

const STEPS = [
  {
    number: "01",
    title: "ANALYSER",
    body: "Comprendre votre marché, votre présence et votre parcours client.",
  },
  {
    number: "02",
    title: "CONSTRUIRE",
    body: "Créer les actifs digitaux nécessaires.",
  },
  {
    number: "03",
    title: "CONNECTER",
    body: "Relier acquisition, site, conversion et prise de contact.",
  },
  {
    number: "04",
    title: "OPTIMISER",
    body: "Mesurer, améliorer et faire évoluer le système.",
  },
];

export function Method() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.75", "end 0.4"],
  });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <Section id="methode" className="py-24 sm:py-32">
      <Reveal>
        <Eyebrow>Méthode</Eyebrow>
        <h2 className="font-display text-balance mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Une méthode.
          <br />
          <span className="text-[var(--color-muted)]">
            Pas un catalogue de prestations.
          </span>
        </h2>
      </Reveal>

      <div ref={ref} className="relative mt-16 max-w-2xl">
        <div className="absolute left-[19px] top-2 bottom-2 w-px bg-[var(--color-border)]" />
        <motion.div
          style={{ height: lineHeight }}
          className="absolute left-[19px] top-2 w-px bg-[var(--color-accent)]"
        />

        <ul className="flex flex-col">
          {STEPS.map((step) => (
            <li key={step.number} className="relative flex gap-7 py-8">
              <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-bg)] font-display text-xs font-semibold text-[var(--color-accent)]">
                {step.number}
              </span>
              <div>
                <p className="font-display text-lg font-semibold tracking-tight text-[var(--color-text)]">
                  {step.title}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-muted)]">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
