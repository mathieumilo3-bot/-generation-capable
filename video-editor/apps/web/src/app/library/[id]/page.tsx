"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STATUS_LABEL_FR } from "../labels";

interface Asset {
  id: string;
  filename: string;
  kind: "video" | "photo" | "other";
  status: "pending" | "downloading" | "ready" | "failed" | "skipped";
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  videoCodec: string | null;
  container: string | null;
  attempts: number;
  error: string | null;
  hasThumb: boolean;
  score: number | null;
  tooDark: boolean;
  highlights: { start: number; end: number }[];
}

interface Detail {
  import: {
    id: string;
    clientName: string;
    sourceTitle?: string;
    sourceUrl: string;
    providerLabel: string;
    status: string;
    mode: "probe" | "full";
    sampleSize: number;
    totalItems: number;
    totalBytes: number;
    error?: string;
    nextRetryAt?: string;
  };
  counts: { total: number; pending: number; downloading: number; ready: number; failed: number; skipped: number; videos: number; photos: number; readyBytes: number; readyVideoSec: number };
  assets: Asset[];
  projects: { id: string; title: string; status: string }[];
  storage: string;
  error?: string;
}

const PRESETS = [
  { id: "preset_premium_clean", label: "Premium — épuré" },
  { id: "preset_dynamic_social", label: "Dynamique — réseaux sociaux" },
  { id: "preset_aggressive_hype", label: "Très dynamique — hype" },
];

function fmtBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} Go`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} Mo`;
  return `${Math.round(n / 1e3)} Ko`;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}:${String(s).padStart(2, "0")}` : `${s}s`;
}

export default function ImportPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<"all" | "video" | "photo" | "failed">("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const res = await fetch(`/api/imports/${id}`, { cache: "no-store" });
      const json: Detail = await res.json();
      if (cancelled) return;
      setData(json);
      const st = json.import?.status;
      if (st === "queued" || st === "listing" || st === "importing" || json.import?.nextRetryAt) {
        timer = setTimeout(poll, 3000);
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, tick]);

  const visible = useMemo(() => {
    const assets = data?.assets ?? [];
    if (filter === "failed") return assets.filter((a) => a.status === "failed");
    if (filter === "all") return assets;
    return assets.filter((a) => a.kind === filter);
  }, [data, filter]);

  async function post(path: string, body?: unknown): Promise<{ ok: boolean; json: Record<string, unknown> }> {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) setMessage((json.error as string) ?? "Action refusée.");
      return { ok: res.ok, json };
    } finally {
      setBusy(false);
    }
  }

  async function createMontage(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const { ok, json } = await post(`/api/imports/${id}/projects`, {
      brief: form.get("brief"),
      preset: form.get("preset"),
      assetIds: selected.size > 0 ? [...selected] : undefined,
      maxRushes: Number(form.get("maxRushes")),
    });
    if (ok) router.push(`/projects/${json.projectId as string}`);
  }

  function toggle(assetId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  if (!data) {
    return (
      <main className="page">
        <h1>Chargement…</h1>
      </main>
    );
  }
  if (data.error) {
    return (
      <main className="page">
        <h1>Introuvable</h1>
        <p className="error">{data.error}</p>
      </main>
    );
  }

  const { import: imp, counts } = data;
  const running = imp.status === "queued" || imp.status === "listing" || imp.status === "importing";
  const doneCount = counts.ready + counts.failed + counts.skipped;
  const target = imp.mode === "probe" ? Math.min(imp.sampleSize, counts.total || imp.sampleSize) : counts.total;
  const pct = target > 0 ? Math.min(100, Math.round(((imp.mode === "probe" ? counts.ready + counts.failed : doneCount) / target) * 100)) : 0;
  const readyVideos = data.assets.filter((a) => a.kind === "video" && a.status === "ready").length;

  return (
    <main className="page page-wide">
      <p className="sub" style={{ marginBottom: 8 }}>
        <Link href="/library">← Bibliothèque</Link>
      </p>
      <h1>
        {imp.clientName}
        {imp.sourceTitle ? ` — ${imp.sourceTitle}` : ""}
      </h1>
      <p className="sub">
        {imp.providerLabel} · {STATUS_LABEL_FR[imp.status] ?? imp.status} · stockage : {data.storage}
      </p>

      {imp.error && !running ? <div className="error">{imp.error}</div> : null}
      {message ? <div className="error">{message}</div> : null}

      <div className="progress-block">
        <div className="progress-head">
          <span className="progress-stage">
            {imp.mode === "probe" ? `Test sur ${imp.sampleSize} fichier(s)` : "Import complet"} — {counts.ready}/{imp.mode === "probe" ? target : counts.total} prêts
          </span>
          <span className="progress-pct">{pct}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-meta">
          {counts.total} fichier(s) dans le lien · {counts.videos} vidéos · {counts.photos} photos · {fmtBytes(imp.totalBytes)} annoncés · {fmtBytes(counts.readyBytes)} dans le cloud ·{" "}
          {fmtDuration(counts.readyVideoSec)} de vidéo prête
          {counts.failed > 0 ? <span className="progress-retry"> · {counts.failed} échec(s)</span> : null}
          {imp.nextRetryAt ? <span> · reprise automatique prévue à {new Date(imp.nextRetryAt).toLocaleTimeString("fr-FR")}</span> : null}
        </div>
      </div>

      <div className="actions">
        {imp.status === "sampled" ? (
          <button className="primary" disabled={busy} onClick={async () => (await post(`/api/imports/${id}/start`)).ok && setTick((t) => t + 1)}>
            Test concluant — importer les {counts.total} fichiers
          </button>
        ) : null}
        {!running && (counts.failed > 0 || imp.status === "failed") ? (
          <button className="secondary" disabled={busy} onClick={async () => (await post(`/api/imports/${id}/retry`)).ok && setTick((t) => t + 1)}>
            Réessayer les échecs
          </button>
        ) : null}
        {running ? (
          <button className="secondary" disabled={busy} onClick={async () => (await post(`/api/imports/${id}/cancel`)).ok && setTick((t) => t + 1)}>
            Arrêter l'import
          </button>
        ) : null}
      </div>

      {readyVideos > 0 ? (
        <section className="montage-box">
          <h2 className="section-title">Créer un montage avec ces fichiers</h2>
          <p className="sub" style={{ marginBottom: 16 }}>
            {selected.size > 0
              ? `${selected.size} fichier(s) cochés seront utilisés.`
              : "Sélection automatique : meilleures vidéos (exposition, mouvement, voix), longues vidéos réduites à leurs passages utiles."}{" "}
            Tu peux créer autant de montages que tu veux : rien n'est ré-importé.
          </p>
          <form onSubmit={createMontage}>
            <div className="field">
              <textarea name="brief" required placeholder="Ex : Teaser Instagram de 30 secondes, très dynamique, sur les meilleurs moments de la soirée." />
            </div>
            <div className="field-row">
              <select name="preset" defaultValue="">
                <option value="">Style automatique</option>
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <select name="maxRushes" defaultValue="15">
                {[8, 15, 30, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} séquences max
                  </option>
                ))}
              </select>
            </div>
            <button className="primary" type="submit" disabled={busy}>
              {busy ? "Création…" : "Lancer le montage"}
            </button>
          </form>
          {data.projects.length > 0 ? (
            <ul className="project-links">
              {data.projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`}>{p.title}</Link> <span className="import-meta">— {p.status}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="filters">
        {(["all", "video", "photo", "failed"] as const).map((f) => (
          <button key={f} className={`chip${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
            {{ all: `Tout (${counts.total})`, video: `Vidéos (${counts.videos})`, photo: `Photos (${counts.photos})`, failed: `Échecs (${counts.failed})` }[f]}
          </button>
        ))}
      </div>

      <div className="asset-grid">
        {visible.map((a) => (
          <div key={a.id} className={`asset-card ${a.status}${selected.has(a.id) ? " selected" : ""}`} onClick={() => a.status === "ready" && a.kind === "video" && toggle(a.id)}>
            <div className="asset-thumb">
              {a.hasThumb ? <img src={`/api/media/${a.id}/thumb`} alt={a.filename} loading="lazy" /> : <span className="asset-placeholder">{a.status === "ready" ? a.kind : STATUS_ASSET[a.status]}</span>}
              {a.kind === "video" && a.durationSec ? <span className="asset-badge">{fmtDuration(a.durationSec)}</span> : null}
              {a.tooDark ? <span className="asset-badge warn">sombre</span> : null}
            </div>
            <div className="asset-name" title={a.filename}>
              {a.filename}
            </div>
            <div className="asset-meta">
              {a.kind === "video" ? "Vidéo" : a.kind === "photo" ? "Photo" : "Autre"}
              {a.width ? ` · ${a.width}×${a.height}` : ""}
              {a.container ? ` · ${a.container}` : ""}
              {a.videoCodec ? `/${a.videoCodec}` : ""}
              {a.sizeBytes ? ` · ${fmtBytes(a.sizeBytes)}` : ""}
              {a.score !== null ? ` · score ${Math.round(a.score * 100)}` : ""}
            </div>
            {a.status === "failed" && a.error ? <div className="asset-error">{a.error}</div> : null}
            {a.status === "ready" ? (
              <a className="asset-open" href={`/api/media/${a.id}/original`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                Ouvrir l'original
              </a>
            ) : null}
          </div>
        ))}
      </div>
    </main>
  );
}

const STATUS_ASSET: Record<Asset["status"], string> = {
  pending: "en attente",
  downloading: "import…",
  ready: "prêt",
  failed: "échec",
  skipped: "ignoré",
};
