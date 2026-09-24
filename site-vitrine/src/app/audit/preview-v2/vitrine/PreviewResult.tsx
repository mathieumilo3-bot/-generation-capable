"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PreviewSite } from "@/components/preview/PreviewSite";
import { buildCalendlyUrl } from "@/lib/booking";
import { postJson, readAttribution, trackPreview } from "@/lib/preview-engine/client";
import type { PublicStatus } from "@/lib/preview-engine/pipeline";
import type { PreviewDocument } from "@/lib/preview-engine/public-view";
import { getBusinessUi } from "@/lib/preview-engine/trades";
import { track } from "@/lib/tracking";

/**
 * The result: the preview is the star, the diagnostic is the reason why.
 * Opened from the funnel or from the e-mail link (id + signed token in the
 * URL fragment, which never reaches server logs or referrers).
 */

type Loaded =
  | { state: "loading" }
  | { state: "invalid" }
  | { state: "pending"; status: PublicStatus | null }
  | { state: "ready"; doc: PreviewDocument };

const AXIS: Record<string, string> = { trouve: "Être trouvé", choisi: "Être choisi", contacte: "Être contacté" };

function readFragment(): { id: string; token: string } | null {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const id = params.get("id") ?? "";
  const token = params.get("t") ?? "";
  return id && token ? { id, token } : null;
}

