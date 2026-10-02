"use client";

import { Fragment, useEffect, useState } from "react";

interface StageInfo {
  stage: string;
  label: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  error: string | null;
}

interface QcScores {
  hook: number; story: number; rhythm: number; visual: number; captions: number;
  sound: number; broll: number; coherence: number; styleMatch: number; overall: number;
}

interface QueueInfo {
  status: string;
  progress: number;
  currentStage: string | null;
  estimatedRemainingMs: number | null;
  attempts: number;
  maxAttempts: number;
  workerId: string | null;
  profile: string;
}

interface StatusResponse {
  project: { id: string; status: "draft" | "processing" | "ready" | "failed" };
  stages: StageInfo[];
  queue: QueueInfo | null;
  result: { videoUrl: string | null; qcReport: { scores: QcScores; passed: boolean; threshold: number } | null } | null;
  error?: string;
}

function formatEta(ms: number | null): string {
  if (ms === null || ms <= 0) return "";
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min > 0) return `~${min} min ${sec.toString().padStart(2, "0")}s restantes`;
  return `~${sec}s restantes`;
}

const COMMANDS: { command: string; label: string }[] = [
  { command: "faster", label: "Plus rapide" },
  { command: "slower", label: "Plus lent" },
  { command: "shorter", label: "Plus court" },
  { command: "more_broll", label: "Plus de B-roll" },
  { command: "less_broll", label: "Moins de B-roll" },
  { command: "different_hook", label: "Autre hook" },
  { command: "more_zooms", label: "Plus de zooms" },
  { command: "less_zooms", label: "Moins de zooms" },
  { command: "change_music", label: "Changer la musique" },
  { command: "more_dynamic_captions", label: "Sous-titres plus dynamiques" },
];

export default function ProjectPage({ params }: { params: { id: string } }) {
  // Next.js 14 : `params` est un objet simple côté client, pas une Promise
  // (ça, c'est Next 15) — utiliser React.use() dessus déclenchait
  // exactement l'erreur #438 constatée en test bout-en-bout.
  const { id } = params;
  const [data, setData] = useState<StatusResponse | null>(null);
  const [cacheBust, setCacheBust] = useState(0);
  const [commandBusy, setCommandBusy] = useState<string | null>(null);
  const [commandMessage, setCommandMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      const res = await fetch(`/api/projects/${id}/status`, { cache: "no-store" });
      const json: StatusResponse = await res.json();
      if (cancelled) return;
      setData(json);
      if (json.project?.status === "processing" || json.project?.status === "draft") {
        timer = setTimeout(poll, 2000);
      }
    }
    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  async function cancelJob() {
    setCommandMessage(null);
    try {
      await fetch(`/api/projects/${id}/cancel`, { method: "POST" });
    } catch {
      /* la prochaine poll reflétera l'état */
    }
  }

  async function runCommand(command: string) {
    setCommandBusy(command);
    setCommandMessage(null);
    try {
      const res = await fetch(`/api/projects/${id}/edit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ command }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCommandMessage(json.error ?? "Commande non appliquée.");
      } else {
        setCommandMessage("Vidéo mise à jour.");
        setCacheBust((n) => n + 1);
      }
    } catch (err) {
      setCommandMessage((err as Error).message);
    } finally {
      setCommandBusy(null);
    }
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

  const isReady = data.project.status === "ready" && data.result?.videoUrl;
  const isFailed = data.project.status === "failed";

  return (
    <main className="page">
      {!isReady && !isFailed ? (
        <>
          <h1>Ton monteur travaille…</h1>
          <p className="sub">Progression réelle mesurée côté serveur — aucune barre simulée.</p>

          {data.queue ? (
            <div className="progress-block">
              <div className="progress-head">
                <span className="progress-stage">{data.queue.currentStage ?? "En file d'attente…"}</span>
                <span className="progress-pct">{Math.round(data.queue.progress)}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${Math.max(2, data.queue.progress)}%` }} />
              </div>
              <div className="progress-meta">
                {data.queue.status === "queued" ? (
                  <span>En file d'attente — un worker va prendre le projet dès qu'il est libre.</span>
                ) : (
                  <span>{formatEta(data.queue.estimatedRemainingMs)}</span>
                )}
                {data.queue.attempts > 1 ? (
                  <span className="progress-retry">Tentative {data.queue.attempts}/{data.queue.maxAttempts}</span>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="stage-list">
            {data.stages.map((s) => (
              <div key={s.stage} className={`stage-row ${s.status === "completed" ? "done" : s.status}`}>
                <span className="stage-dot" />
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          <div className="actions" style={{ marginTop: 24 }}>
            <button className="secondary" onClick={cancelJob}>Annuler le montage</button>
          </div>
        </>
      ) : null}

      {isFailed ? (
        <>
          <h1>Un problème est survenu</h1>
          <p className="error">
            {data.stages.find((s) => s.status === "failed")?.error ?? "Le pipeline s'est arrêté sur une erreur."}
          </p>
        </>
      ) : null}

      {isReady && data.result ? (
        <>
          <h1>🎬 Ta vidéo est prête</h1>
          <video key={cacheBust} src={`${data.result.videoUrl}?v=${cacheBust}`} controls playsInline />

          {data.result.qcReport ? (
            <div className="scorecard">
              {Object.entries(data.result.qcReport.scores).map(([k, v]) => (
                <Fragment key={k}>
                  <span className="k">{k}</span>
                  <span className="v">{v}/100</span>
                </Fragment>
              ))}
            </div>
          ) : null}

          <div className="actions">
            <a className="download" href={data.result.videoUrl ?? undefined} download={`${id}.mp4`}>
              Télécharger
            </a>
          </div>

          <div className="field" style={{ marginTop: 40 }}>
            <label>Modifier</label>
            <div className="commands">
              {COMMANDS.map((c) => (
                <button
                  key={c.command}
                  className="secondary"
                  disabled={commandBusy !== null}
                  onClick={() => runCommand(c.command)}
                >
                  {commandBusy === c.command ? "…" : c.label}
                </button>
              ))}
            </div>
            {commandMessage ? <p className="sub" style={{ marginTop: 12 }}>{commandMessage}</p> : null}
          </div>
        </>
      ) : null}
    </main>
  );
}
