"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

const PRESETS = [
  { id: "preset_premium_clean", label: "Premium — épuré" },
  { id: "preset_dynamic_social", label: "Dynamique — réseaux sociaux" },
  { id: "preset_aggressive_hype", label: "Très dynamique — hype" },
];

export default function HomePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    if ((form.getAll("rushes") as File[]).every((f) => f.size === 0)) {
      setError("Ajoute au moins un fichier vidéo.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur inconnue.");
      router.push(`/projects/${data.projectId}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <h1>Que veux-tu créer ?</h1>
      <p className="sub">Dépose tes rushs, explique ce que tu veux. Aucune timeline, aucun logiciel de montage.</p>

      {error ? <div className="error">{error}</div> : null}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="rushes">1. Upload tes rushs</label>
          <input id="rushes" name="rushes" type="file" accept="video/*" multiple required />
        </div>

        <div className="field">
          <label htmlFor="brief">2. Qu'est-ce que tu veux créer ?</label>
          <textarea
            id="brief"
            name="brief"
            placeholder="Ex : Fais-moi une vidéo TikTok de 45 secondes, très dynamique, avec un hook fort, des sous-titres, des zooms et du B-roll. Destinée aux entrepreneurs."
            required
          />
        </div>

        <div className="field">
          <label htmlFor="preset">Style (facultatif — sinon détecté depuis ta description)</label>
          <select id="preset" name="preset" defaultValue="">
            <option value="">Choix automatique</option>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="references">3. Ajoute éventuellement des vidéos de référence</label>
          <input id="references" name="references" type="file" accept="video/*" multiple />
        </div>

        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Envoi…" : "Créer ma vidéo"}
        </button>
      </form>
    </main>
  );
}
