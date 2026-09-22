"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FIELD_LIMITS, HONEYPOT_FIELD } from "@/lib/audit-submission";
import { track } from "@/lib/tracking";
import { DIMENSION_LABELS, type Finding, type Report } from "@/lib/audit-engine/types";
import type { BookingAttribution } from "@/lib/booking";

type FormState = {
  siteUrl: string;
  secteur: string;
  objectif: string;
  nom: string;
  entreprise: string;
  email: string;
  telephone: string;
};

type Stage = "site" | "preview" | "trade" | "goal" | "contact" | "done";
type PreviewStatus = "idle" | "loading" | "ready" | "failed";

const EMPTY_STATE: FormState = {
  siteUrl: "",
  secteur: "",
  objectif: "",
  nom: "",
  entreprise: "",
  email: "",
  telephone: "",
};

const TRADE_OPTIONS = [
  "Couvreur / toiture",
  "Plombier / chauffagiste",
  "Électricien",
  "Menuisier",
  "Peintre / façadier",
  "Maçon",
  "Paysagiste",
  "Entreprise générale BTP",
  "Autre",
];

const OBJECTIVES = [
  "Plus de chantiers",
  "Plus de clients locaux",
  "Être mieux trouvé sur Google",
  "Recevoir plus d'appels qualifiés",
  "Autre",
];

const SITE_URL_FIELD_ID = "audit-site-url";
const REPORT_WAIT_MS = 8_000;

function inputClass() {
  return "audit-input w-full rounded-[1.15rem] px-5 py-[17px] text-base text-[var(--color-text)] outline-none transition-all duration-200";
}

function toEmailSummary(report: Report) {
  return {
    degraded: report.degraded,
    topLeaks: report.topLeaks.map((f) => ({
      title: f.title,
      dimension: DIMENSION_LABELS[f.dimension],
    })),
    otherFindingsCount: report.otherFindings.length,
  };
}

function bestPreviewFinding(report: Report | null): Finding | null {
  if (!report || report.degraded) return null;
  return (
    report.topLeaks.find((finding) => finding.confidence === "observed") ??
    report.topLeaks[0] ??
    report.worksWell.find((finding) => finding.confidence === "observed") ??
    null
  );
}

