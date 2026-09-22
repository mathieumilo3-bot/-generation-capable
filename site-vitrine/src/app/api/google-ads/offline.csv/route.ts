import { NextResponse } from "next/server";
import { contactProperty, listLeadContacts } from "@/lib/lead-tracking";

export const dynamic = "force-dynamic";

function csvCell(value: string | number | null | undefined): string {
  const raw = String(value ?? "");
  return `"${raw.replace(/"/g, '""')}"`;
}

function authorized(request: Request): boolean {
  const username = process.env.GOOGLE_ADS_FEED_USERNAME;
  const password = process.env.GOOGLE_ADS_FEED_PASSWORD;
  if (!username || !password) return false;

  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Basic ")) return false;

  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return (
      decoded.slice(0, separator) === username &&
      decoded.slice(separator + 1) === password
    );
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="GC Google Ads feed"' },
    });
  }

  const contacts = await listLeadContacts();
  const rows: string[][] = [];

  for (const contact of contacts) {
    const p = contact.properties;
    if (contactProperty(p, "gc_consent") !== "GRANTED") continue;

    const phoneValue = contactProperty(p, "gc_phone");
    const gclidValue = contactProperty(p, "gc_gclid");
    const gbraidValue = contactProperty(p, "gc_gbraid");
    const orderIdValue = contactProperty(p, "gc_lead_id");
    const qualifiedAt = contactProperty(p, "gc_qualified_at");
    const clientAt = contactProperty(p, "gc_client_at");

    const phone =
      typeof phoneValue === "string" && phoneValue.startsWith("+")
        ? phoneValue.replace(/[\s().-]/g, "")
        : "";

    const common = {
      email: contact.email || "",
      phone,
      gclid: typeof gclidValue === "string" ? gclidValue : "",
      gbraid: typeof gbraidValue === "string" ? gbraidValue : "",
      orderId: typeof orderIdValue === "string" ? orderIdValue : "",
    };

    if (typeof qualifiedAt === "string" && qualifiedAt) {
      rows.push([
        common.email,
        common.phone,
        common.gclid,
        common.gbraid,
        "GC | Qualified Lead",
        qualifiedAt,
        `${common.orderId}-qualified`,
        "1",
        "EUR",
        "WEB",
        "GRANTED",
      ]);
    }

    if (typeof clientAt === "string" && clientAt) {
      rows.push([
        common.email,
        common.phone,
        common.gclid,
        common.gbraid,
        "GC | Converted Lead",
        clientAt,
        `${common.orderId}-client`,
        "1",
        "EUR",
        "WEB",
        "GRANTED",
      ]);
    }
  }

  const header = [
    "Email Address",
    "Phone Number",
    "GCLID",
    "GBRAID",
    "Conversion action",
    "Conversion date and time",
    "Order ID",
    "Conversion value",
    "Conversion currency",
    "Event source",
    "Consent",
  ];

  const csv = [header, ...rows]
    .map((row) => row.map((value) => csvCell(value)).join(","))
    .join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": 'inline; filename="gc-google-ads-offline.csv"',
    },
  });
}
