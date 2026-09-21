export const CALENDLY_URL =
  "https://calendly.com/ledorvenenzo50/consultation-strategique-acquisition-developpement";

export type BookingLead = {
  nom?: string;
  email?: string;
};

export type BookingAttribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
};

export function buildCalendlyUrl(
  lead: BookingLead = {},
  attribution: BookingAttribution = {}
): string {
  const url = new URL(CALENDLY_URL);
  if (lead.nom?.trim()) url.searchParams.set("name", lead.nom.trim());
  if (lead.email?.trim()) url.searchParams.set("email", lead.email.trim().toLowerCase());

  url.searchParams.set("utm_source", attribution.source?.trim() || "capable_audit");
  url.searchParams.set("utm_medium", attribution.medium?.trim() || "website");
  url.searchParams.set("utm_campaign", attribution.campaign?.trim() || "audit_conversion");

  if (attribution.content?.trim()) {
    url.searchParams.set("utm_content", attribution.content.trim());
  }
  if (attribution.term?.trim()) {
    url.searchParams.set("utm_term", attribution.term.trim());
  }

  return url.toString();
}