export function AuditFunnel() {
  const [stage, setStage] = useState<Stage>("site");
  const [data, setData] = useState<FormState>(EMPTY_STATE);
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>("idle");
  const [quickReport, setQuickReport] = useState<Report | null>(null);
  const [refinedLoading, setRefinedLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [attribution, setAttribution] = useState<BookingAttribution>({});
  const [clickIds, setClickIds] = useState({ gclid: "", gbraid: "", wbraid: "" });
  const [otherTrade, setOtherTrade] = useState("");
  const [otherGoal, setOtherGoal] = useState("");
  const [showCallbackFields, setShowCallbackFields] = useState(false);

  const engaged = useRef(false);
  const lastReport = useRef<Report | null>(null);
  const refinedPromise = useRef<Promise<Report | null> | null>(null);

  useEffect(() => {
    track("audit_started");

    const params = new URLSearchParams(window.location.search);
    const fromHomepage = params.get("site")?.trim().slice(0, FIELD_LIMITS.siteUrl) ?? "";

    setAttribution({
      source: params.get("utm_source")?.trim().slice(0, 120) || undefined,
      medium: params.get("utm_medium")?.trim().slice(0, 120) || undefined,
      campaign: params.get("utm_campaign")?.trim().slice(0, 120) || undefined,
      content: params.get("utm_content")?.trim().slice(0, 120) || undefined,
      term: params.get("utm_term")?.trim().slice(0, 120) || undefined,
    });

    setClickIds({
      gclid: params.get("gclid")?.trim().slice(0, 220) || "",
      gbraid: params.get("gbraid")?.trim().slice(0, 220) || "",
      wbraid: params.get("wbraid")?.trim().slice(0, 220) || "",
    });

    if (fromHomepage) {
      setData((prev) => ({ ...prev, siteUrl: fromHomepage }));
    }
  }, []);

  function markEngaged() {
    if (engaged.current) return;
    engaged.current = true;
    track("form_started");
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    markEngaged();
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function startQuickScan(event?: FormEvent) {
    event?.preventDefault();
    if (data.siteUrl.trim().length < 4 || previewStatus === "loading") return;

    markEngaged();
    setError(null);
    setStage("preview");
    setPreviewStatus("loading");
    track("audit_analysis_started");

    try {
      const res = await fetch("/api/audit/quick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteUrl: data.siteUrl.trim() }),
      });

      if (!res.ok) {
        setPreviewStatus("failed");
        return;
      }

      const body = (await res.json()) as { report?: Report };
      const report = body.report ?? null;
      setQuickReport(report);
      if (report) {
        lastReport.current = report;
        track("audit_analysis_completed");
      }
      setPreviewStatus(report ? "ready" : "failed");
    } catch {
      setPreviewStatus("failed");
    }
  }

  function startRefinedAnalysis(secteur: string, objectif: string) {
    setRefinedLoading(true);

    const promise = fetch("/api/audit/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteUrl: data.siteUrl,
        secteur,
        objectif,
      }),
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const body = (await res.json()) as { report?: Report };
        return body.report ?? null;
      })
      .catch(() => null)
      .then((report) => {
        if (report) lastReport.current = report;
        setRefinedLoading(false);
        return report;
      });

    refinedPromise.current = promise;
  }

  function chooseTrade(option: string) {
    if (option === "Autre") {
      update("secteur", option);
      return;
    }
    update("secteur", option);
    setStage("goal");
    track("audit_step_3");
  }

  function confirmOtherTrade() {
    if (otherTrade.trim().length < 2) return;
    const value = `Autre — ${otherTrade.trim()}`;
    update("secteur", value);
    setStage("goal");
    track("audit_step_3");
  }

  function chooseGoal(option: string) {
    if (option === "Autre") {
      update("objectif", option);
      return;
    }
    update("objectif", option);
    startRefinedAnalysis(data.secteur, option);
    setStage("contact");
    track("audit_step_4");
  }

  function confirmOtherGoal() {
    if (otherGoal.trim().length < 2) return;
    const value = `Autre — ${otherGoal.trim()}`;
    update("objectif", value);
    startRefinedAnalysis(data.secteur, value);
    setStage("contact");
    track("audit_step_4");
  }

  async function resolveBestReport(): Promise<Report | null> {
    if (!refinedPromise.current) return lastReport.current ?? quickReport;
    return Promise.race([
      refinedPromise.current.then((report) => report ?? lastReport.current ?? quickReport),
      new Promise<Report | null>((resolve) =>
        setTimeout(() => resolve(lastReport.current ?? quickReport), REPORT_WAIT_MS)
      ),
    ]);
  }

  function errorMessageFor(status: number) {
    if (status === 429) return "Trop de demandes depuis cette connexion. Réessayez dans quelques minutes.";
    if (status === 422 || status === 413) return "Vérifiez votre email puis réessayez.";
    return "La demande n'a pas pu être envoyée. Réessayez dans quelques instants.";
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !data.email.includes("@")) return;

    setSubmitting(true);
    setError(null);

    try {
      let adUserDataConsent = "UNSPECIFIED";
      try {
        const choice = window.localStorage.getItem("gc-revenue-consent-v1");
        adUserDataConsent =
          choice === "accepted" ? "GRANTED" : choice === "refused" ? "DENIED" : "UNSPECIFIED";
      } catch {}

      const summaryReport = lastReport.current ?? quickReport;

      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ...(summaryReport ? { reportSummary: toEmailSummary(summaryReport) } : {}),
          utmSource: attribution.source,
          utmMedium: attribution.medium,
          utmCampaign: attribution.campaign,
          utmContent: attribution.content,
          utmTerm: attribution.term,
          gclid: clickIds.gclid,
          gbraid: clickIds.gbraid,
          wbraid: clickIds.wbraid,
          adUserDataConsent,
          [HONEYPOT_FIELD]: honeypot,
        }),
      });

      if (!res.ok) {
        setError(errorMessageFor(res.status));
        return;
      }

      const responseBody = (await res.json().catch(() => ({ accepted: true }))) as {
        accepted?: boolean;
      };

      if (responseBody.accepted === false) {
        setStage("done");
        return;
      }

      track("audit_completed");
      track("form_completed");
      track("generate_lead", {
        lead_source: attribution.source || "capable_audit",
        lead_medium: attribution.medium || "website",
        lead_campaign: attribution.campaign || "audit_conversion",
        secteur: data.secteur,
        objectif: data.objectif,
      });

      const report = await resolveBestReport();

      try {
        sessionStorage.setItem(
          "gc_audit_result",
          JSON.stringify({
            report,
            lead: {
              nom: data.nom,
              email: data.email,
              telephone: data.telephone,
              adUserDataConsent,
            },
            entreprise: data.entreprise,
            attribution,
          })
        );
        sessionStorage.removeItem("gc_google_ads_lead_sent");
        sessionStorage.setItem("gc_google_ads_conversion_pending", "1");
      } catch {}

      window.location.assign("/audit/merci");
    } catch {
      setError("La demande n'a pas pu être envoyée. Réessayez dans quelques instants.");
    } finally {
      setSubmitting(false);
    }
  }

  const previewFinding = bestPreviewFinding(quickReport);
  const previewCount = quickReport?.topLeaks.length ?? 0;

  return (
    <div className="mx-auto max-w-xl">
      <AnimatePresence mode="wait">
        {stage === "site" && (
          <motion.form
            key="site"
            onSubmit={startQuickScan}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-[11px] font-semibold tracking-[-0.01em] text-[var(--color-text)]">
                Analyse de votre site
              </p>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] font-medium text-[var(--color-muted)]">
                Sans email
              </span>
            </div>

            <label htmlFor={SITE_URL_FIELD_ID} className="sr-only">Votre site</label>
            <input
              id={SITE_URL_FIELD_ID}
              name="siteUrl"
              autoFocus
              type="text"
              inputMode="url"
              maxLength={FIELD_LIMITS.siteUrl}
              placeholder="votre-entreprise.fr"
              className={inputClass()}
              value={data.siteUrl}
              onChange={(e) => update("siteUrl", e.target.value)}
            />

            <button
              type="submit"
              disabled={data.siteUrl.trim().length < 4}
              className="audit-primary-cta mt-3 inline-flex min-h-[58px] w-full items-center justify-center rounded-[1.15rem] px-6 text-[15px] font-semibold transition-all duration-300 disabled:cursor-not-allowed"
            >
              Analyser mon site gratuitement →
            </button>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--color-muted)]">
              1er résultat ici · gratuit · aucun email demandé
            </p>
          </motion.form>
        )}

        {stage === "preview" && (
          <motion.div
            key="preview"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.35 }}
          >
            {previewStatus === "loading" ? (
              <div className="py-3">
                <div className="flex items-center justify-between">
                  <p className="font-display text-xl font-semibold">On analyse ce qui peut vous faire perdre des clients.</p>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
                </div>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  On vérifie ce qu’un futur client voit avant de choisir : visibilité, confiance et facilité à vous contacter.
                </p>

                <div className="mt-7 space-y-3">
                  {["Visibilité locale", "Confiance & preuves", "Parcours vers le devis"].map((label, index) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0.3 }}
                      animate={{ opacity: [0.35, 1, 0.35] }}
                      transition={{ duration: 1.4, repeat: Infinity, delay: index * 0.25 }}
                      className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] px-4 py-3"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                      <span className="text-sm">{label}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            ) : previewStatus === "ready" ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                  Ce qui peut vous faire perdre des demandes
                </p>

                {previewFinding ? (
                  <div className="audit-result-glow mt-4 rounded-2xl border border-[var(--color-accent)]/35 bg-[var(--color-accent-soft)] p-5">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-[var(--color-muted)]">
                        {previewFinding.confidence === "observed" ? "Observé sur votre site" : "Signal détecté"}
                      </span>
                      {previewCount > 1 && (
                        <span className="text-xs font-semibold text-[var(--color-accent)]">
                          + {previewCount - 1} autre{previewCount > 2 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight">
                      {previewFinding.title}
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                      {previewFinding.statement}
                    </p>
                    {previewFinding.evidence[0] && (
                      <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-xs leading-relaxed text-[var(--color-text)]">
                        {previewFinding.evidence[0]}
                      </p>
                    )}
                    {previewFinding.recommendation && (
                      <div className="mt-4 rounded-xl border border-[var(--color-accent)]/25 bg-black/20 px-4 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
                          Première action recommandée
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text)]">
                          {previewFinding.recommendation}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <h2 className="font-display text-xl font-semibold">Votre base a été analysée.</h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                      On a besoin de deux réponses rapides pour prioriser les leviers les plus utiles à votre activité.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setStage("trade");
                    track("audit_step_2");
                  }}
                  className="audit-primary-cta mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-2xl px-7 text-base font-semibold transition-all duration-300"
                >
                  {previewCount > 1 ? `Voir les ${previewCount - 1} autres points →` : "Voir mon plan complet →"}
                </button>
                <p className="mt-3 text-center text-[11px] text-[var(--color-muted)]">
                  2 clics restants
                </p>
              </div>
            ) : (
              <div>
                <h2 className="font-display text-2xl font-semibold">On affine autrement.</h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                  La lecture automatique n’a pas pu récupérer assez d’éléments. Deux réponses suffisent pour préparer le diagnostic.
                </p>
                <button
                  type="button"
                  onClick={() => setStage("trade")}
                  className="mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-[var(--color-text)] px-7 text-base font-semibold text-[var(--color-bg)]"
                >
                  Continuer →
                </button>
              </div>
            )}
          </motion.div>
        )}

        {stage === "trade" && (
          <motion.div
            key="trade"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.35 }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">2 clics restants</p>
            <h2 className="font-display mt-2 text-2xl font-semibold">Quel est votre métier ?</h2>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {TRADE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => chooseTrade(option)}
                  className={`rounded-xl border px-3 py-3 text-sm transition-all ${data.secteur === option ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-[var(--color-border-strong)] hover:border-[var(--color-accent)]"}`}
                >
                  {option}
                </button>
              ))}
            </div>

            {data.secteur === "Autre" && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={otherTrade}
                  onChange={(e) => setOtherTrade(e.target.value)}
                  placeholder="Votre métier"
                  className={inputClass()}
                />
                <button type="button" onClick={confirmOtherTrade} className="rounded-xl bg-[var(--color-text)] px-4 text-sm font-semibold text-[var(--color-bg)]">
                  OK
                </button>
              </div>
            )}
          </motion.div>
        )}

        {stage === "goal" && (
          <motion.div
            key="goal"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.35 }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">1 clic restant</p>
            <h2 className="font-display mt-2 text-2xl font-semibold">Votre priorité aujourd’hui ?</h2>
            <div className="mt-5 flex flex-col gap-2">
              {OBJECTIVES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => chooseGoal(option)}
                  className={`rounded-xl border px-4 py-4 text-left text-sm transition-all ${data.objectif === option ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-[var(--color-border-strong)] hover:border-[var(--color-accent)]"}`}
                >
                  {option}
                </button>
              ))}
            </div>

            {data.objectif === "Autre" && (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={otherGoal}
                  onChange={(e) => setOtherGoal(e.target.value)}
                  placeholder="Votre objectif"
                  className={inputClass()}
                />
                <button type="button" onClick={confirmOtherGoal} className="rounded-xl bg-[var(--color-text)] px-4 text-sm font-semibold text-[var(--color-bg)]">
                  OK
                </button>
              </div>
            )}
          </motion.div>
        )}

        {stage === "contact" && (
          <motion.form
            key="contact"
            onSubmit={handleSubmit}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.35 }}
          >
            <div aria-hidden className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <input
                name={HONEYPOT_FIELD}
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-accent)]">
                  Votre plan
                </p>
                <h2 className="font-display mt-2 text-2xl font-semibold">
                  {refinedLoading ? "On finalise vos priorités…" : "Vos 3 priorités sont prêtes."}
                </h2>
              </div>
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
            </div>

            <div className="mt-5 grid gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-sm">
              <span>01 · Ce qui vous freine</span>
              <span>02 · Ce qu’il faut corriger en premier</span>
              <span>03 · Vos prochaines actions</span>
            </div>

            <p className="mt-5 text-sm text-[var(--color-muted)]">
              Dernière étape : votre email pour afficher et recevoir le plan complet.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-[11px] font-medium text-[var(--color-muted)]">
                Email
                <input
                  required
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={FIELD_LIMITS.email}
                  autoComplete="email"
                  placeholder="vous@entreprise.fr"
                  className={`${inputClass()} mt-2`}
                  value={data.email}
                  onChange={(e) => update("email", e.target.value)}
                />
              </label>

              {!showCallbackFields ? (
                <button
                  type="button"
                  onClick={() => setShowCallbackFields(true)}
                  className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
                >
                  Je préfère être rappelé →
                </button>
              ) : (
                <div className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <p className="px-1 text-[11px] text-[var(--color-muted)]">
                    Optionnel · uniquement si vous voulez qu’on vous rappelle
                  </p>
                  <input
                    type="text"
                    maxLength={FIELD_LIMITS.nom}
                    autoComplete="name"
                    placeholder="Votre prénom"
                    className={inputClass()}
                    value={data.nom}
                    onChange={(e) => update("nom", e.target.value)}
                  />
                  <input
                    type="tel"
                    inputMode="tel"
                    maxLength={FIELD_LIMITS.telephone}
                    autoComplete="tel"
                    placeholder="Votre téléphone"
                    className={inputClass()}
                    value={data.telephone}
                    onChange={(e) => update("telephone", e.target.value)}
                  />
                </div>
              )}
            </div>

            {error && <p className="mt-3 text-sm text-red-400" role="alert">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !data.email.includes("@")}
              className="audit-primary-cta mt-4 inline-flex min-h-14 w-full items-center justify-center rounded-2xl px-7 text-base font-semibold transition-all duration-300 disabled:cursor-not-allowed"
            >
              {submitting ? "Préparation de votre plan…" : "Afficher mon plan complet →"}
            </button>

            <p className="mt-3 text-center text-[11px] text-[var(--color-muted)]">
              Résultat immédiat · Sans engagement · Vos données ne sont pas vendues
            </p>
          </motion.form>
        )}

        {stage === "done" && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <h2 className="font-display text-2xl font-semibold">C’est bon.</h2>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
