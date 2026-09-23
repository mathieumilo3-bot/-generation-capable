import { NextResponse } from "next/server";
import { Resend } from "resend";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 4 * 1024;
const RATE_LIMIT_MAX = 8;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_FROM = "GC <audit@generationcapable.fr>";

function readString(source: Record<string, unknown>, key: string, max: number): string {
  const value = source[key];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] || char);
}

export async function POST(request: Request) {
  const ip = clientIpFrom(request);
  const limit = rateLimit(`audit-intent:${ip}`, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS);

  if (!limit.allowed) {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  const source = payload as Record<string, unknown>;
  const consent = readString(source, "consent", 20);
  const entreprise = readString(source, "entreprise", 160);

  if (consent !== "GRANTED" || entreprise.length < 2) {
    return NextResponse.json({ status: "ignored" }, { status: 200 });
  }

  const data = {
    entreprise,
    siteUrl: readString(source, "siteUrl", 300),
    secteur: readString(source, "secteur", 160),
    ville: readString(source, "ville", 160),
    utmSource: readString(source, "utmSource", 120),
    utmMedium: readString(source, "utmMedium", 120),
    utmCampaign: readString(source, "utmCampaign", 120),
    utmContent: readString(source, "utmContent", 120),
    utmTerm: readString(source, "utmTerm", 120),
    gclid: readString(source, "gclid", 220),
    gbraid: readString(source, "gbraid", 220),
    wbraid: readString(source, "wbraid", 220),
  };

  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.AUDIT_NOTIFY_EMAIL;
  if (!apiKey || !notifyEmail) {
    return NextResponse.json({ status: "received", notified: false }, { status: 200 });
  }

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  const lines = [
    `Entreprise : ${data.entreprise}`,
    `Site : ${data.siteUrl || "non retrouve"}`,
    `Secteur : ${data.secteur || "non determine"}`,
    `Ville : ${data.ville || "non determinee"}`,
    `Source : ${data.utmSource || "-"} / ${data.utmMedium || "-"}`,
    `Campagne : ${data.utmCampaign || "-"}`,
    `Contenu : ${data.utmContent || "-"}`,
    `Terme : ${data.utmTerm || "-"}`,
    `GCLID : ${data.gclid || "-"}`,
  ];

  try {
    const result = await resend.emails.send({
      from,
      to: notifyEmail,
      subject: `Audit commence — ${data.entreprise}`,
      text: [
        "Un visiteur ayant accepte la mesure a lance un diagnostic et son entreprise a ete retrouvee.",
        "",
        ...lines,
        "",
        "Aucune adresse email ni aucun numero de telephone n'a ete collecte a cette etape.",
      ].join("\n"),
      html: `<div style="font-family:Arial,sans-serif;line-height:1.55">
        <h2 style="margin:0 0 14px">Audit commence — ${esc(data.entreprise)}</h2>
        <p>Un visiteur ayant accepté la mesure a lancé un diagnostic et son entreprise a été retrouvée.</p>
        <ul>
          ${lines.map((line) => `<li>${esc(line)}</li>`).join("")}
        </ul>
        <p style="color:#666;font-size:12px">Aucune adresse email ni aucun numéro de téléphone n'a été collecté à cette étape.</p>
      </div>`,
    });

    if (result.error) throw new Error(result.error.message || "intent_notification_failed");
    return NextResponse.json({ status: "received", notified: true }, { status: 200 });
  } catch (error) {
    console.error("[audit/intent] notification failed:", error);
    return NextResponse.json({ status: "received", notified: false }, { status: 200 });
  }
}
