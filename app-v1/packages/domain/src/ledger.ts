import { formatEuros } from "./money";

export type LedgerType =
  | "topup" | "purchase" | "hold" | "capture" | "release" | "refund"
  | "bonus" | "manual_adjustment" | "commercial_credit" | "promotion";

export interface HistoryRow {
  id: string;
  type: LedgerType;
  available_delta_cents: number;
  amount_cents: number;
  reference: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
  job_id?: string | null;
  project_id?: string | null;
  payment_id?: string | null;
}

export interface HistoryItem {
  id: string;
  title: string;
  subtitle: string | null;
  amountCents: number;
  amountLabel: string; // « +25,00 € » / « −4,84 € »
  tone: "positive" | "negative" | "neutral";
  createdAt: string;
}

/** Libellé humain d'une ligne du ledger (§29). */
export function describeHistoryRow(row: HistoryRow): HistoryItem {
  const delta = row.available_delta_cents;
  let title: string;
  let subtitle: string | null = null;
  switch (row.type) {
    case "topup": title = "Recharge"; break;
    case "hold":
    case "purchase":
    case "capture":
      title = row.reference ?? "Montage vidéo"; break;
    case "release": title = "Montant libéré"; subtitle = "Rendu annulé"; break;
    case "refund": title = "Remboursement"; break;
    case "bonus": title = "Bonus"; break;
    case "promotion": title = "Offre promotionnelle"; break;
    case "commercial_credit": title = "Solde offert"; break;
    case "manual_adjustment": title = "Ajustement"; subtitle = "Effectué par notre équipe"; break;
  }
  return {
    id: row.id, title, subtitle, amountCents: delta,
    amountLabel: formatEuros(delta, { signed: true }),
    tone: delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral",
    createdAt: row.created_at,
  };
}

/** « Aujourd'hui », « Hier », sinon « 12 oct. 2026 ». */
export function relativeDay(iso: string, now: Date = new Date(), locale = "fr-FR"): string {
  const d = new Date(iso);
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}