export function PreviewResult() {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | undefined>(undefined);
  const viewed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const handle = readFragment();
    if (!handle) {
      // The fragment exists only in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoaded({ state: "invalid" });
      return;
    }
    async function load() {
      for (let attempt = 0; attempt < 90 && !cancelled; attempt += 1) {
        const res = await postJson<{ status?: string; document?: PreviewDocument; preview?: PublicStatus }>("/api/preview/result", handle);
        if (cancelled) return;
        if (!res.ok) {
          setLoaded({ state: "invalid" });
          return;
        }
        if (res.data?.status === "ready" && res.data.document) {
          setLoaded({ state: "ready", doc: res.data.document });
          return;
        }
        setLoaded({ state: "pending", status: res.data?.preview ?? null });
        // Not ready yet (link opened early): keep the pipeline moving meanwhile.
        await postJson("/api/preview/advance", handle);
        await new Promise((r) => setTimeout(r, 2_500));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loaded.state !== "ready" || viewed.current) return;
    viewed.current = true;
    trackPreview("preview_viewed", {
      presence: loaded.doc.presenceLevel,
      trade: loaded.doc.tradeFamily,
      sections: loaded.doc.blueprint.sections.length,
      palette: loaded.doc.palette.source,
    });
  }, [loaded]);

  const onAction = useCallback(
    (kind: "quote" | "call", source: string) => {
      trackPreview("preview_cta_clicked", { kind, location: source });
      const phone = loaded.state === "ready" ? loaded.doc.site.phone : undefined;
      setToast(
        kind === "call" && phone
          ? `Aperçu : sur votre futur site, ce bouton appelle directement le ${phone}.`
          : `Aperçu : sur votre futur site, ce bouton déclenche l’action principale prévue pour votre activité.`
      );
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(""), 3_200);
    },
    [loaded]
  );

  const onServiceViewed = useCallback((serviceId: string) => trackPreview("preview_service_viewed", { service_id: serviceId }), []);

  if (loaded.state === "invalid") {
    return (
      <div className="mx-auto max-w-xl px-4 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Ce lien n’est plus valide.</h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">Il a peut-être expiré. Vous pouvez préparer une nouvelle proposition en quelques minutes.</p>
        <a href="/audit/preview-v2" className="audit-primary-cta mt-8 inline-flex min-h-[54px] items-center justify-center rounded-[1.15rem] px-6 text-sm font-semibold">
          Préparer ma vitrine →
        </a>
      </div>
    );
  }

  if (loaded.state !== "ready") {
    return (
      <div className="mx-auto max-w-xl px-4 text-center" aria-live="polite">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">Votre nouvelle vitrine</p>
        <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {loaded.state === "pending" ? "Presque prête." : "Ouverture de votre vitrine…"}
        </h1>
        {loaded.state === "pending" ? <p className="mt-3 text-sm text-[var(--color-muted)]">{loaded.status?.label ?? "Préparation en cours"}</p> : null}
      </div>
    );
  }

  const doc = loaded.doc;
  const ui = getBusinessUi(doc.tradeFamily);
  const attribution = readAttribution();
  const bookingUrl = buildCalendlyUrl({}, { ...attribution, content: attribution.content || "preview_v2" });
  const hasSite = doc.presenceLevel !== "C";

  return (
    <div>
      <header className="mx-auto max-w-3xl px-4 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-accent)]">Votre nouvelle vitrine</p>
        <h1 className="font-display mt-4 text-balance text-[2.2rem] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[3.4rem]">
          Voici ce que {doc.site.name} pourrait devenir en ligne.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--color-text)] sm:text-base">
          {hasSite ? "Voici comment nous ferions évoluer votre présence actuelle." : "Vous partez d’une page blanche. Voilà la base que nous construirions."}
        </p>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[var(--color-muted)]">
          Cette base n’est pas choisie au hasard : elle reprend votre activité, vos preuves publiques et l’action commerciale la plus logique pour votre modèle.
        </p>
      </header>

      <div className="mx-auto mt-10 hidden w-fit rounded-full border border-white/10 bg-white/[0.03] p-1 md:flex" role="group" aria-label="Taille de l’aperçu">
        {(["desktop", "mobile"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={device === value}
            onClick={() => setDevice(value)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${device === value ? "bg-[var(--color-text)] text-[var(--color-bg)]" : "text-[var(--color-muted)] hover:text-[var(--color-text)]"}`}
          >
            {value === "desktop" ? "Ordinateur" : "Mobile"}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-6 max-w-[1240px] px-2 sm:px-6">
        <div className="rounded-[28px] border border-white/10 bg-[#fbfaf7] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.6)]" style={{ overflow: "clip" }}>
          <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] bg-[#f1efe9] px-4 py-2.5 text-[11px] text-[#5d5a52]">
            <span className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-black/10" />
            </span>
            <span className="truncate font-medium">{doc.site.currentDomain ? `${doc.site.currentDomain} · nouvelle version` : "Aperçu de votre futur site"}</span>
            <span className="shrink-0">Aperçu privé</span>
          </div>
          <div className="mx-auto transition-[max-width] duration-300 ease-out" style={{ maxWidth: device === "mobile" ? 390 : "100%" }}>
            <PreviewSite doc={doc} onAction={onAction} onServiceViewed={onServiceViewed} />
          </div>
        </div>
      </div>

      <section className="mx-auto mt-16 max-w-5xl px-4" aria-labelledby="base-titre">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-8">
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-accent)]">Pourquoi cette base</p>
          <h2 id="base-titre" className="font-display mt-3 text-balance text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            Chaque choix sert votre parcours client.
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-[var(--color-muted)]">
            Le but n’est pas seulement d’avoir un site plus beau. La structure doit aider un prospect à comprendre, se rassurer puis agir sans chercher.
          </p>
          <div className="mt-7 grid gap-3 md:grid-cols-3">
            <article className="rounded-[1.35rem] border border-white/8 bg-black/10 p-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">01 · Comprendre</span>
              <h3 className="mt-2 text-base font-semibold">Votre offre avant le décor.</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">On organise la page autour de votre activité réelle : {doc.site.trade}.</p>
            </article>
            <article className="rounded-[1.35rem] border border-white/8 bg-black/10 p-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">02 · Rassurer</span>
              <h3 className="mt-2 text-base font-semibold">Les preuves au bon endroit.</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">Photos, avis, labels ou références ne sont affichés que lorsqu’ils existent réellement.</p>
            </article>
            <article className="rounded-[1.35rem] border border-white/8 bg-black/10 p-5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">03 · Agir</span>
              <h3 className="mt-2 text-base font-semibold">{ui.primaryCta}.</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">Le parcours finit sur l’action adaptée à votre métier, pas sur un bouton générique posé partout.</p>
            </article>
          </div>
        </div>
      </section>

      {doc.levers.length > 0 ? (
        <section className="mx-auto mt-20 max-w-3xl px-4" aria-labelledby="pourquoi-titre">
          <h2 id="pourquoi-titre" className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Pourquoi cette version ?
          </h2>
          <ol className="mt-8 divide-y divide-white/10 border-y border-white/10">
            {doc.blueprint.rationale.map((item, index) => {
              const lever = doc.levers.find((l) => l.id === item.leverId);
              return (
                <li key={item.leverId}>
                  <details className="group py-5">
                    <summary className="flex cursor-pointer list-none items-start gap-5 [&::-webkit-details-marker]:hidden">
                      <span className="font-display text-sm font-semibold tabular-nums text-[var(--color-accent)]">{String(index + 1).padStart(2, "0")}</span>
                      <span className="flex-1">
                        <span className="block text-[17px] font-semibold leading-snug">{item.title}</span>
                        <span className="mt-1 block text-sm leading-relaxed text-[var(--color-muted)]">{item.body}</span>
                      </span>
                      <span aria-hidden="true" className="mt-1 text-[var(--color-muted)] transition-transform duration-200 group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    {lever ? (
                      <div className="ml-10 mt-4 space-y-3 text-sm leading-relaxed">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">{AXIS[lever.axis]}</p>
                        <p>{lever.finding}</p>
                        <p className="text-[var(--color-muted)]">
                          <span className="font-semibold text-[var(--color-text)]">Première action : </span>
                          {lever.fix}
                        </p>
                      </div>
                    ) : null}
                  </details>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <section className="mx-auto mt-20 max-w-3xl px-4 text-center" aria-labelledby="suite-titre">
        <h2 id="suite-titre" className="font-display text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
          Vous aimez cette direction ?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
          On transforme cette proposition en vraie présence pour votre entreprise.
        </p>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="audit-primary-cta mx-auto mt-8 inline-flex min-h-16 w-full max-w-md items-center justify-center rounded-[1.15rem] px-8 text-lg font-semibold"
          data-testid="preview-booking"
          onClick={() => {
            trackPreview("preview_booking_started", { location: "preview_result" });
            track("booking_started", { location: "preview_v2", source: attribution.source || "capable_audit" });
          }}
        >
          Construire cette version avec GC →
        </a>
      </section>

      <details className="mx-auto mt-16 max-w-3xl px-4 text-sm text-[var(--color-muted)]">
        <summary className="cursor-pointer text-center text-xs underline underline-offset-4">D’où viennent ces informations ?</summary>
        <ul className="mt-5 space-y-2">
          {doc.provenance.map((item) => (
            <li key={`${item.label}-${item.value}`} className="flex flex-col gap-0.5 border-b border-white/10 pb-2 sm:flex-row sm:justify-between sm:gap-6">
              <span>
                <span className="text-[var(--color-text)]">{item.label}</span> · {item.value}
              </span>
              <span className="text-xs">{item.source}</span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-center text-xs leading-relaxed">
          Aperçu privé, non publié. Toutes les informations proviennent de votre site et de sources publiques ; rien n’a été inventé. À valider ensemble.
        </p>
      </details>

      {toast ? (
        <div className="gcp-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
