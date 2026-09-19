"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { SECTORS } from "@/lib/data/sectors";
import { FIELD_LIMITS, HONEYPOT_FIELD } from "@/lib/audit-submission";
import { track, type TrackingEvent } from "@/lib/tracking";
import { AuditReport } from "@/components/audit/AuditReport";
import { DIMENSION_LABELS, type Report } from "@/lib/audit-engine/types";

/**
 * The small, display-only digest sent to /api/audit alongside the lead —
 * see `ReportEmailSummary` in audit-submission.ts, which this must match.
 * Titles and French dimension labels only: the business gets a skim-in-the-
 * inbox summary, not the whole Report object.
 */
function toEmailSummary(report: Report) {
  return {
    degraded: report.degraded,
    topLeaks: report.topLeaks.map((f) => ({ title: f.title, dimension: DIMENSION_LABELS[f.dimension] })),
    otherFindingsCount: report.otherFindings.length,
  };
}

/**
 * How long the confirmation screen will wait, once the lead is captured, for
 * the diagnostic engine to finish — it usually already has by then (the
 * engine runs in the background from the moment the visitor leaves step 3,
 * while they type their coordonnées). If it hasn't landed within this
 * window, the visitor sees the plain confirmation instead: never blocked on
 * the diagnostic, whatever happens to it.
 */
const REPORT_WAIT_MS = 3_000;

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
const SITE_URL_FIELD_ID = "audit-site-url";
const OTHER_OPTION = "Autre";
const PRECISION_MAX_LENGTH = 60;

const OBJECTIVES = [
  "Plus de demandes",
  "Plus de rendez-vous",
  "Plus de visibilité",
  "Meilleure image",
  OTHER_OPTION,
];

function inputClass() {
  return "w-full rounded-xl border border-[var(--color-border-strong)] bg-transparent px-5 py-4 text-base text-[var(--color-text)] outline-none transition-colors duration-200 placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40";
}

