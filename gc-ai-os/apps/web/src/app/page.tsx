"use client";

import type { ChatMessage } from "@gc-ai-os/model-provider";
import { useEffect, useRef, useState } from "react";

interface Turn {
  id: string;
  role: "user" | "agent";
  text: string;
  agentName?: string;
  escalated?: boolean;
}

interface ChatApiResponse {
  agentId: string;
  agentName: string;
  taskId: string;
  text: string;
  escalated: boolean;
  modelMode: "anthropic" | "fallback";
}

export default function ChatConsole() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [modelMode, setModelMode] = useState<"anthropic" | "fallback" | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/chat")
      .then((res) => res.json())
      .then((data: { modelMode: "anthropic" | "fallback" }) => setModelMode(data.modelMode))
      .catch(() => setModelMode("fallback"));
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

  async function send() {
    const message = input.trim();
    if (!message || pending) return;

    const userTurn: Turn = { id: crypto.randomUUID(), role: "user", text: message };
    const history: ChatMessage[] = turns.map((turn) => ({
      role: turn.role === "user" ? "user" : "assistant",
      content: turn.text,
    }));

    setTurns((prev) => [...prev, userTurn]);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, history }),
      });

      if (!res.ok) {
        const errorBody = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorBody?.error ?? `Erreur serveur (${res.status})`);
      }

      const data = (await res.json()) as ChatApiResponse;
      setModelMode(data.modelMode);
      setTurns((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: data.text,
          agentName: data.agentName,
          escalated: data.escalated,
        },
      ]);
    } catch (error) {
      setTurns((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "agent",
          text: error instanceof Error ? error.message : "Erreur inconnue.",
          agentName: "Orchestrateur",
          escalated: true,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

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

      <div className="console-body" ref={bodyRef}>
        {turns.length === 0 && (
          <p className="empty-state">
            Écris à l&apos;Orchestrateur. Il route ta demande vers l&apos;un des 19
            agents (CEO par défaut, ou un spécialiste selon le sujet — technique,
            marketing, commercial, finance, juridique…), journalise le tour, et
            répond ici.
          </p>
        )}

        {turns.map((turn) => (
          <div key={turn.id} className={`turn ${turn.role}${turn.escalated ? " escalated" : ""}`}>
            <span className={`turn-label${turn.escalated ? " escalated" : ""}`}>
              {turn.role === "user" ? (
                "Toi"
              ) : (
                <>
                  <span className="agent-dot" aria-hidden="true" />
                  {turn.agentName}
                  {turn.escalated ? " · escaladé" : ""}
                </>
              )}
            </span>
            <div className="bubble">{turn.text}</div>
          </div>
        ))}

        {pending && (
          <div className="turn agent">
            <span className="turn-label">
              <span className="agent-dot" aria-hidden="true" />
              …
            </span>
            <div className="bubble">
              <span className="typing" aria-label="En train de répondre">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="console-form">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écris un message…"
          rows={1}
          disabled={pending}
          aria-label="Message pour l'Orchestrateur"
        />
        <button type="button" onClick={() => void send()} disabled={pending || !input.trim()}>
          Envoyer
        </button>
      </div>
    </div>
  );
}
