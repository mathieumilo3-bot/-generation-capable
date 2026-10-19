"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STATUS_LABEL_FR } from "./labels";

interface ImportRow {
  id: string;
  clientName: string;
  sourceTitle?: string;
  provider: string;
  status: string;
  mode: string;
  createdAt: string;
  counts: { total: number; ready: number; failed: number; videos: number; photos: number };
}

export default function LibraryPage() {
  const router = useRouter();
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [storage, setStorage] = useState<string>("");
  const [storageBackend, setStorageBackend] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/imports", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setImports(d.imports ?? []);
        setStorage(d.storage ?? "");
        setStorageBackend(d.storageBackend ?? "");
      })
      .catch(() => undefined);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    setSubmitting(true);
    try {
      const res = await fetch("/api/imports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: form.get("url"),
          clientName: form.get("clientName"),
          mode: form.get("mode"),
          sampleSize: Number(form.get("sampleSize") ?? 3),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur inconnue.");
      router.push(`/library/${data.importId}`);
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <p className="sub" style={{ marginBottom: 8 }}>
        <Link href="/">← Nouveau montage par upload</Link>
      </p>
      <h1>Bibliothèque client</h1>
      <p className="sub">
        Colle le lien iCloud ou Google Drive envoyé par ton client : les fichiers sont téléchargés par le serveur et rangés dans le
        cloud, jamais sur ton ordinateur.
      </p>
      {storageBackend === "local" ? (
        <div className="error">Stockage cloud non configuré : les fichiers restent sur le disque du serveur ({storage}). Ajoute les secrets R2_* pour Cloudflare R2.</div>
      ) : null}
      {error ? <div className="error">{error}</div> : null}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="url">Lien de partage</label>
          <input
            id="url"
            name="url"
            type="url"
            className="text-input"
            required
            placeholder="https://www.icloud.com/sharedalbum/#… · https://share.icloud.com/photos/… · https://drive.google.com/drive/folders/…"
          />
        </div>
        <div className="field">
          <label htmlFor="clientName">Client</label>
          <input id="clientName" name="clientName" className="text-input" placeholder="Ex : Mariage Julie & Tom" />
        </div>
        <div className="field">
          <label htmlFor="mode">Mode</label>
          <select id="mode" name="mode" defaultValue="probe">
            <option value="probe">Tester d'abord sur quelques fichiers (recommandé)</option>
            <option value="full">Importer tout directement</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="sampleSize">Fichiers du test</label>
          <select id="sampleSize" name="sampleSize" defaultValue="3">
            {[2, 3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button className="primary" type="submit" disabled={submitting}>
          {submitting ? "Vérification…" : "Importer"}
        </button>
      </form>

      {imports.length > 0 ? (
        <section style={{ marginTop: 56 }}>
          <h2 className="section-title">Imports</h2>
          <div className="import-list">
            {imports.map((imp) => (
              <Link key={imp.id} href={`/library/${imp.id}`} className="import-row">
                <div>
                  <div className="import-title">{imp.clientName}{imp.sourceTitle ? ` — ${imp.sourceTitle}` : ""}</div>
                  <div className="import-meta">
                    {STATUS_LABEL_FR[imp.status] ?? imp.status} · {imp.counts.ready}/{imp.counts.total} fichiers · {imp.counts.videos} vidéos · {imp.counts.photos} photos
                    {imp.counts.failed > 0 ? ` · ${imp.counts.failed} échec(s)` : ""}
                  </div>
                </div>
                <span className="import-arrow">→</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
