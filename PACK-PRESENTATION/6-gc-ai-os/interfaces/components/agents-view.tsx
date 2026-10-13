"use client";

import { useEffect, useState } from "react";

interface SkillView {
  skill: string;
  level: number;
  runs: number;
  successes: number;
}

interface AgentView {
  id: string;
  name: string;
  domain: string;
  role: string;
  skills: SkillView[];
}

export function AgentsView() {
  const [agents, setAgents] = useState<AgentView[]>([]);
  const [manufactured, setManufactured] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/agents")
      .then((res) => res.json())
      .then((data: { agents: AgentView[]; manufactured: number }) => {
        setAgents(data.agents);
        setManufactured(data.manufactured);
      })
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="goal-panel">
      <p className="hint" style={{ margin: 0 }}>
        {loading
          ? "Chargement…"
          : `${agents.length} agents actifs${manufactured > 0 ? `, dont ${manufactured} fabriqués par la Factory` : ""}. ` +
            `Les niveaux de compétence sont mesurés à partir d'exécutions réelles, jamais déclarés à la main — ` +
            `un agent sans historique n'affiche donc aucune compétence.`}
      </p>

      <div className="agent-grid">
        {agents.map((agent) => (
          <div key={agent.id} className="agent-card">
            <div className="name">{agent.name}</div>
            <div className="domain">{agent.domain}</div>
            {agent.skills.length === 0 ? (
              <div className="skill">aucune exécution mesurée</div>
            ) : (
              agent.skills.slice(0, 3).map((skill) => (
                <div key={skill.skill} className="skill">
                  {skill.skill} — niveau {skill.level} ({skill.successes}/{skill.runs})
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
