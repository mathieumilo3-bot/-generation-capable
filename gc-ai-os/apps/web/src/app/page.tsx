"use client";

import { useEffect, useState } from "react";
import { AgentsView } from "@/components/agents-view";
import { ExecutiveDashboard } from "@/components/executive-dashboard";
import { ChatConsole } from "@/components/chat-console";
import { GoalConsole } from "@/components/goal-console";
import { NightShiftConsole } from "@/components/night-shift-console";

type Tab = "executive" | "objectives" | "chat" | "agents" | "night-shift";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "executive", label: "Direction" },
  { id: "objectives", label: "Objectifs" },
  { id: "chat", label: "Conversation" },
  { id: "agents", label: "Agents" },
  { id: "night-shift", label: "Night Shift" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("executive");
  const [modelMode, setModelMode] = useState<"anthropic" | "fallback" | null>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((res) => res.json())
      .then((data: { modelMode: "anthropic" | "fallback" }) => setModelMode(data.modelMode))
      .catch(() => setModelMode("fallback"));
  }, []);

  return (
    <div className="console">
      <header className="console-header">
        <div className="console-title">
          <span className="dot" aria-hidden="true" />
          GC AI OS
        </div>
        {modelMode && (
          <span className={`status-pill ${modelMode === "anthropic" ? "live" : "demo"}`}>
            {modelMode === "anthropic" ? "IA connectée" : "Mode démonstration hors-ligne"}
          </span>
        )}
      </header>

      <div className="tabs" role="tablist" aria-label="Vues de GC AI OS">
        {TABS.map((entry) => (
          <button key={entry.id} type="button" role="tab" className="tab" aria-selected={tab === entry.id} onClick={() => setTab(entry.id)}>
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "executive" && <ExecutiveDashboard />}
      {tab === "objectives" && <GoalConsole />}
      {tab === "chat" && <ChatConsole />}
      {tab === "agents" && <AgentsView />}
      {tab === "night-shift" && <NightShiftConsole />}
    </div>
  );
}
