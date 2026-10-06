import type { AdminDb } from "./db";
import { asRecord, bool, mapRows, num, str, strOrNull } from "../lib/decode";

export interface PricingRule {
  id: string;
  mode: string;
  bucketKey: string;
  label: string;
  durationMinSec: number;
  durationMaxSec: number;
  priceCents: number;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  sortOrder: number;
}

export async function listPricingRules(db: AdminDb): Promise<PricingRule[]> {
  const res = await db.select({
    table: "pricing_rules",
    order: [{ column: "mode" }, { column: "sort_order" }, { column: "effective_from", ascending: false }],
    limit: 500,
  });
  return mapRows(res.rows, (r) => ({
    id: str(r.id), mode: str(r.mode), bucketKey: str(r.bucket_key), label: str(r.label),
    durationMinSec: num(r.duration_min_sec), durationMaxSec: num(r.duration_max_sec), priceCents: num(r.price_cents),
    active: bool(r.active), effectiveFrom: str(r.effective_from), effectiveTo: strOrNull(r.effective_to),
    sortOrder: num(r.sort_order),
  }));
}

/** Clôt l'ancienne règle (effective_to) et en crée une nouvelle : l'historique est conservé. */
export async function changePrice(db: AdminDb, ruleId: string, priceCents: number, reason: string): Promise<string> {
  const id = await db.rpc("admin_change_price", { p_rule_id: ruleId, p_price_cents: priceCents, p_reason: reason.trim() });
  return typeof id === "string" ? id : "";
}

export interface AppSetting {
  key: string;
  value: unknown;
  isPublic: boolean;
  description: string | null;
  updatedAt: string;
}

export async function listSettings(db: AdminDb): Promise<AppSetting[]> {
  const res = await db.select({ table: "app_settings", order: [{ column: "key" }], limit: 500 });
  return mapRows(res.rows, (r) => ({
    key: str(r.key), value: r.value ?? null, isPublic: bool(r.is_public), description: strOrNull(r.description),
    updatedAt: str(r.updated_at),
  }));
}

export async function setSetting(db: AdminDb, key: string, value: unknown, reason: string): Promise<void> {
  await db.rpc("admin_set_setting", { p_key: key, p_value: value, p_reason: reason.trim() });
}

export interface EngineCapabilitiesRow {
  id: string;
  engineVersion: string;
  capabilities: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}

export async function listEngineCapabilities(db: AdminDb): Promise<EngineCapabilitiesRow[]> {
  const res = await db.select({ table: "engine_capabilities", order: [{ column: "created_at", ascending: false }], limit: 20 });
  return mapRows(res.rows, (r) => ({
    id: str(r.id), engineVersion: str(r.engine_version), capabilities: asRecord(r.capabilities),
    active: bool(r.active), createdAt: str(r.created_at),
  }));
}
