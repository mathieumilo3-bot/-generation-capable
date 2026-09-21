import { NextResponse } from "next/server";
import { Resend } from "resend";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 6 * 1024;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_FROM = "GC <audit@generationcapable.fr>";

type ReviewPayload = {
  name: string;
  email: string;
  company: string;
  project: string;
  rating: number;
  comment: string;
  consent: boolean;
  website: string;
};

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parsePayload(input: unknown): ReviewPayload | null {
  if (!input || typeof input !== "object") return null;
  const data = input as Record<string, unknown>;

  const payload: ReviewPayload = {
    name: clean(data.name, 80),
    email: clean(data.email, 120),
    company: clean(data.company, 120),
    project: clean(data.project, 120),
    rating: Number(data.rating),
    comment: clean(data.comment, 1500),
    consent: data.consent === true,
    website: clean(data.website, 200),
  };

  if (payload.website) return null;
  if (!payload.name || !payload.email.includes("@") || !payload.project) return null;
  if (!Number.isInteger(payload.rating) || payload.rating < 1 || payload.rating > 5) return null;
  if (payload.comment.length < 20) return null;

  return payload;
}

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  const limit = rateLimit(`reviews:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const review = parsePayload(input);
  if (!review) {
    // The honeypot and invalid submissions get the same generic rejection.
    return NextResponse.json({ error: "invalid_payload" }, { status: 422 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.AUDIT_NOTIFY_EMAIL;

  if (!apiKey || !notifyEmail) {
    if (process.env.NODE_ENV === "production") {
      console.error("[reviews] RESEND_API_KEY / AUDIT_NOTIFY_EMAIL missing");
      return NextResponse.json({ error: "not_configured" }, { status: 500 });
    }
    return NextResponse.json({ status: "received", emailed: false }, { status: 200 });
  }

  const resend = new Resend(apiKey);
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  const lines = [
    `Nouvel avis GC Agence — ${review.rating}/5 ${stars}`,
    "",
    `Nom : ${review.name}`,
    `Email : ${review.email}`,
    `Entreprise : ${review.company || "Non renseignée"}`,
    `Projet : ${review.project}`,
    `Autorisation de publication : ${review.consent ? "Oui" : "Non"}`,
    "",
    "Avis :",
    review.comment,
  ];

  const sent = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
    to: notifyEmail,
    replyTo: review.email,
    subject: `Avis GC Agence — ${review.rating}/5 — ${review.name}`,
    text: lines.join("\n"),
  });

  if (sent.error) {
    console.error("[reviews] email failed:", sent.error.message);
    return NextResponse.json({ error: "email_failed" }, { status: 502 });
  }

  return NextResponse.json({ status: "received", emailed: true }, { status: 200 });
}
