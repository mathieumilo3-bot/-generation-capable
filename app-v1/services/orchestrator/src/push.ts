import type { Store } from "./store.ts";

/** Notifications push via le service Expo (jetons ExponentPushToken). Les jetons morts sont supprimés. */
export async function sendPushes(store: Store, o: { fetchImpl?: typeof fetch; limit?: number; log?: (l: "info" | "warn" | "error", m: string, d?: Record<string, unknown>) => void } = {}): Promise<number> {
  const f = o.fetchImpl ?? fetch;
  const pending = await store.pendingPushes(o.limit ?? 50);
  if (pending.length === 0) return 0;
  const expo = pending.filter((p) => /^Expo(nent)?PushToken\[/.test(p.token));
  const sentIds = new Set<string>();

  for (let i = 0; i < expo.length; i += 100) {
    const chunk = expo.slice(i, i + 100);
    try {
      const res = await f("https://exp.host/--/api/v2/push/send", {
        method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(chunk.map((p) => ({ to: p.token, title: p.title, body: p.body, data: { ...p.data, notification_id: p.notification_id }, sound: "default", channelId: "default", priority: "high" }))),
      });
      if (!res.ok) { o.log?.("warn", "push refusé", { status: res.status }); continue; }
      const json = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
      (json.data ?? []).forEach((t, idx) => {
        const p = chunk[idx]!;
        sentIds.add(p.notification_id);
        if (t.status === "error" && t.details?.error === "DeviceNotRegistered") void store.dropPushToken(p.token);
      });
    } catch (e) { o.log?.("warn", "push indisponible", { error: (e as Error).message }); }
  }
  // Notifications sans jeton Expo exploitable (ex. web) : on les marque envoyées pour ne pas boucler.
  for (const p of pending) if (!/^Expo(nent)?PushToken\[/.test(p.token)) sentIds.add(p.notification_id);
  await store.markPushSent([...sentIds]);
  return sentIds.size;
}
