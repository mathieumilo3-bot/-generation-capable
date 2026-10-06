import { createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { join, basename } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

/**
 * Anti-SSRF : le moteur ne télécharge QUE depuis des hôtes explicitement autorisés
 * (ENGINE_ALLOWED_INPUT_HOSTS, ex. « abcd.supabase.co »), en HTTPS, jamais vers une IP/loopback/privée.
 */
export function assertAllowedInputUrl(raw: string, env = process.env): URL {
  const u = new URL(raw);
  const allowed = (env.ENGINE_ALLOWED_INPUT_HOSTS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const devLocal = env.ENGINE_ALLOW_LOCAL_INPUTS === "true" && (u.hostname === "127.0.0.1" || u.hostname === "localhost");
  if (!devLocal) {
    if (u.protocol !== "https:") throw new Error("input_url_must_be_https");
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(u.hostname) || u.hostname === "localhost" || u.hostname.endsWith(".internal") || u.hostname.startsWith("[")) throw new Error("input_url_host_forbidden");
    const host = u.hostname.toLowerCase();
    if (!allowed.some((a) => host === a || host.endsWith("." + a))) throw new Error("input_url_host_not_allowed");
  }
  return u;
}

/** Nom de fichier sûr : jamais de chemin, jamais de séquence « .. ». */
export function safeFilename(name: string, fallback: string): string {
  const base = basename(name).replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "");
  return base.length > 0 ? base.slice(0, 120) : fallback;
}

export async function downloadTo(url: string, dest: string, o: { maxBytes: number; timeoutMs: number; fetchImpl?: typeof fetch }): Promise<number> {
  const u = assertAllowedInputUrl(url);
  await mkdir(join(dest, ".."), { recursive: true });
  const res = await (o.fetchImpl ?? fetch)(u, { signal: AbortSignal.timeout(o.timeoutMs), redirect: "error" });
  if (!res.ok || !res.body) throw new Error(`input_download_failed:${res.status}`);
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > o.maxBytes) throw new Error("input_too_large");
  try {
    let seen = 0;
    const limited = Readable.fromWeb(res.body as never);
    limited.on("data", (c: Buffer) => { seen += c.length; if (seen > o.maxBytes) limited.destroy(new Error("input_too_large")); });
    await pipeline(limited, createWriteStream(dest));
    return (await stat(dest)).size;
  } catch (e) {
    await rm(dest, { force: true });
    throw e;
  }
}
