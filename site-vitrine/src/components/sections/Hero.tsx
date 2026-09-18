"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Metric } from "@/components/ui/Metric";
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
  const contentY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [0, -40]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], shouldReduceMotion ? [1, 1] : [1, 0]);

  return (
    <div ref={ref} className="relative overflow-hidden">
      <motion.div
        aria-hidden
        style={{ y: gridY }}
        className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-[var(--color-accent)]/[0.06] blur-[120px]"
      />

      <Section className="relative pt-28 pb-24 sm:pt-36 sm:pb-32">
        <motion.div style={{ y: contentY, opacity: contentOpacity }}>
          <div className="flex flex-col items-start">
            <Badge>Digital Revenue Systems</Badge>

            <h1 className="font-display text-balance mt-8 max-w-4xl text-[2.75rem] font-semibold leading-[1.05] tracking-tight text-[var(--color-text)] sm:text-6xl lg:text-[5rem]">
              Votre présence digitale
              <br />
              devrait travailler <span className="gold-text">pour vous.</span>
            </h1>

            <p className="text-balance mt-8 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
              Nous concevons des systèmes digitaux qui transforment votre
              visibilité en opportunités commerciales.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button
                href="/audit"
                variant="primary"
                trackEvent="cta_clicked"
                trackPayload={{ location: "hero_primary" }}
              >
                {PRIMARY_CTA_LABEL} →
              </Button>
              <Button
                href="/#systeme"
                variant="secondary"
                trackEvent="cta_clicked"
                trackPayload={{ location: "hero_secondary" }}
              >
                Voir le système
              </Button>
            </div>

            <div className="mt-16 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--color-border)] pt-8">
              <Metric label="Sites" />
              <Metric label="Acquisition" />
              <Metric label="Conversion" />
            </div>
          </div>
        </motion.div>
      </Section>
    </div>
  );
}
