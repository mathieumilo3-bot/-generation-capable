import { createHash, timingSafeEqual } from "node:crypto";

// High-entropy owner token. Only its SHA-256 digest is stored in source control.
// The raw token is intentionally not persisted by the application.
const OWNER_TOKEN_SHA256 = "acfc0baca30f02edf7ee20743e7d283d0a47e5f3813978c78b570cd83128bab3";

export function isOwnerToken(value: string | null | undefined): boolean {
  if (!value) return false;
  const actual = createHash("sha256").update(value).digest();
  const expected = Buffer.from(OWNER_TOKEN_SHA256, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const OWNER_COOKIE = "jarvis_session";
