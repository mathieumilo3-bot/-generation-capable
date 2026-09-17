"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { SECTORS } from "@/lib/data/sectors";
import { track } from "@/lib/tracking";

const OBJECTIVES = [
  "Plus de demandes",
  "Plus de rendez-vous",
  "Plus de visibilité",
  "Meilleure image",
  "Autre",
];

type FormState = {
  siteUrl: string;
  secteur: string;
  objectif: string;
  nom: string;
  entreprise: string;
  email: string;
  telephone: string;
};

const EMPTY_STATE: FormState = {
  siteUrl: "",
  secteur: "",
  objectif: "",
  nom: "",
  entreprise: "",
  email: "",
  telephone: "",
};

const TOTAL_STEPS = 4;

function inputClass() {
  return "w-full rounded-xl border border-[var(--color-border-strong)] bg-transparent px-5 py-4 text-base text-[var(--color-text)] outline-none transition-colors duration-200 placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)]";
}

export function AuditFunnel() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormState>(EMPTY_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      track("audit_started");
      track("form_started");
    }
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function canAdvance() {
    if (step === 1) return data.siteUrl.trim().length > 3;
    if (step === 2) return data.secteur.trim().length > 0;
    if (step === 3) return data.objectif.trim().length > 0;
    return true;
  }

  function goNext() {
    if (!canAdvance()) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("submission_failed");

      track("audit_completed");
      track("form_completed");
      setSubmitted(true);
    } catch {
      setError(
        "Votre demande n'a pas pu être envoyée. Vérifiez votre connexion et réessayez."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-lg text-center"
      >
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-accent)]">
          <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]" />
        </span>
        <h1 className="font-display mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">
          Votre analyse est en préparation.
        </h1>
        <p className="mt-5 text-[15px] leading-relaxed text-[var(--color-muted)]">
          Nous revenons vers vous par email avec les opportunités prioritaires
          identifiées pour {data.entreprise || "votre entreprise"}.
        </p>
        <div className="mt-10">
          <Button href="/" variant="secondary">
            Retour à l&apos;accueil
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-10">
        <div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-muted)]">
          <span>Étape {step} / {TOTAL_STEPS}</span>
        </div>
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-border)]">
          <motion.div
            className="h-full rounded-full bg-[var(--color-accent)]"
            animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Votre site
              </h1>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                L&apos;adresse de votre site actuel, ou de votre page
                principale (réseaux sociaux si vous n&apos;avez pas de site).
              </p>
              <input
                autoFocus
                type="text"
                inputMode="url"
                placeholder="https://votre-entreprise.fr"
                className={`${inputClass()} mt-6`}
                value={data.siteUrl}
                onChange={(e) => update("siteUrl", e.target.value)}
              />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Votre activité
              </h1>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Choisissez le secteur qui correspond le mieux à votre
                entreprise.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[...SECTORS.map((s) => s.name), "Autre"].map((option) => (
                  <button
                    type="button"
                    key={option}
                    onClick={() => update("secteur", option)}
                    className={`rounded-xl border px-4 py-3 text-sm transition-colors duration-200 ${
                      data.secteur === option
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-[var(--color-border-strong)] text-[var(--color-text)] hover:border-[var(--color-accent)]"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Votre objectif
              </h1>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Quel est le résultat le plus important pour vous aujourd&apos;hui ?
              </p>
              <div className="mt-6 flex flex-col gap-3">
                {OBJECTIVES.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onClick={() => update("objectif", option)}
                    className={`rounded-xl border px-5 py-4 text-left text-sm transition-colors duration-200 ${
                      data.objectif === option
                        ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                        : "border-[var(--color-border-strong)] text-[var(--color-text)] hover:border-[var(--color-accent)]"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Vos coordonnées
              </h1>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Pour vous transmettre votre audit personnellement.
              </p>
              <div className="mt-6 flex flex-col gap-4">
                <input
                  required
                  type="text"
                  placeholder="Nom complet"
                  className={inputClass()}
                  value={data.nom}
                  onChange={(e) => update("nom", e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Entreprise"
                  className={inputClass()}
                  value={data.entreprise}
                  onChange={(e) => update("entreprise", e.target.value)}
                />
                <input
                  required
                  type="email"
                  placeholder="Email"
                  className={inputClass()}
                  value={data.email}
                  onChange={(e) => update("email", e.target.value)}
                />
                <input
                  type="tel"
                  placeholder="Téléphone"
                  className={inputClass()}
                  value={data.telephone}
                  onChange={(e) => update("telephone", e.target.value)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p className="mt-4 text-sm text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="mt-10 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              ← Retour
            </button>
          ) : (
            <span />
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canAdvance()}
              className="inline-flex items-center justify-center rounded-full bg-[var(--color-text)] px-7 py-3.5 text-sm font-medium text-[var(--color-bg)] transition-all duration-300 hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuer →
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-full bg-[var(--color-text)] px-7 py-3.5 text-sm font-medium text-[var(--color-bg)] transition-all duration-300 hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Envoi en cours…" : "Obtenir mon audit →"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
