export const CALENDLY_URL =
  "https://calendly.com/ledorvenenzo50/consultation-strategique-acquisition-developpement";

export type BookingLead = {
  nom?: string;
  email?: string;
};

export function buildCalendlyUrl(lead: BookingLead = {}): string {
  const url = new URL(CALENDLY_URL);
  if (lead.nom?.trim()) url.searchParams.set("name", lead.nom.trim());
  if (lead.email?.trim()) url.searchParams.set("email", lead.email.trim().toLowerCase());

  url.searchParams.set("utm_source", "capable_audit");
  url.searchParams.set("utm_medium", "website");
  url.searchParams.set("utm_campaign", "audit_conversion");

  return url.toString();
}
