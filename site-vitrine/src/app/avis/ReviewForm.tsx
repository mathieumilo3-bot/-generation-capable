"use client";

import { FormEvent, useMemo, useState } from "react";

const PROJECTS = [
  "Audit / diagnostic",
  "Création ou refonte de site",
  "SEO / référencement local",
  "Acquisition / génération de leads",
  "Google Ads / publicité",
  "Conseil / accompagnement",
  "Autre",
];

export function ReviewForm() {
  const [rating, setRating] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const ratingLabel = useMemo(() => {
    if (!rating) return "Choisissez une note";
    return `${rating}/5`;
  }, [rating]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    if (rating < 1) {
      setStatus("error");
      setMessage("Choisissez une note avant d'envoyer.");
      return;
    }

    setStatus("sending");
    setMessage("");

    const payload = {
      name: String(data.get("name") || ""),
      email: String(data.get("email") || ""),
      company: String(data.get("company") || ""),
      project: String(data.get("project") || ""),
      rating,
      comment: String(data.get("comment") || ""),
      consent: data.get("consent") === "on",
      website: String(data.get("website") || ""),
    };

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("request_failed");

      setStatus("success");
      setMessage("Merci. Votre avis a bien été reçu.");
      form.reset();
      setRating(0);
    } catch {
      setStatus("error");
      setMessage("L'envoi a échoué. Réessayez dans quelques instants.");
    }
  }

  if (status === "success") {
    return (
      <div className="py-10 text-center">
        <p className="font-display text-2xl font-semibold">Merci pour votre retour.</p>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          Votre avis a bien été transmis à GC Agence.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div>
        <label className="text-sm font-semibold text-[var(--color-text)]">Votre note</label>
        <div className="mt-3 flex items-center gap-2" aria-label="Note sur 5">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} étoile${value > 1 ? "s" : ""}`}
              aria-pressed={rating === value}
              className="text-3xl leading-none transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              <span aria-hidden="true">{value <= rating ? "★" : "☆"}</span>
            </button>
          ))}
          <span className="ml-2 text-xs text-[var(--color-muted)]">{ratingLabel}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="font-medium">Nom *</span>
          <input
            name="name"
            required
            maxLength={80}
            autoComplete="name"
            className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Email *</span>
          <input
            name="email"
            type="email"
            required
            maxLength={120}
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 outline-none focus:border-[var(--color-accent)]"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="font-medium">Entreprise / activité</span>
        <input
          name="company"
          maxLength={120}
          className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 outline-none focus:border-[var(--color-accent)]"
        />
      </label>

      <label className="block text-sm">
        <span className="font-medium">Ce que vous avez fait avec GC *</span>
        <select
          name="project"
          required
          defaultValue=""
          className="mt-2 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 outline-none focus:border-[var(--color-accent)]"
        >
          <option value="" disabled>Choisir</option>
          {PROJECTS.map((project) => (
            <option key={project} value={project}>{project}</option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="font-medium">Votre avis *</span>
        <textarea
          name="comment"
          required
          minLength={20}
          maxLength={1500}
          rows={7}
          placeholder="Qu'est-ce qui vous a marqué ? Qu'est-ce qui a été utile ? Qu'est-ce qui pourrait être amélioré ?"
          className="mt-2 w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 outline-none focus:border-[var(--color-accent)]"
        />
      </label>

      <label className="hidden" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <label className="flex gap-3 text-sm leading-relaxed text-[var(--color-muted)]">
        <input name="consent" type="checkbox" className="mt-1 h-4 w-4" />
        <span>
          J&apos;autorise GC Agence à publier ce témoignage sur son site ou ses supports,
          avec mon prénom/nom et mon entreprise lorsque je les ai indiqués.
        </span>
      </label>

      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex w-full items-center justify-center rounded-full bg-[var(--color-text)] px-6 py-3.5 text-sm font-semibold text-[var(--color-bg)] disabled:opacity-60"
      >
        {status === "sending" ? "Envoi…" : "Envoyer mon avis"}
      </button>

      {message && (
        <p
          role="status"
          className={`text-sm ${status === "error" ? "text-red-400" : "text-[var(--color-muted)]"}`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
