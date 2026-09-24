"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  captureAttribution,
  measurementGranted,
  postJson,
  readAttribution,
  readHandle,
  saveHandle,
  trackPreview,
  vitrineUrl,
  type PreviewHandle,
} from "@/lib/preview-engine/client";
import type { PublicStatus } from "@/lib/preview-engine/pipeline";

/**
 * The V2 funnel: company name → (one precision if really needed) → a short,
 * honest wait → the new storefront. The wait is driven by the REAL pipeline
 * stage reported by the server; the bar only eases within the current stage
 * and never jumps backwards or freezes at a fake percentage.
 */

type Phase = "name" | "city" | "site" | "waiting" | "error";

const FIRST_POLL_MS = 900;
const POLL_MS = 2_200;

/** Bar range and pace of each real stage. */
const STAGE_RANGE: Record<string, [number, number, number]> = {
  identity: [2, 8, 3_000],
  discovery: [8, 24, 14_000],
  crawl: [24, 34, 5_000],
  research: [34, 80, 38_000],
  truth_bundle: [80, 84, 2_000],
  blueprint: [84, 95, 16_000],
  validate: [95, 97, 1_500],
  render: [97, 98, 1_000],
  store: [98, 99, 1_000],
  notify: [99, 100, 1_000],
};

function progressFor(status: PublicStatus | null, now: number): number {
  if (!status) return 1;
  if (status.status === "ready") return 100;
  const [lo, hi, tau] = STAGE_RANGE[status.stage] ?? [2, 98, 60_000];
  const started = status.stageStartedAt ? Date.parse(status.stageStartedAt) : now;
  const t = Math.max(0, now - started);
  return lo + (hi - lo) * (1 - Math.exp(-t / tau)) * 0.96;
}

function newKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

const inputClass =
  "audit-input w-full rounded-[1.15rem] px-5 py-[17px] text-base text-[var(--color-text)] outline-none transition-all duration-200";
const ctaClass =
  "audit-primary-cta inline-flex min-h-[58px] w-full items-center justify-center rounded-[1.15rem] px-6 text-[15px] font-semibold transition-all duration-300 disabled:cursor-wait disabled:opacity-70";

