const enc = new TextEncoder();

export function b64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof input === "string" ? enc.encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function pemToDer(pem: string): Uint8Array {
  const body = pem.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, "");
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
}

export type JwtAlg = "ES256" | "RS256";

/** Signe un JWT. ES256 : WebCrypto produit déjà la signature brute r||s attendue par JOSE. */
export async function signJwt(alg: JwtAlg, privateKeyPem: string, header: Record<string, unknown>, payload: Record<string, unknown>): Promise<string> {
  const der = pemToDer(privateKeyPem) as BufferSource;
  const key = alg === "ES256"
    ? await crypto.subtle.importKey("pkcs8", der, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"])
    : await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const head = b64url(JSON.stringify({ alg, typ: "JWT", ...header }));
  const body = b64url(JSON.stringify(payload));
  const data = enc.encode(`${head}.${body}`) as BufferSource;
  const sig = await crypto.subtle.sign(alg === "ES256" ? { name: "ECDSA", hash: "SHA-256" } : { name: "RSASSA-PKCS1-v1_5" }, key, data);
  return `${head}.${body}.${b64url(sig)}`;
}

export function decodeJwtPayload<T = Record<string, unknown>>(jwt: string): T {
  const part = jwt.split(".")[1];
  if (!part) throw new Error("jwt_malformed");
  return JSON.parse(new TextDecoder().decode(b64urlDecode(part))) as T;
}
