"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Section } from "@/components/ui/Section";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const gridY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [0, 60]);
  const contentY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [0, -32]);

  return (
    <div ref={ref} className="relative overflow-hidden">
      <motion.div
        aria-hidden
        style={{ y: gridY }}
        className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_65%_55%_at_50%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-12%] h-[380px] w-[560px] -translate-x-1/2 rounded-full bg-[var(--color-accent)]/[0.07] blur-[130px]"
      />

      <Section className="relative pt-20 pb-16 sm:pt-28 sm:pb-20">
        <motion.div style={{ y: contentY }} className="flex flex-col items-start">
          <Badge>GC Agence · Systèmes de revenus digitaux</Badge>

          <h1 className="font-display text-balance mt-7 max-w-5xl text-[2.7rem] font-semibold leading-[1.02] tracking-tight text-[var(--color-text)] sm:text-6xl lg:text-[4.7rem]">
            Votre visibilité attire des gens.
            <br />
            <span className="gold-text">Votre système doit les convertir.</span>
          </h1>

          <p className="text-balance mt-7 max-w-2xl text-lg leading-relaxed text-[var(--color-muted)] sm:text-xl">
            Nous construisons le système entre votre acquisition et votre chiffre
            d&apos;affaires : message, site, parcours, qualification et suivi.
            Le but n&apos;est pas d&apos;avoir un plus beau site. C&apos;est de
            transformer davantage d&apos;attention en opportunités commerciales.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button
              href="/audit"
              variant="primary"
              trackEvent="hero_cta_click"
              trackPayload={{ location: "hero_primary" }}
            >
              Recevoir mon diagnostic →
            </Button>
            <Button
              href="#systeme"
              variant="secondary"
              trackEvent="cta_clicked"
              trackPayload={{ location: "hero_secondary" }}
            >
              Voir le système
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--color-muted)]">
            <span>Diagnostic personnalisé</span>
            <span>·</span>
            <span>Sans engagement</span>
            <span>·</span>
            <span>Pas de score automatique inventé</span>
          </div>
        </motion.div>
      </Section>
    </div>
  );
}
