"use client";

import { useState } from "react";

interface MissionView {
  id: string;
  title: string;
  domain: string;
  status: string;
  assignedAgentId: string | null;
  attempt: number;
  maxAttempts: number;
}

interface DeliverableView {
  id: string;
  filename: string;
  bytes: number;
  producedByAgentId: string;
  preview: string;
}

interface DecisionView {
  id: string;
  kind: string;
  rationale: string;
}

interface ObjectiveView {
  id: string;
  title: string;
  status: string;
  spentMicros: number;
  budgetMicros: number;
}

interface RunResult {
  objective: ObjectiveView;
  missions: MissionView[];
  deliverables?: DeliverableView[];
  decisions?: DecisionView[];
  planSource: "model" | "template";
  halted?: boolean;
  haltReason?: string | null;
  executed: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  blocked: "Bloquée",
  in_progress: "En cours",
  self_correcting: "Auto-correction",
  awaiting_validation: "Validation requise",
  completed: "Terminée",
  failed: "Échouée",
};

export function GoalConsole() {
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(execute: boolean) {
    const trimmed = title.trim();
    if (!trimmed || pending) return;

    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/objectives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: trimmed, statement: statement.trim() || trimmed, execute }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Erreur serveur (${res.status})`);
      }

      setResult((await res.json()) as RunResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur inconnue.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="goal-panel">
      <div className="goal-form">
        <label htmlFor="goal-title">Objectif</label>
        <input
          id="goal-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Amener Génération Capable à 1 000 vendeurs actifs"
          disabled={pending}
        />

        <label htmlFor="goal-statement">Précisions (optionnel)</label>
        <textarea
          id="goal-statement"
          value={statement}
          onChange={(event) => setStatement(event.target.value)}
          placeholder="Contexte, contraintes, échéance…"
          rows={3}
          disabled={pending}
        />

        <p className="hint">
          <strong>Planifier</strong> décompose l&apos;objectif en missions sans rien exécuter —
          tu relis le plan avant d&apos;engager du budget. <strong>Planifier et exécuter</strong>{" "}
          lance les agents en parallèle, avec auto-correction et validation, puis produit un
          dossier téléchargeable.
        </p>

        <div className="download-row">
          <button
            type="button"
            className="primary-btn"
            onClick={() => void run(false)}
            disabled={pending || !title.trim()}
          >
            {pending ? "En cours…" : "Planifier"}
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={() => void run(true)}
            disabled={pending || !title.trim()}
          >
            Planifier et exécuter
          </button>
        </div>
      </div>

      {error && (
        <div className="result-card">
          <p style={{ margin: 0, color: "var(--error)" }}>{error}</p>
        </div>
      )}

      {result && (
        <div className="result-card">
          <h2>{result.objective.title}</h2>

          <div className="meta-row">
            <span className={`state ${result.objective.status}`}>{result.objective.status}</span>
            <span className="state">
              plan : {result.planSource === "model" ? "généré par modèle" : "playbook déterministe"}
            </span>
            <span className="state">
              budget {result.objective.spentMicros}/{result.objective.budgetMicros} µ€
            </span>
          </div>

          {result.halted && (
            <p style={{ margin: 0, color: "var(--warn)", fontSize: "0.88rem" }}>
              Exécution interrompue : {result.haltReason}
            </p>
          )}

          <ul className="mission-list">
            {result.missions.map((mission) => (
              <li key={mission.id} className="mission">
                <div>
                  <div className="mission-title">{mission.title}</div>
                  <div className="mission-meta">
                    {mission.domain}
                    {mission.assignedAgentId ? ` · ${mission.assignedAgentId}` : ""}
                    {mission.attempt > 0 ? ` · tentative ${mission.attempt}/${mission.maxAttempts}` : ""}
                  </div>
                </div>
                <span className={`state ${mission.status}`}>
                  {STATUS_LABELS[mission.status] ?? mission.status}
                </span>
              </li>
            ))}
          </ul>

          {result.executed && (
            <div className="download-row">
              <a
                className="download-btn"
                href={`/api/objectives/${result.objective.id}/dossier`}
                download
              >
                Télécharger le dossier complet (.md)
              </a>
              {(result.deliverables ?? []).map((deliverable) => (
                <a
                  key={deliverable.id}
                  className="download-link"
                  href={`/api/deliverables/${deliverable.id}`}
                  download
                >
                  {deliverable.filename}
                </a>
              ))}
            </div>
          )}

          {result.decisions && result.decisions.length > 0 && (
            <details className="decisions">
              <summary>Arbitrages du Directeur Général ({result.decisions.length})</summary>
              <ul>
                {result.decisions.map((decision) => (
                  <li key={decision.id}>
                    <strong>{decision.kind}</strong> — {decision.rationale}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