export function AuditFunnel() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<FormState>(EMPTY_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [finalReport, setFinalReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  // "Autre" on its own tells the business nothing, so it asks for a précision.
  const [secteurAutre, setSecteurAutre] = useState("");
  const [objectifAutre, setObjectifAutre] = useState("");
  const started = useRef(false);
  const engaged = useRef(false);
  const analysisStarted = useRef(false);
  const analysisPromise = useRef<Promise<Report | null> | null>(null);
  // Set synchronously the moment the background analysis resolves — read at
  // submit time without awaiting anything, so attaching it to the lead email
  // can never delay or risk that submission.
  const lastReport = useRef<Report | null>(null);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      track("audit_started");
      track("audit_step_1");
    }

    // Arriving from the homepage tool: ?site= carries the address already
    // typed there, so the visitor never types it twice. Read from the URL
    // directly rather than useSearchParams, which would opt this page out of
    // static rendering.
    const fromHomepage =
      new URLSearchParams(window.location.search).get("site")?.trim().slice(0, FIELD_LIMITS.siteUrl) ??
      "";

    // The first field is autofocused, so someone can start typing before
    // React hydrates. A controlled input would throw those keystrokes away
    // on its first render, so adopt whatever the DOM already holds.
    const input = document.getElementById(SITE_URL_FIELD_ID) as HTMLInputElement | null;
    const prefill = input?.value || fromHomepage;
    if (prefill) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the DOM and the URL, neither of which React can observe during hydration
      setData((prev) => (prev.siteUrl ? prev : { ...prev, siteUrl: prefill }));
    }
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    // form_started means the visitor engaged, not that the page loaded — on a
    // page whose only content is the form, the latter would just duplicate
    // audit_started and tell an ad platform nothing about intent.
    if (!engaged.current) {
      engaged.current = true;
      track("form_started");
    }
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function canAdvance() {
    if (step === 1) return data.siteUrl.trim().length > 3;
    if (step === 2) {
      if (data.secteur === OTHER_OPTION) return secteurAutre.trim().length > 1;
      return data.secteur.trim().length > 0;
    }
    if (step === 3) {
      if (data.objectif === OTHER_OPTION) return objectifAutre.trim().length > 1;
      return data.objectif.trim().length > 0;
    }
    return true;
  }

  /** Folds the précision into the value so the email reads naturally. */
  function withPrecision(value: string, precision: string) {
    return value === OTHER_OPTION ? `${OTHER_OPTION} — ${precision.trim()}` : value;
  }

  /**
   * Kicks off the real diagnostic as soon as we have everything it needs —
   * site, secteur and objectif — rather than waiting for the coordonnées.
   * It runs in the background while the visitor types their name and email,
   * so by the time they submit, the analysis has usually already landed.
   * Never awaited here: a slow or failing analysis must never hold up the
   * wizard itself.
   */
  function triggerAnalysis() {
    if (analysisStarted.current) return;
    analysisStarted.current = true;
    track("audit_analysis_started");

    const promise = fetch("/api/audit/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteUrl: data.siteUrl,
        secteur: withPrecision(data.secteur, secteurAutre),
        objectif: withPrecision(data.objectif, objectifAutre),
      }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json()) as { report?: Report };
        return body.report ?? null;
      })
      .catch(() => null)
      .then((report) => {
        if (report) {
          track("audit_analysis_completed");
          lastReport.current = report;
        }
        return report;
      });

    analysisPromise.current = promise;
  }

  /** Waits briefly for the background analysis, never longer than REPORT_WAIT_MS. */
  async function resolveReport(): Promise<Report | null> {
    if (!analysisPromise.current) return null;
    return Promise.race([
      analysisPromise.current,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), REPORT_WAIT_MS)),
    ]);
  }

  function goNext() {
    if (!canAdvance()) return;
    const next = Math.min(step + 1, TOTAL_STEPS);
    setStep(next);
    track(`audit_step_${next}` as TrackingEvent);
    if (next === 4) triggerAnalysis();
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 1));
  }

  function errorMessageFor(status: number): string {
    if (status === 429) {
      return "Trop de demandes envoyées depuis cette connexion. Merci de réessayer dans quelques minutes.";
    }
    if (status === 422 || status === 413) {
      return "Certaines informations semblent incorrectes. Vérifiez votre email et réessayez.";
    }
    return "Votre demande n'a pas pu être envoyée. Vérifiez votre connexion et réessayez.";
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
        body: JSON.stringify({
          ...data,
          secteur: withPrecision(data.secteur, secteurAutre),
          objectif: withPrecision(data.objectif, objectifAutre),
          // Only attached when the background analysis already resolved —
          // never awaited, so a slow diagnostic can never delay this submit.
          ...(lastReport.current ? { reportSummary: toEmailSummary(lastReport.current) } : {}),
          [HONEYPOT_FIELD]: honeypot,
        }),
      });

      if (!res.ok) {
        setError(errorMessageFor(res.status));
        return;
      }

      track("audit_completed");
      track("form_completed");
      track("generate_lead", { lead_source: "capable_audit", secteur: data.secteur, objectif: data.objectif });
      setSubmitted(true);
      setSubmitting(false);

      // The lead is captured — everything past this point is best-effort
      // polish on top of a submission that has already succeeded.
      setFinalizing(true);
      const report = await resolveReport();
      setFinalReport(report);
      setFinalizing(false);
      return;
    } catch {
      setError(
        "Votre demande n'a pas pu être envoyée. Vérifiez votre connexion et réessayez."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    if (finalReport) {
      return <AuditReport report={finalReport} />;
    }

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
        <h2 className="font-display mt-8 text-3xl font-semibold tracking-tight sm:text-4xl">
          {finalizing ? "Finalisation de votre diagnostic…" : "Votre analyse est en préparation."}
        </h2>
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
        <div
          className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.2em] text-[var(--color-muted)]"
          aria-live="polite"
        >
          <span>Étape {step} / {TOTAL_STEPS}</span>
        </div>
        <div
          className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-border)]"
          role="progressbar"
          aria-valuenow={step}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
        >
          <motion.div
            className="h-full rounded-full bg-[var(--color-accent)]"
            animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Hidden from people and assistive tech; bots fill it and get dropped. */}
        <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label htmlFor={HONEYPOT_FIELD}>Ne pas remplir</label>
          <input
            id={HONEYPOT_FIELD}
            name={HONEYPOT_FIELD}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Votre site
              </h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                L&apos;adresse de votre site actuel, ou de votre page
                principale (réseaux sociaux si vous n&apos;avez pas de site).
              </p>
              <label htmlFor={SITE_URL_FIELD_ID} className="sr-only">
                Votre site
              </label>
              <input
                id={SITE_URL_FIELD_ID}
                name="siteUrl"
                autoFocus
                type="text"
                inputMode="url"
                maxLength={FIELD_LIMITS.siteUrl}
                placeholder="https://votre-entreprise.fr"
                className={`${inputClass()} mt-6`}
                value={data.siteUrl}
                onChange={(e) => update("siteUrl", e.target.value)}
                onKeyDown={(e) => {
                  // A form with a single text field submits implicitly on
                  // Enter even with no visible submit button — intercept it
                  // so Enter advances the wizard instead of submitting.
                  if (e.key === "Enter") {
                    e.preventDefault();
                    goNext();
                  }
                }}
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
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Votre activité
              </h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Choisissez le secteur qui correspond le mieux à votre
                entreprise.
              </p>
              <div
                role="group"
                aria-label="Secteur d'activité"
                className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3"
              >
                {[...SECTORS.map((s) => s.name), OTHER_OPTION].map((option) => (
                  <button
                    type="button"
                    key={option}
                    aria-pressed={data.secteur === option}
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

              {data.secteur === OTHER_OPTION && (
                <div className="mt-4">
                  <label htmlFor="audit-secteur-autre" className="sr-only">
                    Précisez votre secteur
                  </label>
                  <input
                    id="audit-secteur-autre"
                    name="secteurAutre"
                    autoFocus
                    type="text"
                    maxLength={PRECISION_MAX_LENGTH}
                    placeholder="Précisez votre secteur"
                    className={inputClass()}
                    value={secteurAutre}
                    onChange={(e) => setSecteurAutre(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        goNext();
                      }
                    }}
                  />
                </div>
              )}
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
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Votre objectif
              </h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Quel est le résultat le plus important pour vous aujourd&apos;hui ?
              </p>
              <div role="group" aria-label="Objectif principal" className="mt-6 flex flex-col gap-3">
                {OBJECTIVES.map((option) => (
                  <button
                    type="button"
                    key={option}
                    aria-pressed={data.objectif === option}
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

              {data.objectif === OTHER_OPTION && (
                <div className="mt-4">
                  <label htmlFor="audit-objectif-autre" className="sr-only">
                    Précisez votre objectif
                  </label>
                  <input
                    id="audit-objectif-autre"
                    name="objectifAutre"
                    autoFocus
                    type="text"
                    maxLength={PRECISION_MAX_LENGTH}
                    placeholder="Précisez votre objectif"
                    className={inputClass()}
                    value={objectifAutre}
                    onChange={(e) => setObjectifAutre(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        goNext();
                      }
                    }}
                  />
                </div>
              )}
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
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                Vos coordonnées
              </h2>
              <p className="mt-2 text-sm text-[var(--color-muted)]">
                Pour vous transmettre votre audit personnellement.
              </p>
              <div className="mt-6 flex flex-col gap-4">
                <label htmlFor="audit-nom" className="sr-only">
                  Nom complet
                </label>
                <input
                  id="audit-nom"
                  name="nom"
                  required
                  type="text"
                  maxLength={FIELD_LIMITS.nom}
                  autoComplete="name"
                  placeholder="Nom complet"
                  className={inputClass()}
                  value={data.nom}
                  onChange={(e) => update("nom", e.target.value)}
                />
                <label htmlFor="audit-entreprise" className="sr-only">
                  Entreprise
                </label>
                <input
                  id="audit-entreprise"
                  name="entreprise"
                  type="text"
                  maxLength={FIELD_LIMITS.entreprise}
                  autoComplete="organization"
                  placeholder="Entreprise"
                  className={inputClass()}
                  value={data.entreprise}
                  onChange={(e) => update("entreprise", e.target.value)}
                />
                <label htmlFor="audit-email" className="sr-only">
                  Email
                </label>
                <input
                  id="audit-email"
                  name="email"
                  required
                  type="email"
                  maxLength={FIELD_LIMITS.email}
                  autoComplete="email"
                  placeholder="Email"
                  className={inputClass()}
                  value={data.email}
                  onChange={(e) => update("email", e.target.value)}
                />
                <label htmlFor="audit-telephone" className="sr-only">
                  Téléphone
                </label>
                <input
                  id="audit-telephone"
                  name="telephone"
                  type="tel"
                  maxLength={FIELD_LIMITS.telephone}
                  autoComplete="tel"
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
              key="continue-btn"
              type="button"
              onClick={goNext}
              disabled={!canAdvance()}
              className="inline-flex items-center justify-center rounded-full bg-[var(--color-text)] px-7 py-3.5 text-sm font-medium text-[var(--color-bg)] transition-all duration-300 hover:bg-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continuer →
            </button>
          ) : (
            <button
              key="submit-btn"
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
