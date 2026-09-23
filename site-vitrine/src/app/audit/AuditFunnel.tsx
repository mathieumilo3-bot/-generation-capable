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
  status?: "started" | "pending" | "done" | "failed" | "unavailable" | "needs_city";
  jobId?: string;
  token?: string;
  resolvedCity?: string;
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

type AuditLeadHandle = {
  id: string;
  token: string;
};

/**
 * The host cuts every request at 10 seconds, while a real investigation
 * runs far longer — so the server starts a background job and we poll it.
 * Waiting here, in the browser, is what buys the diagnostic its depth.
 */
const DISCOVERY_FIRST_POLL_MS = 450;
const DISCOVERY_POLL_INTERVAL_MS = 900;
const INVESTIGATION_FIRST_POLL_MS = 1_200;
const INVESTIGATION_POLL_INTERVAL_MS = 2_500;
const DISCOVERY_DEADLINE_MS = 45_000;
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
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifyStatus, setNotifyStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [canLeave, setCanLeave] = useState(false);
  const [leaveReady, setLeaveReady] = useState(false);

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
  const leadRef = useRef<AuditLeadHandle | null>(null);
  const researchRef = useRef<ResearchResponse | null>(null);

  async function attachLeadToResearch(handle: AuditLeadHandle, research: ResearchResponse) {
    if (!research.jobId || !research.token) return false;

    for (const delay of [0, 500, 1_200]) {
      if (delay) await wait(delay);
      const attached = await postJson<{ status?: string }>("/api/audit/contact", {
        action: "attach",
        id: handle.id,
        token: handle.token,
        context: research.context,
        signature: research.signature,
        jobId: research.jobId,
        jobToken: research.token,
      });
      if (attached?.status === "attached") {
        setLeaveReady(true);
        return true;
      }
    }
    return false;
  }

  async function registerNotification(event: FormEvent) {
    event.preventDefault();
    if (notifyStatus === "saving" || notifyStatus === "saved") return;

    const email = notifyEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNotifyStatus("error");
      return;
    }

    setNotifyStatus("saving");
    let measurementConsent = false;
    try {
      measurementConsent = window.localStorage.getItem("gc-revenue-consent-v1") === "accepted";
    } catch {}

    const registered = await postJson<{ status?: string; id?: string; token?: string }>("/api/audit/contact", {
      action: "register",
      companyName: discovery?.name || entreprise.trim(),
      companyCity: discovery?.city || cityHint.trim(),
      siteUrl: discovery?.website || siteHint.trim(),
      email,
      phone: "",
      marketingConsent: false,
      attribution: measurementConsent
        ? {
            ...attribution,
            gclid: clickIds.gclid || undefined,
            gbraid: clickIds.gbraid || undefined,
            wbraid: clickIds.wbraid || undefined,
          }
        : {},
    });

    if (!registered?.id || !registered.token) {
      setNotifyStatus("error");
      return;
    }

    const handle = { id: registered.id, token: registered.token };
    leadRef.current = handle;
    try {
      window.localStorage.setItem("gc-audit-return-v1", JSON.stringify(handle));
    } catch {}

    if (researchRef.current) {
      const attached = await attachLeadToResearch(handle, researchRef.current);
      if (!attached) {
        setNotifyStatus("error");
        return;
      }
    }
    setNotifyStatus("saved");
    track("audit_ready_notification_requested", { marketing_opt_in: false });
  }

  function advance(value: number, label: string) {
    progressRef.current = Math.max(progressRef.current, value);
    setProgress(progressRef.current);
    setProgressLabel(label);
  }

  async function notifyAuditStarted(candidate: CompanyDiscoveryCandidate | null, rawName: string, resolvedSiteUrl = "") {
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
          siteUrl: resolvedSiteUrl || candidate?.website || "",
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

    const resuming = needsCity || needsSite;
    setError(null);
    setRunning(true);
    if (resuming) {
      // Never send the progress bar backwards after a precision step.
      // Also stop displaying a stale candidate while the stronger lookup runs.
      setDiscovery(null);
      advance(
        Math.max(progressRef.current, 26),
        needsCity ? "Ville reçue · vérification accélérée du site officiel" : "Site reçu · vérification en cours"
      );
    } else {
      progressRef.current = 0;
      setProgress(0);
      advance(8, "Nom reçu · recherche de l’entreprise");
    }
    track("form_started");
    track("audit_step_1");
    track("audit_analysis_started");

    let candidate: CompanyDiscoveryCandidate | null = null;

    try {
      const runDiscoveryPass = async (companyName: string, city: string, rescue = false) => {
        const started = await postJson<DiscoverResponse>("/api/audit/discover", {
          companyName,
          ...(city ? { cityHint: city } : {}),
          ...(rescue ? { rescue: true } : {}),
        });

        if (started?.status === "needs_city") {
          return { candidates: started.candidates ?? [], needsCity: true };
        }

        let found: CompanyDiscoveryCandidate[] = started?.status === "done" ? (started.candidates ?? []) : [];
        if (started?.status === "started" && started.jobId && started.token) {
          const effectiveCity = started.resolvedCity || city;
          const deadline = Date.now() + DISCOVERY_DEADLINE_MS;
          let first = true;
          while (Date.now() < deadline) {
            await wait(first ? DISCOVERY_FIRST_POLL_MS : DISCOVERY_POLL_INTERVAL_MS);
            first = false;
            const poll = await postJson<DiscoverResponse>("/api/audit/discover", {
              companyName,
              ...(effectiveCity ? { cityHint: effectiveCity } : {}),
              ...(rescue ? { rescue: true } : {}),
              jobId: started.jobId,
              token: started.token,
            });
            if (!poll || poll.status === "failed") break;
            if (poll.status === "done") {
              found = poll.candidates ?? [];
              break;
            }
            advance(Math.min(26, progressRef.current + 2), "Recherche de votre entreprise · sources publiques");
          }
        }
        return { candidates: found, needsCity: false };
      };

      const pickCandidate = (items: CompanyDiscoveryCandidate[]) => {
        const websiteCandidates = items.filter((item) => item.website);
        return (
          websiteCandidates.find((item) => item.confidence === "high") ??
          websiteCandidates.find((item) => item.confidence === "medium") ??
          websiteCandidates[0] ??
          items.find((item) => item.confidence === "high") ??
          items.find((item) => item.confidence === "medium") ??
          items[0] ??
          null
        );
      };

      // Once the visitor has given the city, skip the shallow pass: go
      // straight to the identity-bridge search instead of doing two searches in series.
      const firstPass = await runDiscoveryPass(rawName, rawCity, Boolean(rawCity));
      if (firstPass.needsCity && !rawCity) {
        setDiscovery(null);
        setNeedsCity(true);
        setRunning(false);
        setProgressLabel("Plusieurs entreprises portent ce nom");
        track("audit_company_disambiguation_requested", {
          candidate_count: firstPass.candidates.length,
          website_found: false,
          source: "registre_entreprises",
        });
        return;
      }

      let candidates = firstPass.candidates;
      candidate = pickCandidate(candidates);

      // A legal name can be completely different from the commercial name
      // used on the website. Before asking the visitor for anything, run a
      // second, identity-bridge search using the city/name we just learned.
      const firstDistinctMatches = new Set(
        candidates
          .filter((item) => item === candidate || item.confidence !== "low")
          .map((item) => item.city.trim().toLowerCase() || item.website)
          .filter(Boolean)
      ).size;
      const firstPassIsAmbiguous = !rawCity && firstDistinctMatches > 1;

      if (!rawCity && !firstPassIsAmbiguous && (!candidate?.website || candidate.confidence !== "high")) {
        advance(Math.max(18, progressRef.current), "Site non certain · recherche renforcée de l’enseigne officielle");
        const rescueCity = rawCity || candidate?.city || "";
        const rescueName = candidate?.name || rawName;
        const rescuePass = await runDiscoveryPass(rescueName, rescueCity, true);
        if (rescuePass.needsCity && !rawCity) {
          setDiscovery(null);
          setNeedsCity(true);
          setRunning(false);
          setProgressLabel("Plusieurs entreprises portent ce nom");
          track("audit_company_disambiguation_requested", {
            candidate_count: rescuePass.candidates.length,
            website_found: false,
            source: "registre_entreprises",
          });
          return;
        }
        const rescued = rescuePass.candidates;

        candidates = [...rescued, ...candidates].filter(
          (item, index, all) =>
            all.findIndex(
              (other) =>
                other.name.toLowerCase() === item.name.toLowerCase() &&
                other.city.toLowerCase() === item.city.toLowerCase() &&
                other.website === item.website
            ) === index
        );
        candidate = pickCandidate(candidates);
      }

      // A second plausible company elsewhere (not a weak echo of the same
      // one) is real ambiguity: the city decides.
      const distinctMatches = new Set(
        candidates
          .filter((item) => item === candidate || item.confidence !== "low")
          .map((item) => item.city.trim().toLowerCase() || item.website)
      ).size;

      const needsDisambiguation =
        !rawCity &&
        candidates.length > 0 &&
        (!candidate || distinctMatches > 1 || (candidate.confidence === "low" && !candidate.city));

      if (needsDisambiguation) {
        setDiscovery(candidate);
        setNeedsCity(true);
        setRunning(false);
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

      void notifyAuditStarted(candidate, rawName, resolvedSiteUrl);

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

      if (research?.jobId && research.token) {
        researchRef.current = research;
        setCanLeave(true);
        if (leadRef.current) {
          void attachLeadToResearch(leadRef.current, research);
        }
      }

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
          await wait(first ? INVESTIGATION_FIRST_POLL_MS : INVESTIGATION_POLL_INTERVAL_MS);
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

      if (leadRef.current) {
        await postJson("/api/audit/contact", {
          action: "complete",
          id: leadRef.current.id,
          token: leadRef.current.token,
          report,
        });
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
            Plusieurs entreprises peuvent porter ce nom. Votre ville suffit pour sélectionner la bonne et lancer l’analyse immédiatement.
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
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-xl"
      >
        <div className="rounded-[2rem] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-6 sm:p-8">
          <div className="flex items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">
                Diagnostic GC
              </p>
              <h2 className="font-display mt-3 truncate text-2xl font-semibold tracking-tight">
                {discovery?.name || entreprise}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">
                Votre rapport est en préparation.
              </p>
            </div>
            <div className="shrink-0 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-right">
              <p className="font-display text-2xl font-semibold tracking-[-0.04em]">{progress}%</p>
              <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">≈ 2 min</p>
            </div>
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              className="h-full rounded-full bg-[var(--color-accent)]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-[var(--color-text)]">{progressLabel}</p>
            <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
              {canLeave ? "Traitement lancé" : "Préparation"}
            </span>
          </div>
        </div>

        <div className="mt-4 rounded-[1.6rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
          {notifyStatus === "saved" ? (
            leaveReady ? (
              <>
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  ✓ C’est lancé. Vous pouvez fermer cette page.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                  On vous envoie votre diagnostic par email dès qu’il est prêt.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  ✓ Email enregistré.
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                  Encore quelques secondes : on sécurise le traitement avant que vous quittiez la page.
                </p>
              </>
            )
          ) : (
            <form onSubmit={registerNotification}>
              <p className="text-sm font-semibold text-[var(--color-text)]">
                Recevez le résultat, sans attendre ici.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                Une adresse email. Rien d’autre. On vous prévient quand le diagnostic est terminé.
              </p>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <label htmlFor="audit-notify-email" className="sr-only">Votre email</label>
                <input
                  id="audit-notify-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="Votre email"
                  value={notifyEmail}
                  onChange={(event) => {
                    setNotifyEmail(event.target.value);
                    if (notifyStatus === "error") setNotifyStatus("idle");
                  }}
                  className={`${inputClass()} flex-1`}
                  required
                />
                <button
                  type="submit"
                  disabled={notifyStatus === "saving"}
                  className="audit-primary-cta inline-flex min-h-[54px] shrink-0 items-center justify-center rounded-[1.15rem] px-5 text-sm font-semibold disabled:opacity-60"
                >
                  {notifyStatus === "saving" ? "Enregistrement…" : "Me prévenir →"}
                </button>
              </div>

              {notifyStatus === "error" && (
                <p className="mt-2 text-[11px] text-[#e7c872]">Vérifiez votre email puis réessayez.</p>
              )}

              <p className="mt-3 text-[10px] leading-relaxed text-[var(--color-muted)]">
                Utilisé uniquement pour vous envoyer ce diagnostic. Pas d’inscription automatique à une newsletter.
              </p>
            </form>
          )}
        </div>
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
