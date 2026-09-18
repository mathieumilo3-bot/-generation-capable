"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/tracking";

/**
 * Sequences 2 and 3 of the homepage: the visitor puts their site in, watches
 * what an analysis looks like, and sees the four axes it produces.
 *
 * The scores are a worked example, not a measurement of the visitor's site —
 * there is no crawler behind this yet. Everything on screen says so, and the
 * URL is only carried over to /audit so the real, human-run analysis starts
 * with it already filled in.
 */
const CHECKS = [
  "Lecture de la page d'accueil",
  "Repérage de la proposition de valeur",
  "Détection des points de contact",
  "Analyse du parcours vers l'action",
];

const AXES = [
  {
    label: "Visibilité",
    score: 78,
    note: "Trouvable, mais sur des requêtes peu qualifiées.",
  },
  {
    label: "Clarté",
    score: 71,
    note: "L'offre se comprend, mais trop bas dans la page.",
  },
  {
    label: "Confiance",
    score: 43,
    note: "Peu d'éléments qui rassurent avant la prise de contact.",
  },
  {
    label: "Conversion",
    score: 52,
    note: "Le visiteur n'a pas d'action évidente à effectuer.",
  },
];

type Phase = "idle" | "analysing" | "done";

/** The score counts up rather than appearing: the diagnostic reads as built, not printed. */
function Score({ to, delay, instant }: { to: number; delay: number; instant: boolean }) {
  const value = useMotionValue(instant ? to : 0);
  const rounded = useTransform(value, (v) => Math.round(v));

  useEffect(() => {
    if (instant) {
      value.set(to);
      return;
    }
    const controls = animate(value, to, {
      duration: 0.9,
      delay,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [to, delay, instant, value]);

  return <motion.span>{rounded}</motion.span>;
}

export function InstantCheck() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [checkIndex, setCheckIndex] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrolled = useRef(false);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  /**
   * The diagnostic lands below the fold, so it is brought to the visitor.
   *
   * This has to hang off the node attaching rather than off `phase`, because
   * `AnimatePresence mode="wait"` only mounts the panel once the checklist
   * above it has finished animating out — an effect keyed on `phase` runs
   * hundreds of milliseconds too early, with the ref still null.
   */
  const attachResult = useCallback((node: HTMLDivElement | null) => {
    if (!node || scrolled.current) return;
    scrolled.current = true;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    });
  }, []);

  function start(event: FormEvent) {
    event.preventDefault();
    if (url.trim().length < 4 || phase === "analysing") return;

    track("instant_check_started");
    scrolled.current = false;
    setPhase("analysing");
    setCheckIndex(0);

    const step = shouldReduceMotion ? 120 : 620;
    CHECKS.forEach((_, index) => {
      timers.current.push(setTimeout(() => setCheckIndex(index + 1), step * (index + 1)));
    });
    timers.current.push(
      setTimeout(() => {
        setPhase("done");
        track("instant_check_completed");
      }, step * (CHECKS.length + 0.6))
    );
  }

  function reset() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    scrolled.current = false;
    setPhase("idle");
    setCheckIndex(0);
  }

  return (
    <Section id="analyse" tone="raised" className="py-24 sm:py-32">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-balance text-center text-3xl font-semibold leading-tight tracking-tight sm:text-[2.75rem]">
          Voyons ce que votre présence
          <br className="hidden sm:block" /> produit réellement.
        </h2>

        <div className="mt-12 overflow-hidden rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-bg)]">
          {/* Window chrome — signals "outil", not "formulaire de contact". */}
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-5 py-3.5">
            <span className="h-2 w-2 rounded-full bg-[var(--color-border-strong)]" />
            <span className="h-2 w-2 rounded-full bg-[var(--color-border-strong)]" />
            <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
            <p className="ml-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-muted)]">
              Capable Audit
            </p>
          </div>

          <div className="p-6 sm:p-8">
            <form onSubmit={start} className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="instant-check-url" className="sr-only">
                Adresse de votre site
              </label>
              <input
                id="instant-check-url"
                name="site"
                type="text"
                inputMode="url"
                autoComplete="url"
                maxLength={300}
                placeholder="https://votresite.fr"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full flex-1 rounded-xl border border-[var(--color-border-strong)] bg-transparent px-5 py-4 text-base text-[var(--color-text)] outline-none transition-colors duration-200 placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
              />
              <button
                type="submit"
                disabled={url.trim().length < 4 || phase === "analysing"}
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--color-text)] px-7 py-4 text-sm font-medium text-[var(--color-bg)] transition-all duration-300 hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {phase === "analysing" ? "Analyse…" : "Lancer l'analyse →"}
              </button>
            </form>

            <AnimatePresence mode="wait">
              {phase === "analysing" && (
                <motion.ul
                  key="analysing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  aria-live="polite"
                  className="mt-8 flex flex-col gap-3"
                >
                  {CHECKS.map((check, index) => (
                    <li
                      key={check}
                      className={`flex items-center gap-3 text-sm transition-colors duration-300 ${
                        index < checkIndex
                          ? "text-[var(--color-text)]"
                          : "text-[var(--color-muted)]/50"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
                          index < checkIndex
                            ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                            : "border-[var(--color-border-strong)]"
                        }`}
                      >
                        {index < checkIndex ? "✓" : ""}
                      </span>
                      {check}
                    </li>
                  ))}
                </motion.ul>
              )}

              {phase === "done" && (
                <motion.div
                  key="done"
                  ref={attachResult}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-8 scroll-mt-28"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-5 py-4">
                    <p className="text-sm text-[var(--color-text)]">
                      <span className="font-semibold">Démonstration.</span>{" "}
                      Voici le format de restitution — les valeurs ci-dessous
                      sont un exemple, pas une mesure de votre site.
                    </p>
                  </div>

                  <div className="mt-8 flex flex-col gap-6">
                    {AXES.map((axis, index) => (
                      <div key={axis.label}>
                        <div className="mb-2 flex items-baseline justify-between gap-4">
                          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-muted)]">
                            {axis.label}
                          </span>
                          <span className="font-display text-lg font-medium tabular-nums text-[var(--color-text)]">
                            <Score
                              to={axis.score}
                              delay={index * 0.12}
                              instant={!!shouldReduceMotion}
                            />
                          </span>
                        </div>
                        <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-border)]">
                          <motion.div
                            className="h-full rounded-full bg-[var(--color-accent)]"
                            initial={{ width: 0 }}
                            animate={{ width: `${axis.score}%` }}
                            transition={{
                              duration: shouldReduceMotion ? 0 : 0.9,
                              delay: shouldReduceMotion ? 0 : index * 0.12,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                          />
                        </div>
                        <p className="mt-2 text-sm text-[var(--color-muted)]">{axis.note}</p>
                      </div>
                    ))}
                  </div>

                  <p className="font-display mt-10 text-xl font-medium leading-snug text-[var(--color-text)]">
                    Le problème n&apos;est pas toujours votre trafic.
                    <br />
                    <span className="text-[var(--color-muted)]">
                      Parfois, c&apos;est ce qui se passe après.
                    </span>
                  </p>

                  <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
                    <Button
                      href={`/audit?site=${encodeURIComponent(url.trim())}`}
                      variant="primary"
                      trackEvent="cta_clicked"
                      trackPayload={{ location: "instant_check_result" }}
                    >
                      Obtenir l&apos;analyse de mon site →
                    </Button>
                    <button
                      type="button"
                      onClick={reset}
                      className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
                    >
                      Recommencer
                    </button>
                  </div>

                  <p className="mt-6 text-xs leading-relaxed text-[var(--color-muted)]">
                    Votre analyse réelle est réalisée par notre équipe à partir
                    de l&apos;adresse que vous nous transmettez. Nous ne
                    publions aucun score automatique.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Section>
  );
}
