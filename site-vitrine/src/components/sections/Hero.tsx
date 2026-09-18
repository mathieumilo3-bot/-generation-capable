"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Section } from "@/components/ui/Section";
import { PRIMARY_CTA_LABEL } from "@/lib/constants";

const CAPABILITIES = ["SITE", "ACQUISITION", "CONVERSION", "AUTOMATION"];

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
        className="pointer-events-none absolute left-1/2 top-[-10%] h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-[var(--color-accent)]/[0.07] blur-[140px]"
      />

      <Section className="relative pt-16 pb-16 sm:pt-24 sm:pb-24 lg:pt-28 lg:pb-28">
        <motion.div
          style={{ y: contentY, opacity: contentOpacity }}
          className="grid items-center gap-14 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16"
        >
          <div className="flex flex-col items-start">
            <Badge>GC · Digital Revenue Systems</Badge>

            <h1 className="font-display text-balance mt-7 max-w-4xl text-[2.8rem] font-semibold leading-[0.98] tracking-[-0.045em] text-[var(--color-text)] sm:text-6xl lg:text-[5.15rem]">
              Votre présence digitale
              <br />
              doit <span className="gold-text">générer.</span>
            </h1>

            <p className="text-balance mt-7 max-w-xl text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
              GC conçoit des sites et des systèmes digitaux qui transforment votre
              visibilité en prises de contact, rendez-vous et opportunités commerciales.
            </p>

            <div className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-4">
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

            <div className="mt-12 grid w-full max-w-xl grid-cols-2 border-y border-[var(--color-border)] sm:grid-cols-4 sm:border-y-0 sm:border-l">
              {CAPABILITIES.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 border-b border-[var(--color-border)] py-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)] last:border-b-0 sm:border-b-0 sm:border-r sm:px-4 sm:py-2 first:sm:pl-5 last:sm:border-r-0"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative hidden lg:block">
            <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border-strong)] bg-[linear-gradient(145deg,rgba(255,255,255,0.07),rgba(255,255,255,0.015)_42%,rgba(214,183,122,0.05))] p-7 shadow-[0_30px_100px_rgba(0,0,0,0.45)]">
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[var(--color-accent)]/[0.08] blur-3xl" />

              <div className="relative">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-accent)]">
                      GC / SYSTEM
                    </p>
                    <p className="mt-2 font-display text-xl font-semibold tracking-tight">
                      Revenue architecture
                    </p>
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border-strong)] text-xs text-[var(--color-accent)]">
                    ↗
                  </span>
                </div>

                <div className="relative mt-7 space-y-3">
                  {[
                    ["01", "VISIBILITÉ", "Attention qualifiée"],
                    ["02", "SITE", "Crédibilité & intention"],
                    ["03", "CONVERSION", "Prise de contact"],
                    ["04", "SUIVI", "Rendez-vous & relance"],
                  ].map(([number, title, body], index) => (
                    <div
                      key={number}
                      className="group relative flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-black/20 px-4 py-4 transition-all duration-300 hover:border-[var(--color-accent)]/40 hover:bg-white/[0.035]"
                    >
                      <span className="font-display text-xs text-[var(--color-accent)]">{number}</span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{title}</p>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">{body}</p>
                      </div>
                      <span className="ml-auto text-[var(--color-muted)] transition-transform duration-300 group-hover:translate-x-1">
                        →
                      </span>
                      {index < 3 && (
                        <span className="pointer-events-none absolute -bottom-3 left-[23px] z-10 h-3 w-px bg-[var(--color-accent)]/40" />
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent-soft)] px-4 py-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)]">
                    OBJECTIF
                  </span>
                  <span className="font-display text-sm font-semibold text-[var(--color-text)]">
                    Transformer l&apos;attention en action
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </Section>
    </div>
  );
}
