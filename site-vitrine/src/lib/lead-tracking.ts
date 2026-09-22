import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { SITE_URL } from "@/lib/constants";
import type { AuditSubmission } from "@/lib/audit-submission";

export type LeadStage = "qualified" | "booked" | "client";

export type LeadMeta = {
  leadId: string;
  leadTime: string;
};

type LeadTokenPayload = {
  v: 1;
  email: string;
  leadId: string;
  stage: LeadStage;
  exp: number;
};

const ACTION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function splitName(name: string): { firstName?: string; lastName?: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function createLeadMeta(): LeadMeta {
  return {
    leadId: randomUUID(),
    leadTime: new Date().toISOString(),
  };
}

function encodePayload(payload: LeadTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function signatureFor(encodedPayload: string): string {
  return createHmac("sha256", requireEnv("LEAD_ACTION_SECRET"))
    .update(encodedPayload)
    .digest("base64url");
}

export function createLeadActionToken(
  email: string,
  leadId: string,
  stage: LeadStage
): string {
  const payload: LeadTokenPayload = {
    v: 1,
    email: email.toLowerCase(),
    leadId,
    stage,
    exp: Date.now() + ACTION_TTL_MS,
  };
  const encoded = encodePayload(payload);
  return `${encoded}.${signatureFor(encoded)}`;
}

export function verifyLeadActionToken(token: string): LeadTokenPayload | null {
  const [encoded, suppliedSignature] = token.split(".");
  if (!encoded || !suppliedSignature) return null;

  const expectedSignature = signatureFor(encoded);
  const a = Buffer.from(suppliedSignature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as LeadTokenPayload;
    if (
      payload.v !== 1 ||
      !payload.email ||
      !payload.leadId ||
      !["qualified", "booked", "client"].includes(payload.stage) ||
      !Number.isFinite(payload.exp) ||
      payload.exp < Date.now()
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function buildLeadActionLinks(email: string, leadId: string) {
  const build = (stage: LeadStage) =>
    `${SITE_URL}/lead-status?t=${encodeURIComponent(
      createLeadActionToken(email, leadId, stage)
    )}`;

  return {
    qualified: build("qualified"),
    booked: build("booked"),
    client: build("client"),
  };
}

export async function upsertLeadContact(
  submission: AuditSubmission,
  meta: LeadMeta
): Promise<void> {
  const apiKey = requireEnv("RESEND_API_KEY");
  const segmentId = process.env.RESEND_GC_LEADS_SEGMENT_ID;
  const resend = new Resend(apiKey);
  const { firstName, lastName } = splitName(submission.nom);

  const properties = {
    gc_stage: "lead",
    gc_lead_id: meta.leadId,
    gc_gclid: submission.gclid || "",
    gc_gbraid: submission.gbraid || "",
    gc_wbraid: submission.wbraid || "",
    gc_lead_time: meta.leadTime,
    gc_company: submission.entreprise || "",
    gc_sector: submission.secteur,
    gc_objective: submission.objectif,
    gc_phone: submission.telephone || "",
    gc_source: submission.utmSource || "",
    gc_campaign: submission.utmCampaign || "",
    gc_consent: submission.adUserDataConsent || "UNSPECIFIED",
  };

  const created = await resend.contacts.create({
    email: submission.email,
    firstName,
    lastName,
    unsubscribed: false,
    properties,
    ...(segmentId ? { segments: [{ id: segmentId }] } : {}),
  });

  if (!created.error) return;

  const updated = await resend.contacts.update({
    email: submission.email,
    firstName,
    lastName,
    properties,
  });

  if (updated.error) {
    throw new Error(updated.error.message || "lead_contact_upsert_failed");
  }

  if (segmentId) {
    const added = await resend.contacts.segments.add({
      email: submission.email,
      segmentId,
    });
    if (added.error) {
      throw new Error(added.error.message || "lead_segment_add_failed");
    }
  }
}

export async function markLeadStage(token: string): Promise<{
  ok: boolean;
  stage?: LeadStage;
}> {
  const payload = verifyLeadActionToken(token);
  if (!payload) return { ok: false };

  const resend = new Resend(requireEnv("RESEND_API_KEY"));
  const now = new Date().toISOString();
  const timestampKey =
    payload.stage === "qualified"
      ? "gc_qualified_at"
      : payload.stage === "booked"
        ? "gc_booked_at"
        : "gc_client_at";

  const current = await resend.contacts.get({ email: payload.email });
  if (current.error || !current.data) return { ok: false };

  const currentLeadId = current.data.properties?.gc_lead_id?.value;
  if (currentLeadId !== payload.leadId) return { ok: false };

  const result = await resend.contacts.update({
    email: payload.email,
    properties: {
      gc_stage: payload.stage,
      [timestampKey]: now,
    },
  });

  if (result.error) {
    throw new Error(result.error.message || "lead_stage_update_failed");
  }

  return { ok: true, stage: payload.stage };
}

type ContactPropertyValue = {
  type: "string" | "number";
  value: string | number;
};

export type LeadContactRecord = {
  id?: string;
  email?: string;
  properties?: Record<string, ContactPropertyValue>;
};

export function contactProperty(
  properties: LeadContactRecord["properties"],
  key: string
): string | number | null {
  return properties?.[key]?.value ?? null;
}

export async function listLeadContacts(): Promise<LeadContactRecord[]> {
  const resend = new Resend(requireEnv("RESEND_API_KEY"));
  const segmentId = process.env.RESEND_GC_LEADS_SEGMENT_ID;
  const contacts: LeadContactRecord[] = [];
  const seenCursors = new Set<string>();
  let after: string | undefined;

  while (true) {
    const response = await resend.contacts.list({
      limit: 100,
      ...(segmentId ? { segmentId } : {}),
      ...(after ? { after } : {}),
    });

    if (response.error) {
      throw new Error(response.error.message || "contacts_list_failed");
    }

    const page = response.data;
    const items = page?.data ?? [];

    for (const item of items) {
      const detail = await resend.contacts.get({ email: item.email });
      if (detail.error || !detail.data) continue;
      if (contactProperty(detail.data.properties, "gc_lead_id")) {
        contacts.push(detail.data);
      }
    }

    if (!page?.has_more || items.length === 0) break;

    const nextCursor = items[items.length - 1]?.id;
    if (!nextCursor || seenCursors.has(nextCursor)) break;
    seenCursors.add(nextCursor);
    after = nextCursor;
  }

  return contacts;
}
