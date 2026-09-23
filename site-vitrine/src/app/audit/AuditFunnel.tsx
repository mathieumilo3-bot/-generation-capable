"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FIELD_LIMITS, HONEYPOT_FIELD } from "@/lib/audit-submission";
import { track, trackGoogleAdsLeadConversion } from "@/lib/tracking";
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

type CompanyDiscoveryCandidate = {
  name: string;
  website: string;
  sector: string;
  city: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  insights: {
    title: string;
    insight: string;
    evidence: string[];
  }[];
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
  "Plus de visibilité",
  "Être mieux trouvé sur Google",
  "Recevoir plus de demandes de devis",
  "Recevoir plus d'appels qualifiés",
  "Améliorer mon site pour convertir plus",
  "Autre",
];

const MAX_OBJECTIVES = 3;

const COMPANY_FIELD_ID = "audit-company-name";
const REPORT_WAIT_MS = 32_000;

function inputClass() {
  return "audit-input w-full rounded-[1.15rem] px-5 py-[17px] text-base text-[var(--color-text)] outline-none transition-all duration-200";
}

function toEmailSummary(report: Report) {
  if (report.aiSynthesis?.opportunities?.length) {
    return {
      degraded: false,
      topLeaks: report.aiSynthesis.opportunities.map((item) => ({
        title: item.title,
        dimension:
          item.pillar === "attirer"
            ? "Être trouvé"
            : item.pillar === "rassurer"
              ? "Être choisi"
              : "Être contacté",
        statement: `${item.diagnosis} Impact : ${item.impact}`,
        recommendation: `Décision à trancher : ${item.callQuestion}`,
      })),
      otherFindingsCount: report.otherFindings.length,
    };
  }

  return {
    degraded: report.degraded,
    topLeaks: report.topLeaks.map((f) => ({
      title: f.title,
      dimension: DIMENSION_LABELS[f.dimension],
      statement: f.statement,
      recommendation: f.recommendation,
    })),
    otherFindingsCount: report.otherFindings.length,
  };
}

