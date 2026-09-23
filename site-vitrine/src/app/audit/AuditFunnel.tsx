"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { FIELD_LIMITS } from "@/lib/audit-submission";
import { track } from "@/lib/tracking";
import type { Report } from "@/lib/audit-engine/types";
import type { BookingAttribution } from "@/lib/booking";

type ResearchResponse = {
  context: unknown;
  signature: string;
  jobId?: string;
  token?: string;
  stats: { pagesAnalyzed: number; siteReachable: boolean; evidenceCards: number; investigating: boolean };
};

type DiscoverResponse = {
  status?: "started" | "pending" | "done" | "failed" | "unavailable";
  jobId?: string;
  token?: string;
  candidates?: CompanyDiscoveryCandidate[];
};

type CompanyDiscoveryCandidate = {
  name: string;
  website: string;
  sector: string;
  city: string;
  summary: string;
  confidence: "high" | "medium" | "low";
};

/**
 * The host cuts every request at 10 seconds, while a real investigation
 * runs far longer — so the server starts a background job and we poll it.
 * Waiting here, in the browser, is what buys the diagnostic its depth.
 */
const FIRST_POLL_MS = 1_200;
const POLL_INTERVAL_MS = 2_500;
const DISCOVERY_DEADLINE_MS = 75_000;
const INVESTIGATION_DEADLINE_MS = 120_000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson<T>(url: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const COMPANY_FIELD_ID = "audit-company-name";
const CITY_FIELD_ID = "audit-company-city";
const SITE_FIELD_ID = "audit-company-site";
const FIXED_OBJECTIVE =
  "Augmenter la visibilité qualifiée et la transformer en davantage de demandes de devis et de prospects qualifiés.";

function inputClass() {
  return "audit-input w-full rounded-[1.15rem] px-5 py-[17px] text-base text-[var(--color-text)] outline-none transition-all duration-200";
}

export function AuditFunnel() {
  const [entreprise, setEntreprise] = useState("");
  const [cityHint, setCityHint] = useState("");
  const [needsCity, setNeedsCity] = useState(false);
  const [siteHint, setSiteHint] = useState("");
  const [needsSite, setNeedsSite] = useState(false);
  const [skipSite, setSkipSite] = useState(false);
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

  const progressRef = useRef(0);

  function advance(value: number, label: string) {
    progressRef.current = Math.max(progressRef.current, value);
    setProgress(progressRef.current);
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

  // `skipSite` is passed explicitly rather than read from state: the button
  // that sets it starts the run in the same tick, before React re-renders.
  async function runAudit(event?: FormEvent, override: { skipSite?: boolean } = {}) {
    event?.preventDefault();
    if (running) return;
    const skippingSite = override.skipSite ?? skipSite;

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

    if (needsSite && !skippingSite && siteHint.trim().length < 4) {
      setError("Entrez l’adresse de votre site, ou indiquez que vous n’en avez pas.");
      document.getElementById(SITE_FIELD_ID)?.focus();
      return;
    }

    setError(null);
    setRunning(true);
    progressRef.current = 0;
    setProgress(0);
    advance(8, "Nom reçu · recherche de l’entreprise");
    track("form_started");
    track("audit_step_1");
    track("audit_analysis_started");

    let candidate: CompanyDiscoveryCandidate | null = null;

    try {
      const started = await postJson<DiscoverResponse>("/api/audit/discover", {
        companyName: rawName,
        ...(rawCity ? { cityHint: rawCity } : {}),
      });

      let candidates: CompanyDiscoveryCandidate[] = started?.status === "done" ? (started.candidates ?? []) : [];
      if (started?.status === "started" && started.jobId && started.token) {
        const deadline = Date.now() + DISCOVERY_DEADLINE_MS;
        let first = true;
        while (Date.now() < deadline) {
          await wait(first ? FIRST_POLL_MS : POLL_INTERVAL_MS);
          first = false;
          const poll = await postJson<DiscoverResponse>("/api/audit/discover", {
            companyName: rawName,
            ...(rawCity ? { cityHint: rawCity } : {}),
            jobId: started.jobId,
            token: started.token,
          });
          if (!poll || poll.status === "failed") break;
          if (poll.status === "done") {
            candidates = poll.candidates ?? [];
            break;
          }
          advance(Math.min(26, progressRef.current + 2), "Recherche de votre entreprise · sources publiques");
        }
      }

      const websiteCandidates = candidates.filter((item) => item.website);
      candidate =
        websiteCandidates.find((item) => item.confidence === "high") ??
        websiteCandidates.find((item) => item.confidence === "medium") ??
        websiteCandidates[0] ??
        candidates.find((item) => item.confidence === "high") ??
        candidates.find((item) => item.confidence === "medium") ??
        candidates[0] ??
        null;

      // A second plausible company elsewhere (not a weak echo of the same
      // one) is real ambiguity: the city decides.
      const distinctMatches = new Set(
        candidates
          .filter((item) => item === candidate || item.confidence !== "low")
          .map((item) => item.city.trim().toLowerCase() || item.website)
      ).size;

      const needsDisambiguation =
        !rawCity && candidates.length > 0 && (!candidate || !candidate.website || candidate.confidence !== "high" || distinctMatches > 1);

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

      // Identification can fail for a real reason — an unlisted company, or
      // the search itself being unavailable. Rather than ending on an empty
      // diagnostic, ask once for the address we could not find.
      const resolvedSiteUrl = candidate?.website || siteHint.trim();
      if (!resolvedSiteUrl && !skippingSite) {
        setDiscovery(candidate);
        setNeedsSite(true);
        setRunning(false);
        setProgress(0);
        setProgressLabel("Prêt à reprendre");
        track("audit_site_requested", { had_candidate: Boolean(candidate) });
        return;
      }

      if (candidate) {
        setNeedsCity(false);
        setDiscovery(candidate);
        advance(
          30,
          candidate.website
            ? `${candidate.name} identifiée · site officiel vérifié`
            : `${candidate.name} identifiée · pas de site officiel retrouvé`
        );
        track("audit_analysis_completed");
      } else {
        advance(24, "Nom reçu · recherche élargie en cours");
      }

      void notifyAuditStarted(candidate, rawName);

      const resolvedName = candidate?.name || rawName;
      const resolvedSite = resolvedSiteUrl;
      const resolvedSector = candidate?.sector || "";
      const resolvedCity = candidate?.city || rawCity;
      const companyInput = {
        entreprise: resolvedName,
        siteUrl: resolvedSite,
        secteur: resolvedSector,
        ville: resolvedCity,
      };

      // Stage 1 — read the site page by page, then hand it to the
      // background investigation.
      setProgressLabel(
        resolvedSite
          ? "Lecture de votre site page par page"
          : "Recherche de vos traces publiques · annuaires, réseaux, avis"
      );
      const research = await postJson<ResearchResponse>("/api/audit/research", companyInput);

      if (research) {
        const pages = research.stats.pagesAnalyzed;
        advance(
          52,
          pages > 1
            ? `${pages} pages de votre site analysées`
            : research.stats.siteReachable
              ? "Page d’accueil analysée"
              : "Site officiel non lisible · recherche publique en cours"
        );
      } else {
        advance(40, "Recherche élargie en cours");
      }

      // Stage 2 — the investigation runs on the model side; we poll it.
      let report: Report | null = null;
      if (research?.jobId && research.token) {
        setProgressLabel("Recherches Google, annuaires et avis · comparaison avec votre site");
        const deadline = Date.now() + INVESTIGATION_DEADLINE_MS;
        let first = true;
        while (Date.now() < deadline && !report) {
          await wait(first ? FIRST_POLL_MS : POLL_INTERVAL_MS);
          first = false;
          const poll = await postJson<{ status?: string; report?: Report }>("/api/audit/analyze", {
            context: research.context,
            signature: research.signature,
            jobId: research.jobId,
            token: research.token,
            objectif: FIXED_OBJECTIVE,
          });
          if (poll?.status === "done" && poll.report) {
            report = poll.report;
            break;
          }
          if (!poll) break;
          advance(Math.min(92, progressRef.current + 2), "Recoupement des sources et sélection des priorités");
        }
      }

      // Whatever happened above, the visitor still gets what the site itself
      // proved — never a blank page, never an invented diagnostic.
      if (!report) {
        setProgressLabel("Finalisation du diagnostic");
        const fallback = research
          ? await postJson<{ report?: Report }>("/api/audit/analyze", {
              context: research.context,
              signature: research.signature,
              objectif: FIXED_OBJECTIVE,
            })
          : await postJson<{ report?: Report }>("/api/audit/analyze", { ...companyInput, objectif: FIXED_OBJECTIVE });
        report = fallback?.report ?? null;
      }

      if (!report) {
        setError("L’analyse n’a pas pu être finalisée. Relancez le diagnostic dans quelques instants.");
        setRunning(false);
        return;
      }

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

  if (needsSite && !running) {
    return (
      <form onSubmit={runAudit} className="mx-auto max-w-xl">
        <div className="rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
            On a besoin d’un coup de main
          </p>
          <h2 className="font-display mt-3 text-2xl font-semibold tracking-tight">
            Quelle est l’adresse de votre site ?
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
            Nous n’avons pas réussi à retrouver le site officiel de {discovery?.name || entreprise} de façon certaine. Plutôt
            que d’analyser la mauvaise entreprise, on préfère vous demander.
          </p>

          <label htmlFor={SITE_FIELD_ID} className="sr-only">Adresse de votre site</label>
          <input
            id={SITE_FIELD_ID}
            name="site"
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="url"
            enterKeyHint="go"
            maxLength={300}
            placeholder="Ex : votre-entreprise.fr"
            className={`${inputClass()} mt-5`}
            value={siteHint}
            onChange={(event) => {
              setSiteHint(event.target.value);
              if (error) setError(null);
            }}
          />

          {error && <p className="mt-2 px-1 text-[11px] text-[#e7c872]" role="alert">{error}</p>}

          <button
            type="submit"
            className="audit-primary-cta mt-3 inline-flex min-h-[58px] w-full items-center justify-center rounded-[1.15rem] px-6 text-[15px] font-semibold transition-all duration-300"
          >
            Analyser mon site →
          </button>

          <button
            type="button"
            className="mt-3 w-full text-center text-[12px] text-[var(--color-muted)] underline underline-offset-4"
            onClick={() => {
              setSkipSite(true);
              setNeedsSite(false);
              setError(null);
              void runAudit(undefined, { skipSite: true });
            }}
          >
            Je n’ai pas encore de site
          </button>
        </div>
      </form>
    );
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
      { at: 30, label: "Entreprise identifiée · site officiel vérifié" },
      { at: 52, label: "Site lu page par page" },
      { at: 92, label: "Recherches Google, annuaires et avis recoupées" },
      { at: 100, label: "3 constats rédigés et vérifiés" },
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
          setSiteHint("");
          setNeedsSite(false);
          setSkipSite(false);
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
