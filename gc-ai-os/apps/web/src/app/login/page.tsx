"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Authentification refusée.");
      router.replace(searchParams.get("next") || "/");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentification refusée.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#080b10", color: "#f4f7fb", fontFamily: "system-ui, sans-serif" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 460, padding: 32, border: "1px solid #252c36", borderRadius: 20, background: "#10151c", boxShadow: "0 20px 70px rgba(0,0,0,.35)" }}>
        <div style={{ fontSize: 12, letterSpacing: ".16em", opacity: .65, marginBottom: 10 }}>GC AI OS</div>
        <h1 style={{ margin: "0 0 10px", fontSize: 30 }}>JARVIS privé</h1>
        <p style={{ margin: "0 0 24px", opacity: .7, lineHeight: 1.5 }}>Accès propriétaire requis avant toute action d’exécution.</p>
        <label style={{ display: "block", fontSize: 13, marginBottom: 8 }} htmlFor="token">Clé propriétaire</label>
        <input
          id="token"
          type="password"
          autoComplete="current-password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          style={{ width: "100%", boxSizing: "border-box", padding: "13px 14px", borderRadius: 12, border: "1px solid #303946", background: "#0a0e14", color: "inherit", outline: "none" }}
        />
        <button disabled={loading || token.length === 0} type="submit" style={{ width: "100%", marginTop: 16, padding: "13px 14px", borderRadius: 12, border: 0, background: "#f4f7fb", color: "#080b10", fontWeight: 700, cursor: "pointer" }}>
          {loading ? "VÉRIFICATION…" : "ENTRER DANS JARVIS"}
        </button>
        {error && <p style={{ color: "#ff8f8f", margin: "14px 0 0", fontSize: 13 }}>{error}</p>}
      </form>
    </main>
  );
}
