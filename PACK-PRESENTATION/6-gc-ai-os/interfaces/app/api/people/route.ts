import { NextResponse } from "next/server";
import type { PersonRole } from "@gc-ai-os/people";
import { getRuntime } from "@/server/runtime";

const ROLES: PersonRole[] = ["ambassador", "seller", "director", "staff"];

/**
 * Direction humaine : effectif et liste d'attention (personnes qui
 * décrochent), avec les relances proposées — jamais envoyées
 * automatiquement.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const roleParam = url.searchParams.get("role");
  const role = ROLES.includes(roleParam as PersonRole) ? (roleParam as PersonRole) : undefined;

  const { humanBrain } = getRuntime();

  const [roster, attention] = await Promise.all([
    role ? humanBrain.roster(role) : humanBrain.roster(),
    role ? humanBrain.attentionList(role) : humanBrain.attentionList(),
  ]);

  return NextResponse.json({
    total: roster.length,
    roster: roster.map((person) => ({
      id: person.id,
      displayName: person.displayName,
      role: person.role,
      status: person.status,
      daysSinceLastActivity: person.performance.daysSinceLastActivity,
      revenueGenerated: person.performance.revenueGenerated,
      channel: person.preferences.channel,
      consents: person.consentsToPersonalisation,
    })),
    attention,
  });
}

interface UpsertBody {
  id?: string;
  displayName?: string;
  role?: PersonRole;
  daysSinceLastActivity?: number | null;
  revenueGenerated?: number;
  channel?: string;
  window?: string;
  prefersShortMessages?: boolean;
  consentsToPersonalisation?: boolean;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as UpsertBody | null;
  const id = body?.id?.trim();
  const displayName = body?.displayName?.trim();

  if (!id || !displayName) {
    return NextResponse.json(
      { error: "Les champs « id » et « displayName » sont requis." },
      { status: 400 },
    );
  }

  const { executiveStore } = getRuntime();
  const now = new Date().toISOString();

  await executiveStore.upsert({
    id,
    displayName,
    role: ROLES.includes(body?.role as PersonRole) ? (body!.role as PersonRole) : "ambassador",
    status: "active",
    joinedAt: now,
    preferences: {
      channel: (body?.channel as never) ?? "unknown",
      window: (body?.window as never) ?? "unknown",
      prefersShortMessages: body?.prefersShortMessages ?? false,
      locale: "fr",
    },
    performance: {
      activityCount: 0,
      daysSinceLastActivity: body?.daysSinceLastActivity ?? null,
      revenueGenerated: body?.revenueGenerated ?? 0,
      conversionRate: null,
    },
    consentsToPersonalisation: body?.consentsToPersonalisation ?? false,
    updatedAt: now,
  });

  return NextResponse.json({ ok: true });
}

/** Droit à l'effacement (RGPD art. 17) — suppression définitive. */
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Le paramètre « id » est requis." }, { status: 400 });
  }

  const { humanBrain } = getRuntime();
  await humanBrain.erase(id);
  return NextResponse.json({ ok: true, erased: id });
}
