import { signJwt } from "./jwt.ts";

export interface GoogleServiceAccount { client_email: string; private_key: string }

export async function googleAccessToken(sa: GoogleServiceAccount, f: typeof fetch = fetch, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const assertion = await signJwt("RS256", sa.private_key, {}, {
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token", iat: nowSec, exp: nowSec + 3000,
  });
  const res = await f("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string };
  if (!res.ok || !json.access_token) throw new Error(`google_token_failed:${res.status}`);
  return json.access_token;
}

export interface GoogleProductPurchase {
  purchaseState: number;            // 0 = acheté
  acknowledgementState: number;     // 0 = non acquitté
  consumptionState: number;
  orderId?: string;
  purchaseType?: number;            // 0 = test
  obfuscatedExternalAccountId?: string;
  purchaseTimeMillis?: string;
}

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";

export async function fetchGoogleProduct(o: { packageName: string; productId: string; purchaseToken: string; accessToken: string; fetchImpl?: typeof fetch }): Promise<GoogleProductPurchase | null> {
  const f = o.fetchImpl ?? fetch;
  const res = await f(`${API}/${o.packageName}/purchases/products/${encodeURIComponent(o.productId)}/tokens/${encodeURIComponent(o.purchaseToken)}`, {
    headers: { authorization: `Bearer ${o.accessToken}` },
  });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new Error(`google_api_${res.status}`);
  return (await res.json()) as GoogleProductPurchase;
}

export async function acknowledgeGoogleProduct(o: { packageName: string; productId: string; purchaseToken: string; accessToken: string; fetchImpl?: typeof fetch }): Promise<void> {
  const f = o.fetchImpl ?? fetch;
  const res = await f(`${API}/${o.packageName}/purchases/products/${encodeURIComponent(o.productId)}/tokens/${encodeURIComponent(o.purchaseToken)}:acknowledge`, {
    method: "POST", headers: { authorization: `Bearer ${o.accessToken}`, "content-type": "application/json" }, body: "{}",
  });
  if (!res.ok && res.status !== 400) throw new Error(`google_ack_${res.status}`); // 400 = déjà acquitté
}
