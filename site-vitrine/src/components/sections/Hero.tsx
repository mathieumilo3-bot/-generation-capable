"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Section } from "@/components/ui/Section";
import { PRIMARY_CTA_LABEL } from "@/lib/constants";

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

      <Section className="relative pt-24 pb-20 sm:pt-32 sm:pb-24">
        <motion.div style={{ y: contentY }} className="flex flex-col items-start">
          <Badge>Digital Revenue Systems</Badge>

          <h1 className="font-display text-balance mt-8 max-w-4xl text-[2.75rem] font-semibold leading-[1.04] tracking-tight text-[var(--color-text)] sm:text-6xl lg:text-[4.75rem]">
            Votre site devrait
            <br />
            travailler <span className="gold-text">plus dur.</span>
          </h1>

          <p className="text-balance mt-7 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
            Nous construisons les systèmes digitaux qui transforment votre
            visibilité en prises de contact, rendez-vous et opportunités
            commerciales.
          </p>

          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <Button
              href="/audit"
              variant="primary"
              trackEvent="hero_cta_click"
              trackPayload={{ location: "hero_primary" }}
            >
              {PRIMARY_CTA_LABEL} →
            </Button>
            <Button
              href="#analyse"
              variant="secondary"
              trackEvent="cta_clicked"
              trackPayload={{ location: "hero_secondary" }}
            >
              Voir comment ça fonctionne
            </Button>
          </div>

          <p className="mt-6 text-sm text-[var(--color-muted)]">
            Quelques minutes · Sans engagement
          </p>
        </motion.div>
      </Section>
    </div>
  );
}
