/**
 * Lightweight event layer. It writes to dataLayer when a provider is present,
 * so the site can measure the full commercial funnel instead of only clicks.
 */
export type TrackingEvent =
  | "landing_view"
  | "hero_cta_click"
  | "instant_check_started"
  | "instant_check_completed"
  | "audit_started"
  | "audit_step_1"
  | "audit_step_2"
  | "audit_step_3"
  | "audit_step_4"
  | "audit_completed"
  | "audit_analysis_started"
  | "audit_analysis_completed"
  | "audit_report_viewed"
  | "audit_finding_viewed"
  | "audit_cta_clicked"
  | "audit_report_share_clicked"
  | "cta_clicked"
  | "form_started"
  | "form_completed"
  | "booking_started"
  | "booking_completed"
  | "generate_lead"
  | "qualify_lead"
  | "working_lead";

type EventPayload = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function track(event: TrackingEvent, payload: EventPayload = {}): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...payload, timestamp: Date.now() });
}
