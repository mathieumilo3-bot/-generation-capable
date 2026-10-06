import { b64url, b64urlDecode } from "./jwt.ts";

/** AES-256-GCM pour les jetons Apple stockés (clé = 32 octets en base64 dans APPLE_TOKEN_ENC_KEY). */
async function key(base64Key: string): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new Error("enc_key_must_be_32_bytes");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string, base64Key: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(base64Key), new TextEncoder().encode(plain));
  return `${b64url(iv)}.${b64url(ct)}`;
}

export async function decryptSecret(blob: string, base64Key: string): Promise<string> {
  const [iv, ct] = blob.split(".");
  if (!iv || !ct) throw new Error("secret_malformed");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64urlDecode(iv) as BufferSource }, await key(base64Key), b64urlDecode(ct) as BufferSource);
  return new TextDecoder().decode(pt);
}

export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
