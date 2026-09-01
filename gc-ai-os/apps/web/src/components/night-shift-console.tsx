"use client";

import { useEffect, useMemo, useState } from "react";

const PROJECTS = ["JARVIS", "AI video editor", "Commercial Radar", "Mourad"];
const DEFAULT_PROMPT = `Operate as JARVIS autonomous night-shift pilot. Work continuously until the deadline or until every achievable objective is verified. CODED ≠ DONE; VERIFIED = DONE. Inspect real repository state before acting. Plan work, execute with available agents/tools, run tests and builds, inspect failures, repair them, retry within bounded limits, and never claim success without executable evidence. Prioritize JARVIS, the AI video editor, Commercial Radar and Mourad. Keep changes clean, reversible and documented. Never disable tests, invent evidence, silently swallow failures, or loop forever. Critical destructive, financial, credential, irreversible production or human-approval actions must be blocked and recorded for owner review. Non-critical failures should self-heal and continue with the next safe mission. Preserve durable checkpoints so a process restart resumes rather than duplicates work.`;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function defaultDeadline(): string {
  const now = new Date();
  const deadline = new Date(now);
  deadline.setDate(now.getDate() + (now.getHours() >= 9 ? 1 : 0));
  deadline.setHours(9, 0, 0, 0);
  // datetime-local expects local wall-clock fields, not an ISO/UTC string.
  return `${deadline.getFullYear()}-${pad(deadline.getMonth() + 1)}-${pad(deadline.getDate())}T${pad(deadline.getHours())}:${pad(deadline.getMinutes())}`;
}

type Snapshot = {
  run: null | {
    id: string;
    status: string;
    deadline: string;
    lastError: string | null;
    objectiveId: string | null;
  };
  objective: null | { status: string; title: string };
  missions: Array<{ id: string; title: string; status: string; attempt: number; maxAttempts: number }>;
};

export function NightShiftConsole() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [projects, setProjects] = useState(PROJECTS);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const response = await fetch("/api/night-shift", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible de lire l’état Night Shift.");
      setSnapshot(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de lire l’état Night Shift.");
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const running = snapshot?.run?.status === "queued" || snapshot?.run?.status === "running";
  const completed = useMemo(
    () => snapshot?.missions.filter((mission) => mission.status === "completed").length ?? 0,
    [snapshot],
  );

  const toggle = (project: string) => {
    setProjects((current) =>
      current.includes(project) ? current.filter((item) => item !== project) : [...current, project],
    );
  };

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/night-shift", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, deadline: new Date(deadline).toISOString(), projects }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Le démarrage a échoué.");
      setSnapshot(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le démarrage a échoué.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="night-shift">
      <section className="night-hero">
        <div>
          <div className="eyebrow">JARVIS / AUTONOMOUS NIGHT SHIFT</div>
          <h1>Tu dors. JARVIS travaille.</h1>
          <p>Mission durable, vérifiée, et reprise après redémarrage du runtime.</p>
        </div>
        <div className={`night-status ${running ? "is-running" : ""}`}>
          <span className="night-status-dot" />
          {running ? "EN EXÉCUTION" : snapshot?.run?.status?.toUpperCase() ?? "PRÊT"}
        </div>
      </section>

      <section className="night-grid">
        <div className="night-card night-main-card">
          <label className="night-label" htmlFor="night-prompt">
            Mission maître
          </label>
          <textarea id="night-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={running || starting} />

          <div className="night-row">
            <div>
              <label className="night-label" htmlFor="night-deadline">
                Deadline
              </label>
              <input id="night-deadline" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} disabled={running || starting} />
            </div>
            <div className="night-projects">
              <span className="night-label">Projets</span>
              <div className="night-project-list">
                {PROJECTS.map((project) => (
                  <button
                    key={project}
                    type="button"
                    className={`night-project ${projects.includes(project) ? "selected" : ""}`}
                    onClick={() => toggle(project)}
                    disabled={running || starting}
                  >
                    {projects.includes(project) ? "✓" : "＋"} {project}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button className="night-start" type="button" onClick={start} disabled={running || starting || projects.length === 0}>
            {starting ? "INITIALISATION…" : running ? "NIGHT SHIFT EN COURS" : "LANCER LE NIGHT SHIFT"}
          </button>
          {error && <p className="night-error">{error}</p>}
        </div>

        <aside className="night-card night-proof-card">
          <div className="night-label">État vérifiable</div>
          <div className="night-metric">
            <strong>{completed}</strong>
            <span>missions terminées</span>
          </div>
          <div className="night-divider" />
          <div className="night-meta">
            <span>Run</span>
            <strong>{snapshot?.run?.id?.slice(0, 8) ?? "—"}</strong>
          </div>
          <div className="night-meta">
            <span>Objectif</span>
            <strong>{snapshot?.objective?.status ?? "—"}</strong>
          </div>
          <div className="night-meta">
            <span>Deadline</span>
            <strong>{snapshot?.run ? new Date(snapshot.run.deadline).toLocaleString() : "—"}</strong>
          </div>
          {snapshot?.run?.lastError && <div className="night-error">{snapshot.run.lastError}</div>}
        </aside>
      </section>

      {snapshot?.missions?.length ? (
        <section className="night-card">
          <div className="night-label">Missions persistées</div>
          <div className="night-missions">
            {snapshot.missions.map((mission) => (
              <div className="night-mission" key={mission.id}>
                <span className={`mission-dot mission-${mission.status}`} />
                <span className="mission-title">{mission.title}</span>
                <span className="mission-status">{mission.status}</span>
                <span className="mission-attempt">{mission.attempt}/{mission.maxAttempts}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
