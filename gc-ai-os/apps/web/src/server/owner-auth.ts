const OWNER_TOKEN_SHA256 = "acfc0baca30f02edf7ee20743e7d283d0a47e5f3813978c78b570cd83128bab3";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function isOwnerToken(value: string | null | undefined): Promise<boolean> {
  if (!value) return false;
  return (await sha256Hex(value)) === OWNER_TOKEN_SHA256;
}

export const OWNER_COOKIE = "jarvis_session";
