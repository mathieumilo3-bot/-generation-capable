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
          <Badge>GC Agence · Site · Visibilité · Acquisition</Badge>

          <h1 className="font-display text-balance mt-7 max-w-5xl text-[2.7rem] font-semibold leading-[1.02] tracking-tight text-[var(--color-text)] sm:text-6xl lg:text-[4.7rem]">
            Un site clair.
            <br />
            <span className="gold-text">Un parcours qui donne envie d’agir.</span>
          </h1>

          <p className="text-balance mt-7 max-w-2xl text-lg leading-relaxed text-[var(--color-muted)] sm:text-xl">
            On remet votre présence digitale dans le bon ordre : une offre comprise vite,
            des preuves visibles, puis une action simple pour vous contacter, réserver,
            demander un devis ou prendre rendez-vous.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button
              href="/audit"
              variant="primary"
              trackEvent="hero_cta_click"
              trackPayload={{ location: "hero_primary" }}
            >
              Analyser mon site gratuitement →
            </Button>
            <Button
              href="#demonstration"
              variant="secondary"
              trackEvent="cta_clicked"
              trackPayload={{ location: "hero_secondary" }}
            >
              Voir un exemple avant / après
            </Button>
          </div>

          <div className="mt-7 flex flex-wrap gap-x-3 gap-y-2 text-xs text-[var(--color-muted)]">
            <span>Artisans</span><span>·</span>
            <span>PME</span><span>·</span>
            <span>Cabinets</span><span>·</span>
            <span>Commerces</span><span>·</span>
            <span>Services</span>
          </div>
        </motion.div>
      </Section>
    </div>
  );
}
