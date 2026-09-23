"use client";

import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { FIELD_LIMITS } from "@/lib/audit-submission";
import { track } from "@/lib/tracking";
import type { Report } from "@/lib/audit-engine/types";
import type { BookingAttribution } from "@/lib/booking";

type CompanyDiscoveryCandidate = {
  name: string;
  website: string;
  sector: string;
  city: string;
  summary: string;
  confidence: "high" | "medium" | "low";
  insights: { title: string; insight: string; evidence: string[] }[];
};

const COMPANY_FIELD_ID = "audit-company-name";
const CITY_FIELD_ID = "audit-company-city";
const FIXED_OBJECTIVE =
  "Augmenter la visibilité qualifiée et la transformer en davantage de demandes de devis et de prospects qualifiés.";

function inputClass() {
  return "audit-input w-full rounded-[1.15rem] px-5 py-[17px] text-base text-[var(--color-text)] outline-none transition-all duration-200";
}

export function AuditFunnel() {
  const [entreprise, setEntreprise] = useState("");
  const [cityHint, setCityHint] = useState("");
  const [needsCity, setNeedsCity] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Prêt à démarrer");
  const [error, setError] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<CompanyDiscoveryCandidate | null>(null);
  const [attribution, setAttribution] = useState<BookingAttribution>({});
  const [clickIds, setClickIds] = useState({ gclid: "", gbraid: "", wbraid: "" });

  useEffect(() => {
    track("audit_started");
    const params = new URLSearchParams(window.location.search);

    // URL-derived attribution is only available after hydration.
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

    const preset = params.get("entreprise")?.trim().slice(0, FIELD_LIMITS.entreprise) || "";
    if (preset) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEntreprise(preset);
    }
  }, []);

  function advance(value: number, label: string) {
    setProgress((current) => Math.max(current, value));
    setProgressLabel(label);
  }

  async function notifyAuditStarted(candidate: CompanyDiscoveryCandidate | null, rawName: string) {
    let consent = "UNSPECIFIED";
    try {
      consent = window.localStorage.getItem("gc-revenue-consent-v1") === "accepted" ? "GRANTED" : "UNSPECIFIED";
    } catch {}

    try {
      await fetch("/api/audit/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          entreprise: candidate?.name || rawName,
          siteUrl: candidate?.website || "",
          secteur: candidate?.sector || "",
          ville: candidate?.city || "",
          purpose: "REQUESTED_AUDIT",
          consent,
          ...(consent === "GRANTED"
            ? {
                utmSource: attribution.source,
                utmMedium: attribution.medium,
                utmCampaign: attribution.campaign,
                utmContent: attribution.content,
                utmTerm: attribution.term,
                gclid: clickIds.gclid,
                gbraid: clickIds.gbraid,
                wbraid: clickIds.wbraid,
              }
            : {}),
        }),
      });
    } catch {
      // Non-blocking: the visitor still gets the audit.
    }
  }

  async function runAudit(event?: FormEvent) {
    event?.preventDefault();
    if (running) return;

    const rawName = entreprise.trim();
    const rawCity = cityHint.trim();
    if (rawName.length < 2) {
      setError("Entrez simplement le nom de votre entreprise.");
      document.getElementById(COMPANY_FIELD_ID)?.focus();
      return;
    }

    if (needsCity && rawCity.length < 2) {
      setError("Entrez votre ville ou votre code postal.");
      document.getElementById(CITY_FIELD_ID)?.focus();
      return;
    }

    setError(null);
    setRunning(true);
    advance(8, "Nom reçu · recherche de l’entreprise");
    track("form_started");
    track("audit_step_1");
    track("audit_analysis_started");

    let candidate: CompanyDiscoveryCandidate | null = null;

    try {
      const discoverRes = await fetch("/api/audit/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: rawName,
          ...(rawCity ? { cityHint: rawCity } : {}),
        }),
      });

      if (discoverRes.ok) {
        const body = (await discoverRes.json()) as { candidates?: CompanyDiscoveryCandidate[] };
        const candidates = body.candidates ?? [];
        const websiteCandidates = candidates.filter((item) => item.website);
        candidate =
          websiteCandidates.find((item) => item.confidence === "high") ??
          websiteCandidates.find((item) => item.confidence === "medium") ??
          websiteCandidates[0] ??
          candidates.find((item) => item.confidence === "high") ??
          candidates.find((item) => item.confidence === "medium") ??
          candidates[0] ??
          null;

        const distinctMatches = new Set(
          candidates.map((item) => `${item.name.toLowerCase()}|${item.city.toLowerCase()}`)
        ).size;

        const needsDisambiguation =
          !rawCity &&
          (
            !candidate ||
            !candidate.website ||
            candidate.confidence !== "high" ||
            distinctMatches > 1
          );

        if (needsDisambiguation) {
          setDiscovery(candidate);
          setNeedsCity(true);
          setRunning(false);
          setProgress(0);
          setProgressLabel("Prêt à reprendre");
          track("audit_company_disambiguation_requested", {
            candidate_count: candidates.length,
            website_found: Boolean(candidate?.website),
          });
          return;
        }
      }

      if (candidate) {
        setNeedsCity(false);
        setDiscovery(candidate);
        advance(36, "Entreprise identifiée · activité et zone recoupées");
        track("audit_analysis_completed");
      } else {
        advance(24, "Nom reçu · recherche élargie en cours");
      }

      void notifyAuditStarted(candidate, rawName);

      const resolvedName = candidate?.name || rawName;
      const resolvedSite = candidate?.website || "";
      const resolvedSector = candidate?.sector || "";

      const quickPromise = resolvedSite
        ? fetch("/api/audit/quick", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ siteUrl: resolvedSite }),
          })
            .then(async (res) => {
              if (!res.ok) return null;
              const body = (await res.json()) as { report?: Report };
              if (body.report) advance(52, "Site et parcours vers le devis analysés");
              return body.report ?? null;
            })
            .catch(() => null)
        : Promise.resolve(null);

      const analyzePromise = fetch("/api/audit/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entreprise: resolvedName,
          siteUrl: resolvedSite,
          secteur: resolvedSector,
          objectif: FIXED_OBJECTIVE,
        }),
      })
        .then(async (res) => {
          if (!res.ok) return null;
          const body = (await res.json()) as { report?: Report };
          return body.report ?? null;
        })
        .catch(() => null);

      const [quickReport, fullReport] = await Promise.all([quickPromise, analyzePromise]);
      const report = fullReport ?? quickReport;

      if (!report) {
        setError("L’analyse n’a pas pu être finalisée. Relancez le diagnostic dans quelques instants.");
        setRunning(false);
        return;
      }

      advance(88, "Recherche web terminée · 3 priorités commerciales sélectionnées");

      try {
        sessionStorage.setItem(
          "gc_audit_result",
          JSON.stringify({
            report,
            entreprise: resolvedName,
            discovery: candidate,
            attribution,
          })
        );
      } catch {}

      advance(100, "Diagnostic terminé");
      track("audit_completed");
      track("form_completed");
      track("audit_report_viewed", {
        source: attribution.source || "capable_audit",
        sector: resolvedSector || "unknown",
      });

      window.location.assign("/audit/merci");
    } catch {
      setError("L’analyse a rencontré un problème. Réessayez dans quelques instants.");
      setRunning(false);
    }
  }

  if (needsCity && !running) {
    return (
      <form onSubmit={runAudit} className="mx-auto max-w-xl">
        <div className="rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
            Une dernière précision
          </p>
          <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight">
            Dans quelle ville est {discovery?.name || entreprise} ?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
            On l’utilise uniquement pour verrouiller la bonne entreprise et retrouver son site officiel.
          </p>

          <label htmlFor={CITY_FIELD_ID} className="sr-only">Ville ou code postal</label>
          <input
            id={CITY_FIELD_ID}
            name="city"
            type="text"
            autoCapitalize="words"
            autoCorrect="on"
            spellCheck
            autoComplete="address-level2"
            enterKeyHint="go"
            maxLength={120}
            placeholder="Ex : Pontivy ou 56300"
            className={`${inputClass()} mt-5`}
            value={cityHint}
            onChange={(event) => {
              setCityHint(event.target.value);
              if (error) setError(null);
            }}
          />

          {error && <p className="mt-2 px-1 text-[11px] text-[#e7c872]" role="alert">{error}</p>}

          <button
            type="submit"
            className="audit-primary-cta mt-3 inline-flex min-h-[58px] w-full items-center justify-center rounded-[1.15rem] px-6 text-[15px] font-semibold transition-all duration-300"
          >
            Continuer l’analyse →
          </button>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--color-muted)]">
            Pas besoin de retrouver votre URL.
          </p>
        </div>
      </form>
    );
  }

  if (running) {
    const steps = [
      { at: 8, label: "Nom reçu" },
      { at: 36, label: "Entreprise, activité et zone recoupées" },
      { at: 52, label: "Site et parcours vers le devis analysés" },
      { at: 88, label: "Visibilité web et priorités commerciales consolidées" },
      { at: 100, label: "Diagnostic prêt" },
    ];
    const next = steps.find((item) => item.at > progress)?.at;

    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-xl rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 sm:p-8"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
              Diagnostic GC · en direct
            </p>
            <h2 className="font-display mt-3 text-2xl font-semibold">
              On analyse {discovery?.name || entreprise}.
            </h2>
          </div>
          <span className="font-display text-4xl font-semibold tracking-[-0.05em]">{progress}%</span>
        </div>

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full bg-[var(--color-accent)]"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <p className="mt-3 text-sm font-medium text-[var(--color-text)]">{progressLabel}</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Le pourcentage avance uniquement quand une étape réelle est terminée.
        </p>

        <div className="mt-6 space-y-2">
          {steps.map((item) => {
            const done = progress >= item.at;
            const active = !done && item.at === next;
            return (
              <div
                key={item.at}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
                  done
                    ? "border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]"
                    : active
                      ? "border-[var(--color-border-strong)] bg-[var(--color-bg)]"
                      : "border-[var(--color-border)] opacity-45"
                }`}
              >
                <span className="text-sm">{item.label}</span>
                <span className="text-xs font-semibold text-[var(--color-accent)]">
                  {done ? "OK" : active ? "EN COURS" : ""}
                </span>
              </div>
            );
          })}
        </div>

        <p className="mt-5 text-center text-[11px] text-[var(--color-muted)]">
          Aucun questionnaire derrière · le diagnostic s’affiche automatiquement.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={runAudit} className="mx-auto max-w-xl">
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-[11px] font-semibold text-[var(--color-text)]">Votre entreprise suffit.</p>
        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-[10px] font-medium text-[var(--color-muted)]">
          1 seule information
        </span>
      </div>

      <label htmlFor={COMPANY_FIELD_ID} className="sr-only">Nom de votre entreprise</label>
      <input
        id={COMPANY_FIELD_ID}
        name="entreprise"
        type="text"
        autoCapitalize="words"
        autoCorrect="on"
        spellCheck
        autoComplete="organization"
        enterKeyHint="go"
        maxLength={FIELD_LIMITS.entreprise}
        placeholder="Ex : Gonçalves Bâtiment"
        className={inputClass()}
        value={entreprise}
        onChange={(event) => {
          setEntreprise(event.target.value);
          setCityHint("");
          setNeedsCity(false);
          setDiscovery(null);
          if (error) setError(null);
        }}
      />

      {error && <p className="mt-2 px-1 text-[11px] text-[#e7c872]" role="alert">{error}</p>}

      <button
        type="submit"
        className="audit-primary-cta mt-3 inline-flex min-h-[58px] w-full items-center justify-center rounded-[1.15rem] px-6 text-[15px] font-semibold transition-all duration-300"
      >
        Analyser mon entreprise →
      </button>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-[var(--color-muted)]">
        On retrouve nous-mêmes votre site, votre activité, votre visibilité et les points qui freinent vos demandes.
      </p>
    </form>
  );
}
