// Production release: ads-tracking-search-2026-09-22
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
  | "audit_discovery_fallback"
  | "audit_company_disambiguation_requested"
  | "audit_site_requested"
  | "audit_intent_captured"
  | "audit_ready_notification_requested"
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
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: TrackingEvent, payload: EventPayload = {}): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event, ...payload, timestamp: Date.now() });
}


const GOOGLE_ADS_LEAD_DESTINATION = "AW-18466478982/jQ8BCLOau4AdEIa3wOVE";

export function trackGoogleAdsLeadConversion(userData?: {
  email?: string;
  telephone?: string;
  adUserDataConsent?: string;
}): void {
  if (typeof window === "undefined") return;

  try {
    if (sessionStorage.getItem("gc_google_ads_lead_sent") === "1") return;
  } catch {
    // Keep going: a blocked sessionStorage must not block measurement.
  }

  if (
    typeof window.gtag === "function" &&
    userData?.adUserDataConsent === "GRANTED"
  ) {
    window.gtag("set", "user_data", {
      email: userData.email?.trim().toLowerCase(),
      phone_number: userData.telephone?.trim(),
    });
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", "conversion", {
      send_to: GOOGLE_ADS_LEAD_DESTINATION,
    });
  } else {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "conversion",
      send_to: GOOGLE_ADS_LEAD_DESTINATION,
    });
  }

  try {
    sessionStorage.setItem("gc_google_ads_lead_sent", "1");
  } catch {
    // Non-blocking.
  }
}
