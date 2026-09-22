import { NextResponse } from "next/server";
import { listLeadContacts } from "@/lib/lead-tracking";

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
    const p = contact.properties || {};
    if (p.gc_consent !== "GRANTED") continue;

    const common = {
      email: contact.email || "",
      phone:
        typeof p.gc_phone === "string" && p.gc_phone.startsWith("+")
          ? p.gc_phone.replace(/[\s().-]/g, "")
          : "",
      gclid: typeof p.gc_gclid === "string" ? p.gc_gclid : "",
      gbraid: typeof p.gc_gbraid === "string" ? p.gc_gbraid : "",
      orderId: typeof p.gc_lead_id === "string" ? p.gc_lead_id : "",
    };

    if (typeof p.gc_qualified_at === "string" && p.gc_qualified_at) {
      rows.push([
        common.email,
        common.phone,
        common.gclid,
        common.gbraid,
        "GC | Qualified Lead",
        p.gc_qualified_at,
        `${common.orderId}-qualified`,
        "1",
        "EUR",
        "WEB",
        "GRANTED",
      ]);
    }

    if (typeof p.gc_client_at === "string" && p.gc_client_at) {
      rows.push([
        common.email,
        common.phone,
        common.gclid,
        common.gbraid,
        "GC | Converted Lead",
        p.gc_client_at,
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
