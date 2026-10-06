import type { JobStatus, LedgerType, PricingRule, EditingMethod } from "@app/domain";

export interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  locale: string;
  avatar_path: string | null;
  status: "active" | "suspended" | "deleted";
  billing: BillingDetails;
}

export interface BillingDetails {
  name?: string; company?: string; address?: string; postal_code?: string; city?: string;
  country?: string; vat_number?: string; email?: string;
}

export interface WalletBalance {
  wallet_id: string;
  currency: "EUR";
  status: "active" | "frozen" | "closed";
  balance_cents: number;
  held_cents: number;
  available_cents: number;
}

export type ProjectStatus = "draft" | "processing" | "ready" | "failed" | "archived";

export interface ProjectRow {
  id: string;
  title: string;
  status: ProjectStatus;
  source_mode: "edit_rushes" | "autonomous";
  current_version_id: string | null;
  thumbnail_path: string | null;
  owner_user_id: string;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface VersionRow {
  id: string;
  project_id: string;
  version_number: number;
  parent_version_id: string | null;
  job_id: string | null;
  status: "pending" | "ready" | "failed" | "expired";
  instructions: string | null;
  render_path: string | null;
  thumbnail_path: string | null;
  duration_sec: number | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  created_at: string;
  ready_at: string | null;
  expires_at: string | null;
}

export interface AssetRow {
  id: string;
  project_id: string;
  kind: "raw" | "reference" | "image" | "logo" | "audio_note";
  bucket: "raw" | "processed";
  path: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  duration_sec: number | null;
  status: "pending" | "uploaded" | "failed" | "deleted";
  created_at: string;
}

export interface JobRow {
  id: string;
  project_id: string;
  version_id: string;
  kind: "create" | "revision";
  status: JobStatus;
  progress: number;
  current_stage: string | null;
  price_cents: number;
  requested_duration_sec: number;
  aspect_ratio: string;
  error_code: string | null;
  cancel_requested: boolean;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface NotificationRow {
  id: string;
  kind: "video_ready" | "revision_ready" | "job_failed" | "low_balance" | "topup_done" | "payment_failed" | "info";
  title: string;
  body: string;
  data: { project_id?: string; job_id?: string; deep_link?: string; [k: string]: unknown };
  read_at: string | null;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  provider: "stripe" | "apple" | "google" | "manual";
  kind: "topup" | "auto_reload";
  amount_cents: number;
  status: string;
  refunded_cents: number;
  failure_code: string | null;
  receipt_url: string | null;
  invoice_url: string | null;
  created_at: string;
  succeeded_at: string | null;
}

export interface PaymentMethodRow {
  id: string;
  provider: "stripe";
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
}

export interface AutoReloadRule {
  id: string;
  enabled: boolean;
  threshold_cents: number;
  amount_cents: number;
  monthly_cap_cents: number;
  payment_method_id: string | null;
  failure_count: number;
  last_status: string | null;
  last_triggered_at: string | null;
}

export type { JobStatus, LedgerType, PricingRule, EditingMethod };

/** Résultat d'un RPC métier : refus lisibles, jamais d'exception pour un cas attendu. */
export type RpcResult<T extends object = object> = ({ ok: true } & T) | { ok: false; code: string; [k: string]: unknown };

export interface SubmitJobOk { job_id: string; project_id: string; version_id: string; price_cents: number; remaining_cents?: number; replayed?: boolean }
export interface QuoteOk { pricing_rule_id: string; label: string; price_cents: number; available_cents: number; after_cents: number; shortfall_cents: number; can_afford: boolean }
