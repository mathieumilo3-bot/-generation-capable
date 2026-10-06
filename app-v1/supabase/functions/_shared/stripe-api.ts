/**
 * Client Stripe minimal par fetch (aucun SDK : tourne sous Deno comme sous Node, version d'API explicite
 * côté compte). Toutes les écritures portent une clé d'idempotence.
 */
export class StripeError extends Error {
  constructor(readonly status: number, readonly code: string | undefined, readonly declineCode: string | undefined,
    message: string, readonly paymentIntentId?: string, readonly paymentIntentStatus?: string) {
    super(message);
    this.name = "StripeError";
  }
}

/** Encode un objet imbriqué au format application/x-www-form-urlencoded de Stripe (a[b][0][c]=v). */
export function encodeForm(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((item, i) => {
      if (typeof item === "object" && item !== null) out.push(...encodeForm(item as Record<string, unknown>, `${key}[${i}]`));
      else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
    });
    else if (typeof v === "object") out.push(...encodeForm(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export interface StripeClientOptions { secretKey: string; fetchImpl?: typeof fetch; apiBase?: string; apiVersion?: string }

export function createStripeClient(o: StripeClientOptions) {
  const f = o.fetchImpl ?? fetch;
  const base = o.apiBase ?? "https://api.stripe.com/v1";

  async function call<T>(method: "GET" | "POST", path: string, params?: Record<string, unknown>, idempotencyKey?: string): Promise<T> {
    const body = params && method === "POST" ? encodeForm(params).join("&") : undefined;
    const query = params && method === "GET" ? "?" + encodeForm(params).join("&") : "";
    const res = await f(base + path + query, {
      method,
      headers: {
        authorization: `Bearer ${o.secretKey}`,
        ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}),
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        ...(o.apiVersion ? { "stripe-version": o.apiVersion } : {}),
      },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      const e = (json.error ?? {}) as Record<string, any>;
      throw new StripeError(res.status, e.code, e.decline_code, String(e.message ?? `Stripe ${res.status}`), e.payment_intent?.id, e.payment_intent?.status);
    }
    return json as T;
  }

  return {
    createCustomer: (p: { email?: string | null; name?: string | null; metadata: Record<string, string> }, key: string) =>
      call<{ id: string }>("POST", "/customers", p, key),
    /** Checkout hébergé : moyens de paiement dynamiques (carte, Apple Pay, Google Pay, Link… selon l'utilisateur) — aucun payment_method_types forcé. */
    createCheckoutSession: (p: Record<string, unknown>, key: string) => call<{ id: string; url: string }>("POST", "/checkout/sessions", p, key),
    retrieveCheckoutSession: (id: string, expand: string[] = []) => call<Record<string, any>>("GET", `/checkout/sessions/${id}`, expand.length ? { expand } : undefined),
    createPaymentIntent: (p: Record<string, unknown>, key: string) => call<Record<string, any>>("POST", "/payment_intents", p, key),
    retrieveCharge: (id: string) => call<Record<string, any>>("GET", `/charges/${id}`),
    retrievePaymentMethod: (id: string) => call<Record<string, any>>("GET", `/payment_methods/${id}`),
    retrieveSetupIntent: (id: string, expand: string[] = []) => call<Record<string, any>>("GET", `/setup_intents/${id}`, expand.length ? { expand } : undefined),
  };
}
export type StripeClient = ReturnType<typeof createStripeClient>;
