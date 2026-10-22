"use client";

import { useEffect, useState } from "react";

interface DomainScore {
  domain: string;
  label: string;
  score: number | null;
  measuredCount: number;
  totalCount: number;
}

interface Winner {
  title: string;
  rationale: string;
  brainId: string;
  executionDomain: string;
  score: number;
  explanation: string;
}

interface RankedItem {
  title: string;
  brainId: string;
  score: number;
  explanation: string;
}

interface BrainReportView {
  brainId: string;
  label: string;
  coverage: number;
  assessment: string;
  proposalCount: number;
}

interface Gap {
  id: string;
  label: string;
  source: string;
  domain: string;
}

interface Briefing {
  date: string;
  score: { domains: DomainScore[]; overall: number | null; coverage: number; headline: string };
  priority: string;
  arbitration: {
    rationale: string;
    winner: Winner | null;
    contested: Array<{ title: string; score: number; brainId: string }>;
    ranked: RankedItem[];
  };
  reports: BrainReportView[];
  instrumentationGaps: Gap[];
}

export function ExecutiveDashboard() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/executive")
      .then((res) => {
        if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
        return res.json() as Promise<Briefing>;
      })
      .then(setBriefing)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Erreur inconnue."),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="goal-panel">
        <p className="hint">Analyse en cours par les Executive Brains…</p>
      </div>
    );
  }

  if (error || !briefing) {
    return (
      <div className="goal-panel">
        <div className="result-card">
          <p style={{ margin: 0, color: "var(--error)" }}>{error ?? "Briefing indisponible."}</p>
        </div>
      </div>
    );
  }

  const { score, arbitration, reports, instrumentationGaps } = briefing;

  return (
    <div className="goal-panel">
      {/* ---- Priorité du jour ---- */}
      <section className="result-card priority-card">
        <div className="meta-row">
          <span className="state">Briefing du {briefing.date}</span>
          {score.overall !== null && <span className="state">Note globale {score.overall}/100</span>}
          <span className="state">
            {Math.round(score.coverage * 100)} % du catalogue mesuré
          </span>
        </div>

        <h2 className="priority-title">
          {arbitration.winner ? arbitration.winner.title : "Aucune priorité dégagée"}
        </h2>

        {arbitration.winner && (
          <>
            <p className="priority-rationale">{arbitration.winner.rationale}</p>
            <div className="meta-row">
              <span className="state accent">{arbitration.winner.brainId.toUpperCase()} Brain</span>
              <span className="state">score {arbitration.winner.score}</span>
              <span className="state">exécution : {arbitration.winner.executionDomain}</span>
            </div>
            <p className="formula">{arbitration.winner.explanation}</p>
          </>
        )}

        {arbitration.contested.length > 0 && (
          <p className="contested-note">
            Décision serrée — {arbitration.contested.length} proposition(s) à moins de 0,05
            d&apos;écart. Les chiffres ne tranchent pas : un arbitrage humain est justifié ici.
          </p>
        )}

        <div className="download-row">
          <a className="download-btn" href="/api/executive/briefing" download>
            Télécharger le briefing (.md)
          </a>
        </div>
      </section>

      {/* ---- Enterprise Score ---- */}
      <section className="result-card">
        <h2>Note d&apos;entreprise</h2>
        <p className="hint" style={{ margin: 0 }}>
          {score.headline}
        </p>
        <div className="score-grid">
          {score.domains.map((domain) => (
            <div key={domain.domain} className={`score-tile${domain.score === null ? " unmeasured" : ""}`}>
              <div className="score-label">{domain.label}</div>
              <div className="score-value">
                {domain.score === null ? "—" : domain.score}
                {domain.score !== null && <span className="score-max">/100</span>}
              </div>
              <div className="score-meta">
                {domain.score === null
                  ? "non mesuré"
                  : `${domain.measuredCount}/${domain.totalCount} métriques`}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---- Conseil d'administration ---- */}
      <section className="result-card">
        <h2>Conseil d&apos;administration IA</h2>
        <ul className="mission-list">
          {reports.map((report) => (
            <li key={report.brainId} className="mission">
              <div>
                <div className="mission-title">{report.label}</div>
                <div className="brain-assessment">{report.assessment}</div>
              </div>
              <span className={`state${report.proposalCount > 0 ? " awaiting_validation" : " completed"}`}>
                {report.proposalCount > 0 ? `${report.proposalCount} propo.` : "RAS"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Classement des propositions ---- */}
      {arbitration.ranked.length > 1 && (
        <section className="result-card">
          <details className="decisions" open>
            <summary>Arbitrage complet ({arbitration.ranked.length} propositions)</summary>
            <ul>
              {arbitration.ranked.map((item) => (
                <li key={`${item.brainId}-${item.title}`}>
                  <strong>{item.score}</strong> — {item.title}{" "}
                  <span style={{ color: "var(--ink-faint)" }}>({item.brainId})</span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}

      {/* ---- Instrumentation manquante ---- */}
      {instrumentationGaps.length > 0 && (
        <section className="result-card">
          <h2>Ce qui empêche d&apos;y voir clair</h2>
          <p className="hint" style={{ margin: 0 }}>
            {instrumentationGaps.length} métrique(s) ne sont alimentées par aucune source. Tant
            qu&apos;elles restent vides, les Brains concernés ne peuvent produire aucun constat —
            et le système préfère le dire plutôt que d&apos;estimer.
          </p>
          <div className="gap-grid">
            {instrumentationGaps.slice(0, 12).map((gap) => (
              <div key={gap.id} className="gap-chip">
                <span className="gap-label">{gap.label}</span>
                <span className="gap-source">{gap.source}</span>
              </div>
            ))}
          </div>
          {instrumentationGaps.length > 12 && (
            <p className="hint" style={{ margin: 0 }}>
              … et {instrumentationGaps.length - 12} autres.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