export function PreviewFunnel() {
  const [phase, setPhase] = useState<Phase>("name");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [site, setSite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [resume, setResume] = useState<PreviewHandle | null>(null);

  const handle = useRef<PreviewHandle | null>(null);
  const idemKey = useRef<string>("");
  const polling = useRef(false);
  const progressRef = useRef(0);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    captureAttribution();
    const params = new URLSearchParams(window.location.search);
    const preset = params.get("entreprise")?.trim().slice(0, 160);
    // URL and storage exist only after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (preset) setName(preset);
    const previous = readHandle();
    if (previous) setResume(previous);
  }, []);

  // Smooth, monotonic progress between real server updates.
  useEffect(() => {
    if (phase !== "waiting") return;
    const timer = window.setInterval(() => {
      const next = Math.max(progressRef.current, progressFor(status, Date.now()));
      progressRef.current = next;
      setProgress(next);
    }, 250);
    return () => window.clearInterval(timer);
  }, [phase, status]);

  const onStatus = useCallback((next: PublicStatus) => {
    setStatus((previous) => {
      if (previous?.stage !== next.stage) {
        if (next.stage === "crawl" || next.stage === "research") trackPreview("preview_identity_resolved", { stage: next.stage });
        if (next.stage === "blueprint") trackPreview("preview_blueprint_started");
      }
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    if (polling.current || !handle.current) return;
    polling.current = true;
    let first = true;
    let failures = 0;
    while (handle.current) {
      await new Promise((r) => setTimeout(r, first ? FIRST_POLL_MS : POLL_MS));
      first = false;
      const current = handle.current;
      if (!current) break;
      const res = await postJson<{ preview?: PublicStatus }>("/api/preview/advance", { id: current.id, token: current.token });
      const preview = res.data?.preview;
      if (!preview) {
        failures += 1;
        if (failures >= 6) {
          setError("La connexion a été interrompue. Votre vitrine continue d’être préparée : réessayez dans un instant.");
          setPhase("error");
          trackPreview("preview_generation_failed", { reason: `http_${res.status}` });
          break;
        }
        continue;
      }
      failures = 0;
      onStatus(preview);
      if (preview.status === "ready") {
        progressRef.current = 100;
        setProgress(100);
        trackPreview("preview_ready", { company: preview.companyName });
        window.location.assign(vitrineUrl(current.id, current.token));
        break;
      }
      if (preview.status === "needs_input") {
        setPhase(preview.needs === "site" ? "site" : "city");
        setBusy(false);
        break;
      }
      if (preview.status === "failed") {
        idemKey.current = "";
        setError("Nous n’avons pas pu préparer cette vitrine. Réessayez, ou vérifiez l’orthographe du nom.");
        setPhase("error");
        trackPreview("preview_generation_failed", { reason: "pipeline_failed" });
        break;
      }
    }
    polling.current = false;
  }, [onStatus]);

  function startWaiting(next: PreviewHandle, initial?: PublicStatus) {
    handle.current = next;
    saveHandle(next);
    if (initial) onStatus(initial);
    setPhase("waiting");
    setBusy(false);
    void poll();
  }

  async function start(event?: FormEvent, cityHint = "") {
    event?.preventDefault();
    if (busy) return;
    const companyName = name.trim();
    if (companyName.length < 2) {
      setError("Entrez le nom de votre entreprise.");
      nameInput.current?.focus();
      return;
    }
    setBusy(true);
    setError("");
    if (!idemKey.current || cityHint) idemKey.current = newKey();
    trackPreview("preview_generation_started", { with_city: Boolean(cityHint) });

    const granted = measurementGranted();
    const res = await postJson<{ status?: string; id?: string; token?: string; preview?: PublicStatus }>("/api/preview/start", {
      companyName,
      ...(cityHint ? { cityHint } : {}),
      idempotencyKey: idemKey.current,
      consent: granted ? "GRANTED" : "UNSPECIFIED",
      ...(granted ? { attribution: readAttribution() } : {}),
    });
    if (res.data?.status === "needs_city") {
      setPhase("city");
      setBusy(false);
      return;
    }
    if (!res.ok || !res.data?.id || !res.data.token) {
      setBusy(false);
      setError(res.status === 429 ? "Trop de demandes en peu de temps. Réessayez dans quelques minutes." : "Le service est momentanément indisponible. Réessayez dans un instant.");
      trackPreview("preview_generation_failed", { reason: `start_${res.status}` });
      return;
    }
    startWaiting({ id: res.data.id, token: res.data.token, companyName, startedAt: Date.now() }, res.data.preview);
  }

  async function clarify(event: FormEvent, answer: { city?: string; siteUrl?: string; noSite?: boolean }) {
    event.preventDefault();
    if (busy) return;
    if (answer.city !== undefined && answer.city.trim().length < 2) {
      setError("Entrez votre ville ou votre code postal.");
      return;
    }
    if (answer.siteUrl !== undefined && answer.siteUrl.trim().length < 4) {
      setError("Entrez l’adresse de votre site, ou indiquez que vous n’en avez pas.");
      return;
    }
    setBusy(true);
    setError("");
    // No preview yet (homonyms caught before creation): start with the city.
    if (!handle.current) return start(undefined, answer.city?.trim() ?? "");
    const current = handle.current;
    const res = await postJson<{ preview?: PublicStatus; error?: string }>("/api/preview/clarify", { id: current.id, token: current.token, ...answer });
    if (!res.ok || !res.data?.preview) {
      setBusy(false);
      setError(res.data?.error === "invalid_site" ? "Cette adresse ne semble pas valide." : "Réessayez dans un instant.");
      return;
    }
    startWaiting(current, res.data.preview);
  }

  async function registerEmail(event: FormEvent) {
    event.preventDefault();
    if (emailState === "saving" || emailState === "saved" || !handle.current) return;
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value)) {
      setEmailState("error");
      return;
    }
    setEmailState("saving");
    const granted = measurementGranted();
    const res = await postJson<{ status?: string }>("/api/preview/notify", {
      id: handle.current.id,
      token: handle.current.token,
      email: value,
      consent: granted ? "GRANTED" : "UNSPECIFIED",
      ...(granted ? { attribution: readAttribution() } : {}),
    });
    setEmailState(res.data?.status === "registered" ? "saved" : "error");
  }

  // ---------------------------------------------------------------------------

  if (phase === "waiting") {
    const pct = Math.round(progress);
    return (
      <div className="mx-auto w-full max-w-xl" aria-live="polite">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">
          {status?.companyName || name}
        </p>
        <h1 className="font-display mt-4 text-balance text-center text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
          On prépare votre nouvelle vitrine.
        </h1>
        <p className="mt-3 text-center text-sm text-[var(--color-muted)]">≈ 2 min</p>

        <div className="mt-10">
          <div className="h-[6px] overflow-hidden rounded-full bg-white/[0.07]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Préparation de la vitrine">
            <div className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300 ease-out" style={{ width: `${Math.max(2, progress)}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-4 text-sm">
            <span className="text-[var(--color-text)]">{status?.label ?? "Identification de votre entreprise"}</span>
            <span className="tabular-nums text-[var(--color-muted)]">{pct} %</span>
          </div>
        </div>

        <div className="mt-10 rounded-[1.6rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
          {emailState === "saved" ? (
            <>
              <p className="text-sm font-semibold">C’est noté. Vous pouvez fermer cette page.</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">Votre vitrine vous sera envoyée par e-mail dès qu’elle est prête.</p>
            </>
          ) : (
            <form onSubmit={registerEmail} noValidate>
              <p className="text-sm font-semibold">Pas besoin d’attendre ici.</p>
              <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">Laissez votre e-mail : on vous l’envoie dès qu’elle est prête.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <label htmlFor="preview-email" className="sr-only">
                  Votre e-mail
                </label>
                <input
                  id="preview-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="Votre e-mail"
                  className={`${inputClass} flex-1`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailState === "error") setEmailState("idle");
                  }}
                />
                <button type="submit" disabled={emailState === "saving"} className="audit-primary-cta inline-flex min-h-[54px] shrink-0 items-center justify-center rounded-[1.15rem] px-5 text-sm font-semibold disabled:opacity-60">
                  {emailState === "saving" ? "Enregistrement…" : "Me l’envoyer"}
                </button>
              </div>
              {emailState === "error" ? (
                <p className="mt-2 text-[12px] text-[#e7c872]" role="alert">
                  Vérifiez l’adresse e-mail, puis réessayez.
                </p>
              ) : null}
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-muted)]">Utilisé uniquement pour vous envoyer cette proposition. Aucune inscription à une newsletter.</p>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (phase === "city") {
    return (
      <form onSubmit={(e) => clarify(e, { city })} className="mx-auto w-full max-w-xl" noValidate>
        <h1 className="font-display text-balance text-center text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
          Dans quelle ville est votre entreprise ?
        </h1>
        <p className="mt-4 text-center text-sm text-[var(--color-muted)]">Plusieurs entreprises portent ce nom.</p>
        <label htmlFor="preview-city" className="sr-only">
          Ville ou code postal
        </label>
        <input
          id="preview-city"
          autoFocus
          autoComplete="address-level2"
          enterKeyHint="go"
          maxLength={120}
          placeholder="Ex : Vannes ou 56000"
          className={`${inputClass} mt-8`}
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setError("");
          }}
        />
        {error ? (
          <p className="mt-2 px-1 text-[12px] text-[#e7c872]" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className={`${ctaClass} mt-3`}>
          {busy ? "Un instant…" : "Continuer →"}
        </button>
      </form>
    );
  }

  if (phase === "site") {
    return (
      <form onSubmit={(e) => clarify(e, { siteUrl: site })} className="mx-auto w-full max-w-xl" noValidate>
        <h1 className="font-display text-balance text-center text-[2.1rem] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-5xl">
          Quelle est l’adresse de votre site ?
        </h1>
        <p className="mt-4 text-center text-sm text-[var(--color-muted)]">Nous préférons vous demander plutôt que de nous tromper d’entreprise.</p>
        <label htmlFor="preview-site" className="sr-only">
          Adresse de votre site
        </label>
        <input
          id="preview-site"
          autoFocus
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={300}
          placeholder="Ex : votre-entreprise.fr"
          className={`${inputClass} mt-8`}
          value={site}
          onChange={(e) => {
            setSite(e.target.value);
            setError("");
          }}
        />
        {error ? (
          <p className="mt-2 px-1 text-[12px] text-[#e7c872]" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className={`${ctaClass} mt-3`}>
          {busy ? "Un instant…" : "Continuer →"}
        </button>
        <button
          type="button"
          disabled={busy}
          className="mt-4 w-full text-center text-[13px] text-[var(--color-muted)] underline underline-offset-4 hover:text-[var(--color-text)]"
          onClick={(e) => clarify(e as unknown as FormEvent, { noSite: true })}
        >
          Je n’ai pas encore de site
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => start(e)} className="mx-auto w-full max-w-xl" noValidate>
      <h1 className="font-display text-balance text-center text-[2.3rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[3.4rem]">
        Entrez le nom de votre entreprise
      </h1>
      <label htmlFor="preview-company" className="sr-only">
        Nom de votre entreprise
      </label>
      <input
        ref={nameInput}
        id="preview-company"
        name="entreprise"
        autoComplete="organization"
        autoCapitalize="words"
        enterKeyHint="go"
        maxLength={160}
        placeholder="Ex : Gonçalves Bâtiment"
        className={`${inputClass} mt-10`}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError("");
          idemKey.current = "";
        }}
      />
      {error ? (
        <p className="mt-2 px-1 text-[12px] text-[#e7c872]" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className={`${ctaClass} mt-3`}>
        {busy ? "Un instant…" : "Voir ce qu’on construirait pour mon entreprise →"}
      </button>
      {phase === "error" ? null : resume ? (
        <p className="mt-6 text-center text-[12px] text-[var(--color-muted)]">
          <button type="button" className="underline underline-offset-4 hover:text-[var(--color-text)]" onClick={() => startWaiting(resume)}>
            Reprendre la vitrine de {resume.companyName}
          </button>
        </p>
      ) : null}
    </form>
  );
}