function toDiscoveryEmailSummary(candidate: CompanyDiscoveryCandidate) {
  const dimensions = ["Être trouvé", "Être choisi", "Être contacté"];
  return {
    degraded: false,
    topLeaks: candidate.insights.slice(0, 3).map((item, index) => ({
      title: item.title,
      dimension: dimensions[index] ?? "Présence publique",
      statement: [
        item.insight,
        item.evidence.length ? `Preuves : ${item.evidence.join(" · ")}` : "",
      ]
        .filter(Boolean)
        .join(" "),
      recommendation: "",
    })),
    otherFindingsCount: 0,
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
  const [discovery, setDiscovery] = useState<CompanyDiscoveryCandidate | null>(null);
  const [refinedLoading, setRefinedLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [attribution, setAttribution] = useState<BookingAttribution>({});
  const [clickIds, setClickIds] = useState({ gclid: "", gbraid: "", wbraid: "" });
  const [otherTrade, setOtherTrade] = useState("");
  const [otherGoal, setOtherGoal] = useState("");
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [showCallbackFields, setShowCallbackFields] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);

  const engaged = useRef(false);
  const lastReport = useRef<Report | null>(null);
  const refinedPromise = useRef<Promise<Report | null> | null>(null);

  useEffect(() => {
    track("audit_started");

    const params = new URLSearchParams(window.location.search);
    const fromHomepageCompany = params.get("entreprise")?.trim().slice(0, FIELD_LIMITS.entreprise) ?? "";
    const fromHomepageSite = params.get("site")?.trim().slice(0, FIELD_LIMITS.siteUrl) ?? "";

    // URL-derived state is intentionally initialized after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAttribution({
      source: params.get("utm_source")?.trim().slice(0, 120) || undefined,
      medium: params.get("utm_medium")?.trim().slice(0, 120) || undefined,
      campaign: params.get("utm_campaign")?.trim().slice(0, 120) || undefined,
      content: params.get("utm_content")?.trim().slice(0, 120) || undefined,
      term: params.get("utm_term")?.trim().slice(0, 120) || undefined,
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClickIds({
      gclid: params.get("gclid")?.trim().slice(0, 220) || "",
      gbraid: params.get("gbraid")?.trim().slice(0, 220) || "",
      wbraid: params.get("wbraid")?.trim().slice(0, 220) || "",
    });

    if (fromHomepageCompany || fromHomepageSite) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData((prev) => ({
        ...prev,
        entreprise: fromHomepageCompany || prev.entreprise,
        siteUrl: fromHomepageSite || prev.siteUrl,
      }));
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

  async function startCompanyDiscovery(event?: FormEvent) {
    event?.preventDefault();
    if (previewStatus === "loading") return;

    if (data.entreprise.trim().length < 2) {
      setSiteError("Entrez simplement le nom de votre entreprise.");
      document.getElementById(COMPANY_FIELD_ID)?.focus();
      return;
    }

    markEngaged();
    setSiteError(null);
    setError(null);
    setStage("preview");
    setPreviewStatus("loading");
    setDiscovery(null);
    track("audit_step_1");
    track("audit_analysis_started");

    try {
      const res = await fetch("/api/audit/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: data.entreprise.trim() }),
      });

      if (!res.ok) {
        setPreviewStatus("failed");
        return;
      }

      const body = (await res.json()) as { candidates?: CompanyDiscoveryCandidate[] };
      const candidate = body.candidates?.[0] ?? null;

      if (!candidate) {
        setPreviewStatus("failed");
        return;
      }

      setDiscovery(candidate);
      setData((prev) => ({
        ...prev,
        entreprise: candidate.name || prev.entreprise,
        siteUrl: candidate.website || prev.siteUrl,
        secteur: candidate.sector || prev.secteur,
      }));
      setPreviewStatus("ready");
      track("audit_analysis_completed");

      // If an official site was found, run the deterministic page scan in the
      // background too. It enriches the email/report without delaying the
      // first useful result shown to the visitor.
      if (candidate.website) {
        fetch("/api/audit/quick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ siteUrl: candidate.website }),
        })
          .then(async (quickRes) => {
            if (!quickRes.ok) return null;
            const quickBody = (await quickRes.json()) as { report?: Report };
            return quickBody.report ?? null;
          })
          .then((report) => {
            if (!report) return;
            setQuickReport(report);
            lastReport.current = report;
          })
          .catch(() => null);
      }
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
        entreprise: data.entreprise,
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

  function toggleGoal(option: string) {
    markEngaged();

    setSelectedGoals((current) => {
      if (current.includes(option)) {
        const next = current.filter((item) => item !== option);
        if (option === "Autre") setOtherGoal("");
        return next;
      }

      if (current.length >= MAX_OBJECTIVES) return current;
      return [...current, option];
    });
  }

  function confirmGoals() {
    if (selectedGoals.length === 0) return;

    const goals = selectedGoals.map((goal) => {
      if (goal !== "Autre") return goal;
      const custom = otherGoal.trim();
      return custom.length >= 2 ? `Autre — ${custom}` : "Autre";
    });

    const value = goals.join(" · ");
    update("objectif", value);
    startRefinedAnalysis(data.secteur, value);
    setStage("contact");
    track("audit_step_4", { objectifs: goals.join(" | "), objectifs_count: goals.length });
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

      // Wait for the real refined analysis before capturing the final lead.
      // This intentional loading time is what turns the form into an actual
      // audit: the visitor's company + selected objectives are researched
      // before the PDF/email is generated.
      const report = await resolveBestReport();
      const summaryReport = report ?? lastReport.current ?? quickReport;
      const reportSummary =
        summaryReport?.aiSynthesis
          ? toEmailSummary(summaryReport)
          : discovery?.insights.length
            ? toDiscoveryEmailSummary(discovery)
            : summaryReport
              ? toEmailSummary(summaryReport)
              : undefined;

      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          ...(reportSummary ? { reportSummary } : {}),
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

      // Fire the Google Ads lead conversion immediately after the server has
      // accepted the lead. The thank-you page keeps the existing pending-event
      // fallback, while sessionStorage deduplication prevents a double count.
      trackGoogleAdsLeadConversion({
        email: data.email,
        telephone: data.telephone,
        adUserDataConsent,
      });

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
            onSubmit={startCompanyDiscovery}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35 }}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <p className="text-[11px] font-semibold tracking-[-0.01em] text-[var(--color-text)]">
                Retrouvons votre entreprise
              </p>
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] font-medium text-[var(--color-muted)]">
                Sans email pour commencer
              </span>
            </div>

            <label htmlFor={COMPANY_FIELD_ID} className="sr-only">Nom de votre entreprise</label>
            <input
              id={COMPANY_FIELD_ID}
              name="entreprise"
              type="text"
              autoCapitalize="words"
              autoCorrect="on"
              spellCheck={true}
              autoComplete="organization"
              enterKeyHint="search"
              maxLength={FIELD_LIMITS.entreprise}
              placeholder="Ex : Gonçalves Bâtiment"
              className={inputClass()}
              value={data.entreprise}
              aria-invalid={siteError ? true : undefined}
              aria-describedby={siteError ? "audit-site-error" : undefined}
              onChange={(e) => {
                update("entreprise", e.target.value);
                if (siteError) setSiteError(null);
              }}
            />

            {siteError && (
              <p id="audit-site-error" className="mt-2 px-1 text-[11px] text-[#e7c872]" role="alert">
                {siteError}
              </p>
            )}

            <button
              type="submit"
              className="audit-primary-cta mt-3 inline-flex min-h-[58px] w-full items-center justify-center rounded-[1.15rem] px-6 text-[15px] font-semibold transition-all duration-300"
            >
              Retrouver mon entreprise →
            </button>

            <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--color-muted)]">
              Pas besoin de connaître l’adresse de votre site · Premier constat sans email
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
                  <p className="font-display text-xl font-semibold">On retrouve votre entreprise et sa présence en ligne.</p>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-accent)]" />
                </div>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  On recoupe le nom, le site officiel, l’activité, la zone et les signaux publics utiles avant de vous montrer un vrai point d’amélioration.
                </p>

                <div className="mt-7 space-y-3">
                  {["Entreprise & site officiel", "Visibilité & preuves publiques", "Parcours vers le devis"].map((label, index) => (
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
                  Premier constat sur votre entreprise
                </p>

                {discovery && (
                  <div className="mt-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-display text-lg font-semibold">{discovery.name}</p>
                        <p className="mt-1 text-xs text-[var(--color-muted)]">
                          {[discovery.sector, discovery.city].filter(Boolean).join(" · ") || "Activité retrouvée en ligne"}
                        </p>
                      </div>
                      <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[10px] text-[var(--color-muted)]">
                        {discovery.confidence === "high" ? "Correspondance forte" : discovery.confidence === "medium" ? "Correspondance probable" : "À confirmer"}
                      </span>
                    </div>
                    {discovery.website && (
                      <p className="mt-3 text-xs text-[var(--color-accent)]">
                        Site retrouvé : {discovery.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                      </p>
                    )}
                    {discovery.summary && (
                      <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">{discovery.summary}</p>
                    )}
                  </div>
                )}

                {discovery?.insights[0] ? (
                  <div className="audit-result-glow mt-4 rounded-2xl border border-[var(--color-accent)]/35 bg-[var(--color-accent-soft)] p-5">
                    <span className="text-xs text-[var(--color-muted)]">D’après les éléments publics retrouvés</span>
                    <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight">
                      {discovery.insights[0].title}
                    </h2>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                      {discovery.insights[0].insight}
                    </p>
                    {discovery.insights[0].evidence.length > 0 && (
                      <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                        {discovery.insights[0].evidence.slice(0, 2).map((item, index) => (
                          <p key={index} className="mt-1 text-xs leading-relaxed text-[var(--color-text)]">• {item}</p>
                        ))}
                      </div>
                    )}
                    {discovery.insights.length > 1 && (
                      <p className="mt-4 text-[11px] font-medium text-[var(--color-accent)]">
                        + {discovery.insights.length - 1} autre{discovery.insights.length > 2 ? "s" : ""} point{discovery.insights.length > 2 ? "s" : ""} déjà identifié{discovery.insights.length > 2 ? "s" : ""}
                      </p>
                    )}
                  </div>
                ) : previewFinding ? (
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
                      Deux réponses rapides suffisent pour identifier les leviers les plus utiles à votre activité.
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    track("audit_step_2");
                    if (data.secteur.trim()) {
                      setStage("goal");
                      track("audit_step_3");
                    } else {
                      setStage("trade");
                    }
                  }}
                  className="audit-primary-cta mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-2xl px-7 text-base font-semibold transition-all duration-300"
                >
                  Continuer vers mes priorités →
                </button>
                <p className="mt-3 text-center text-[11px] text-[var(--color-muted)]">
                  {data.secteur.trim() ? "Encore 1 réponse rapide" : "Encore 2 réponses rapides"}
                </p>
              </div>
            ) : (
              <div>
                <h2 className="font-display text-2xl font-semibold">On n’a pas encore une correspondance assez sûre.</h2>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
                  Ce n’est pas bloquant : on garde le nom de votre entreprise et deux réponses rapides suffisent pour lancer une recherche plus large et préparer le diagnostic.
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
            <p className="text-[11px] font-medium text-[var(--color-muted)]">Étape 2 · encore 2 réponses</p>
            <h2 className="font-display mt-2 text-2xl font-semibold">Quel est votre métier ?</h2>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {TRADE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => chooseTrade(option)}
                  className={`audit-choice rounded-xl px-3 py-3 text-sm transition-all ${data.secteur === option ? "audit-choice--selected" : ""}`}
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
            <p className="text-[11px] font-medium text-[var(--color-muted)]">Dernière question · qualification</p>
            <h2 className="font-display mt-2 text-2xl font-semibold">Pourquoi faites-vous ce diagnostic ?</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
              Sélectionnez jusqu’à 3 objectifs. Ça nous permet d’analyser votre entreprise selon ce que vous cherchez réellement à améliorer, pas de vous envoyer un audit générique.
            </p>

            <div className="mt-4 flex items-center justify-between text-[11px] text-[var(--color-muted)]">
              <span>{selectedGoals.length} / {MAX_OBJECTIVES} sélectionné{selectedGoals.length > 1 ? "s" : ""}</span>
              <span>Maximum 3</span>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {OBJECTIVES.map((option) => {
                const selected = selectedGoals.includes(option);
                const disabled = !selected && selectedGoals.length >= MAX_OBJECTIVES;

                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => toggleGoal(option)}
                    className={`audit-choice rounded-xl px-4 py-4 text-left text-sm transition-all ${selected ? "audit-choice--selected" : ""} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span>{option}</span>
                      <span className="text-xs">{selected ? "✓" : ""}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedGoals.includes("Autre") && (
              <div className="mt-3">
                <input
                  type="text"
                  value={otherGoal}
                  onChange={(e) => setOtherGoal(e.target.value)}
                  placeholder="Précisez votre objectif"
                  className={inputClass()}
                />
              </div>
            )}

            <button
              type="button"
              disabled={selectedGoals.length === 0 || (selectedGoals.includes("Autre") && otherGoal.trim().length < 2)}
              onClick={confirmGoals}
              className="audit-primary-cta mt-5 inline-flex min-h-14 w-full items-center justify-center rounded-2xl px-7 text-base font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Analyser selon mes objectifs →
            </button>

            <p className="mt-3 text-center text-[11px] text-[var(--color-muted)]">
              Vos choix servent à personnaliser le diagnostic et à préparer un échange utile si vous souhaitez aller plus loin.
            </p>
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
              <span>01 · Le point à corriger en priorité</span>
              <span>02 · Le levier à activer en premier</span>
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
                  className="audit-secondary w-full rounded-xl px-4 py-3 text-sm transition-all"
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
