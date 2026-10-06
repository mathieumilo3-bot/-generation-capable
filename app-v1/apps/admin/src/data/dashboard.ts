import type { AdminDb } from "./db";
import { asRecord, num } from "../lib/decode";

export interface Dashboard {
  revenueTodayCents: number;
  revenueMonthCents: number;
  refundedMonthCents: number;
  walletRechargedMonthCents: number;
  walletConsumedMonthCents: number;
  outstandingWalletCents: number;
  videosMonth: number;
  jobsCompletedMonth: number;
  jobsFailedMonth: number;
  jobsActive: number;
  engineCostMonthMicro: number;
  grossMarginMonthCents: number;
  customersTotal: number;
}

export function decodeDashboard(raw: unknown): Dashboard {
  const r = asRecord(raw);
  return {
    revenueTodayCents: num(r.revenue_today_cents),
    revenueMonthCents: num(r.revenue_month_cents),
    refundedMonthCents: num(r.refunded_month_cents),
    walletRechargedMonthCents: num(r.wallet_recharged_month_cents),
    walletConsumedMonthCents: num(r.wallet_consumed_month_cents),
    outstandingWalletCents: num(r.outstanding_wallet_cents),
    videosMonth: num(r.videos_month),
    jobsCompletedMonth: num(r.jobs_completed_month),
    jobsFailedMonth: num(r.jobs_failed_month),
    jobsActive: num(r.jobs_active),
    engineCostMonthMicro: num(r.engine_cost_month_micro),
    grossMarginMonthCents: num(r.gross_margin_month_cents),
    customersTotal: num(r.customers_total),
  };
}

export async function fetchDashboard(db: AdminDb, timeZone = "Europe/Paris"): Promise<Dashboard> {
  return decodeDashboard(await db.rpc("admin_dashboard", { p_tz: timeZone }));
}
