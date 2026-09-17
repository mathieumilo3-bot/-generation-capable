/**
 * Thin wrapper around a future analytics provider (Plausible, GA4, Meta CAPI…).
 * Every call is a no-op if `window.dataLayer` / the provider script isn't
 * present yet, so this can ship ahead of the analytics integration.
 */
export type TrackingEvent =
  | "audit_started"
  | "audit_completed"
  | "cta_clicked"
  | "form_started"
  | "form_completed"
  | "booking_started"
  | "booking_completed";

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
