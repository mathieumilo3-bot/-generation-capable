/**
 * Liens profonds (§48) : schéma natif `<scheme>://…` ET Universal/App Links
 * `https://<domaine>/…`. Une seule fonction de parsing pour les deux.
 */
export type DeepLink =
  | { type: "invite"; token: string }
  | { type: "auth_callback"; params: Record<string, string> }
  | { type: "project"; projectId: string }
  | { type: "video"; projectId: string; versionId?: string }
  | { type: "payment_result"; status: "success" | "cancelled" | "failed"; paymentId?: string }
  | { type: "wallet" }
  | { type: "unknown" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{20,128}$/;

export function parseDeepLink(url: string): DeepLink {
  let u: URL;
  try { u = new URL(url); } catch { return { type: "unknown" }; }
  // Pour `app://invite/abc`, l'hôte est « invite » ; pour `https://d/invite/abc`, c'est le premier segment.
  const isWeb = u.protocol === "https:" || u.protocol === "http:";
  const segments = (isWeb ? u.pathname : `${u.hostname}${u.pathname}`).split("/").filter(Boolean);
  const [head, a, b] = segments;
  const q = Object.fromEntries(u.searchParams.entries());
  const hash = Object.fromEntries(new URLSearchParams(u.hash.replace(/^#/, "")).entries());

  switch (head) {
    case "invite":
      return a && TOKEN.test(a) ? { type: "invite", token: a } : { type: "unknown" };
    case "auth":
      return a === "callback" ? { type: "auth_callback", params: { ...q, ...hash } } : { type: "unknown" };
    case "project":
      return a && UUID.test(a) ? { type: "project", projectId: a } : { type: "unknown" };
    case "video":
      return a && UUID.test(a) ? { type: "video", projectId: a, versionId: b && UUID.test(b) ? b : undefined } : { type: "unknown" };
    case "payment": {
      const s = a === "success" || a === "cancelled" || a === "failed" ? a : undefined;
      return s ? { type: "payment_result", status: s, paymentId: q.payment_id } : { type: "unknown" };
    }
    case "account":
      return a === "wallet" ? { type: "wallet" } : { type: "unknown" };
    default:
      return { type: "unknown" };
  }
}

/** Route Expo Router correspondante (null = ignorer). */
export function routeForDeepLink(link: DeepLink): string | null {
  switch (link.type) {
    case "invite": return `/invite/${link.token}`;
    case "project": return `/project/${link.projectId}`;
    case "video": return `/project/${link.projectId}`;
    case "payment_result": return `/payment-result?status=${link.status}`;
    case "wallet": return "/account/wallet";
    default: return null;
  }
}
