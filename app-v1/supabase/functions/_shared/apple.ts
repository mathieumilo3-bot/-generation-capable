import { decodeJwtPayload, signJwt } from "./jwt.ts";

export interface AppleKeyConfig { teamId: string; clientId: string; keyId: string; privateKeyPem: string }

/** client_secret Sign in with Apple (JWT ES256, ≤ 6 mois ; on en refait un à chaque appel). */
export async function appleClientSecret(c: AppleKeyConfig, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  return signJwt("ES256", c.privateKeyPem, { kid: c.keyId }, { iss: c.teamId, iat: nowSec, exp: nowSec + 1800, aud: "https://appleid.apple.com", sub: c.clientId });
}

export async function appleExchangeCode(c: AppleKeyConfig, code: string, f: typeof fetch = fetch): Promise<{ refresh_token: string }> {
  const res = await f("https://appleid.apple.com/auth/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: await appleClientSecret(c), code, grant_type: "authorization_code" }),
  });
  const json = (await res.json().catch(() => ({}))) as { refresh_token?: string; error?: string };
  if (!res.ok || !json.refresh_token) throw new Error(`apple_exchange_failed:${json.error ?? res.status}`);
  return { refresh_token: json.refresh_token };
}

/** Révocation exigée par Apple à la suppression du compte (guideline 5.1.1(v)). */
export async function appleRevoke(c: AppleKeyConfig, refreshToken: string, f: typeof fetch = fetch): Promise<void> {
  const res = await f("https://appleid.apple.com/auth/revoke", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: await appleClientSecret(c), token: refreshToken, token_type_hint: "refresh_token" }),
  });
  if (!res.ok) throw new Error(`apple_revoke_failed:${res.status}`);
}

export interface StoreKitConfig { issuerId: string; keyId: string; bundleId: string; privateKeyPem: string }

export async function storeKitToken(c: StoreKitConfig, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  return signJwt("ES256", c.privateKeyPem, { kid: c.keyId }, { iss: c.issuerId, iat: nowSec, exp: nowSec + 1800, aud: "appstoreconnect-v1", bid: c.bundleId });
}

export interface AppleTransaction {
  transactionId: string; originalTransactionId: string; bundleId: string; productId: string; type: string;
  environment: "Production" | "Sandbox"; appAccountToken?: string; revocationDate?: number; quantity?: number; purchaseDate: number;
}

/**
 * App Store Server API : l'authenticité vient de l'appel serveur-à-serveur authentifié par NOTRE clé
 * (jamais d'un reçu fourni par le client). Production d'abord ; si 404 et sandbox autorisé → Sandbox.
 */
export async function fetchAppleTransaction(c: StoreKitConfig, transactionId: string, o: { allowSandbox: boolean; fetchImpl?: typeof fetch }): Promise<AppleTransaction | null> {
  const f = o.fetchImpl ?? fetch;
  const token = await storeKitToken(c);
  const hosts = ["https://api.storekit.itunes.apple.com", ...(o.allowSandbox ? ["https://api.storekit-sandbox.itunes.apple.com"] : [])];
  for (const host of hosts) {
    const res = await f(`${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 404 || res.status === 401 && host !== hosts[hosts.length - 1]) continue;
    if (!res.ok) throw new Error(`apple_api_${res.status}`);
    const json = (await res.json()) as { signedTransactionInfo?: string };
    if (!json.signedTransactionInfo) return null;
    return decodeJwtPayload<AppleTransaction>(json.signedTransactionInfo);
  }
  return null;
}
