import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/** Chiffrement AES-256-GCM des tokens OAuth stockés en base. */

function key() {
  return Buffer.from(env().TOKEN_ENCRYPTION_KEY, "base64");
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith("v1:")) throw new Error("Format de secret inconnu");
  const raw = Buffer.from(payload.slice(3), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}
