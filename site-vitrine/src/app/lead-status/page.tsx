import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { verifyLeadActionToken } from "@/lib/lead-tracking";

export const metadata: Metadata = {
  title: "Qualifier un lead | GC Agence",
  robots: { index: false, follow: false },
};

const LABELS = {
  qualified: {
    title: "Marquer ce prospect comme qualifié ?",
    button: "Oui, lead qualifié",
  },
  booked: {
    title: "Marquer ce prospect comme rendez-vous pris ?",
    button: "Oui, rendez-vous pris",
  },
  client: {
    title: "Marquer ce prospect comme client gagné ?",
    button: "Oui, client gagné",
  },
} as const;

export default async function LeadStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; result?: string }>;
}) {
  const params = await searchParams;

  if (params.result) {
    const messages: Record<string, string> = {
      qualified: "Lead enregistré comme qualifié.",
      booked: "Rendez-vous enregistré.",
      client: "Client gagné enregistré.",
      invalid: "Lien invalide ou expiré.",
      error: "La mise à jour a échoué. Réessayez depuis l'email.",
    };

    return (
      <Section className="py-24">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="font-display text-3xl font-semibold">Mise à jour GC</h1>
          <p className="mt-5 text-[var(--color-muted)]">
            {messages[params.result] || "Mise à jour enregistrée."}
          </p>
        </div>
      </Section>
    );
  }

  const token = params.t || "";
  const payload = token ? verifyLeadActionToken(token) : null;

  if (!payload) {
    return (
      <Section className="py-24">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="font-display text-3xl font-semibold">Lien invalide ou expiré</h1>
        </div>
      </Section>
    );
  }

  const copy = LABELS[payload.stage];

  return (
    <Section className="py-24">
      <div className="mx-auto max-w-lg rounded-2xl border border-[var(--color-border-strong)] p-8 text-center">
        <h1 className="font-display text-3xl font-semibold">{copy.title}</h1>
        <p className="mt-4 text-sm text-[var(--color-muted)]">
          Cette confirmation alimente le suivi commercial GC et prépare le retour de qualité vers Google Ads.
        </p>
        <form action="/api/lead-status" method="post" className="mt-8">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--color-text)] px-7 text-sm font-medium text-[var(--color-bg)]"
          >
            {copy.button}
          </button>
        </form>
      </div>
    </Section>
  );
}
