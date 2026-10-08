import { createHash } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import type { BrollSlot } from "@video-editor/shared-types";

/**
 * Sources vidéo AUTORISÉES pour le B-roll (usage commercial) : Pexels,
 * Pixabay, Wikimedia Commons (CC0 / CC-BY / CC-BY-SA / domaine public).
 * Chaque plan retourné porte ses droits (owner + license + proof) : le
 * rendu n'insère jamais un plan sans droits renseignés.
 *
 * Clés : PEXELS_API_KEY, PIXABAY_API_KEY (Wikimedia n'en demande pas).
 * Aucune clé → le fournisseur est simplement ignoré (jamais d'invention).
 */
export interface StockHit {
  provider: string;
  id: string;
  filePath: string;
  license: NonNullable<BrollSlot["license"]>;
}

export interface StockProvider {
  name: string;
  find(query: string, ctx: { cacheDir: string; used: Set<string>; minDurationSec: number }): Promise<StockHit | null>;
}

type Fetch = typeof fetch;

async function download(fetchFn: Fetch, url: string, file: string): Promise<void> {
  try {
    await access(file);
    return;
  } catch {
    /* pas en cache */
  }
  const r = await fetchFn(url);
  if (!r.ok) throw new Error(`téléchargement ${r.status} ${url}`);
  await writeFile(file, Buffer.from(await r.arrayBuffer()));
}

export function pexelsProvider(fetchFn: Fetch = fetch, apiKey = process.env.PEXELS_API_KEY): StockProvider | null {
  if (!apiKey) return null;
  return {
    name: "pexels",
    async find(query, ctx) {
      const r = await fetchFn(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=15`,
        { headers: { Authorization: apiKey } }
      );
      if (!r.ok) throw new Error(`Pexels ${r.status}`);
      const data = (await r.json()) as { videos?: Array<{ id: number; url: string; duration: number; user?: { name?: string }; video_files: Array<{ link: string; file_type: string; height: number }> }> };
      for (const v of data.videos ?? []) {
        if (ctx.used.has(`pexels:${v.id}`) || v.duration < ctx.minDurationSec) continue;
        const mp4 = v.video_files.filter((f) => f.file_type === "video/mp4");
        const f = mp4.filter((x) => x.height >= 1080).sort((a, b) => a.height - b.height)[0] ?? mp4[0];
        if (!f) continue;
        const filePath = join(ctx.cacheDir, `pexels-${v.id}.mp4`);
        await download(fetchFn, f.link, filePath);
        return {
          provider: "pexels",
          id: String(v.id),
          filePath,
          license: { provider: "pexels", owner: v.user?.name ?? "Pexels contributor", license: "Pexels License (usage commercial autorisé)", proof: v.url, attribution: null },
        };
      }
      return null;
    },
  };
}

export function pixabayProvider(fetchFn: Fetch = fetch, apiKey = process.env.PIXABAY_API_KEY): StockProvider | null {
  if (!apiKey) return null;
  return {
    name: "pixabay",
    async find(query, ctx) {
      const r = await fetchFn(`https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=20`);
      if (!r.ok) throw new Error(`Pixabay ${r.status}`);
      const data = (await r.json()) as { hits?: Array<{ id: number; pageURL: string; user: string; duration: number; videos: { large?: { url: string }; medium?: { url: string } } }> };
      for (const v of data.hits ?? []) {
        if (ctx.used.has(`pixabay:${v.id}`) || v.duration < ctx.minDurationSec) continue;
        const url = v.videos.large?.url || v.videos.medium?.url;
        if (!url) continue;
        const filePath = join(ctx.cacheDir, `pixabay-${v.id}.mp4`);
        await download(fetchFn, url, filePath);
        return {
          provider: "pixabay",
          id: String(v.id),
          filePath,
          license: { provider: "pixabay", owner: v.user, license: "Pixabay Content License (usage commercial autorisé)", proof: v.pageURL, attribution: null },
        };
      }
      return null;
    },
  };
}

const WIKIMEDIA_OK = /^(cc0|cc[- ]by(-sa)?|public domain|pd)/i;

export function wikimediaProvider(fetchFn: Fetch = fetch): StockProvider {
  return {
    name: "wikimedia",
    async find(query, ctx) {
      const api =
        "https://commons.wikimedia.org/w/api.php?format=json&origin=*&action=query&generator=search&gsrnamespace=6&gsrlimit=15" +
        "&prop=imageinfo&iiprop=url|extmetadata|mime|size&gsrsearch=" + encodeURIComponent(`${query} filetype:video`);
      const r = await fetchFn(api);
      if (!r.ok) throw new Error(`Wikimedia ${r.status}`);
      const data = (await r.json()) as { query?: { pages?: Record<string, { pageid: number; imageinfo?: Array<{ url: string; descriptionurl: string; mime: string; extmetadata: Record<string, { value: string }> }> }> } };
      for (const p of Object.values(data.query?.pages ?? {})) {
        const ii = p.imageinfo?.[0];
        if (!ii || !/^video\//.test(ii.mime) || ctx.used.has(`wikimedia:${p.pageid}`)) continue;
        const lic = ii.extmetadata.LicenseShortName?.value ?? "";
        if (!WIKIMEDIA_OK.test(lic)) continue; // licence non libre → ignoré
        const author = (ii.extmetadata.Artist?.value ?? "").replace(/<[^>]+>/g, "").trim() || "Wikimedia contributor";
        const filePath = join(ctx.cacheDir, `wm-${p.pageid}${ii.url.slice(ii.url.lastIndexOf("."))}`);
        await download(fetchFn, ii.url, filePath);
        return {
          provider: "wikimedia",
          id: String(p.pageid),
          filePath,
          license: { provider: "wikimedia", owner: author, license: lic, proof: ii.descriptionurl, attribution: `${author} — ${lic} — ${ii.descriptionurl}` },
        };
      }
      return null;
    },
  };
}

export function defaultStockProviders(fetchFn: Fetch = fetch): StockProvider[] {
  return [pexelsProvider(fetchFn), pixabayProvider(fetchFn), wikimediaProvider(fetchFn)].filter((p): p is StockProvider => p !== null);
}

export const hasRights = (l: BrollSlot["license"]): boolean => !!(l && l.owner && l.license && l.proof);

/**
 * Résout les slots B-roll encore vides auprès des sources autorisées.
 * Retourne les slots mis à jour + un registre (une ligne par plan).
 */
export async function resolveBrollFromStock(
  slots: BrollSlot[],
  opts: { cacheDir: string; providers?: StockProvider[] }
): Promise<{ slots: BrollSlot[]; ledger: Array<{ slotId: string; query: string; provider: string; id: string; filePath: string; license: StockHit["license"]; sha: string }>; warnings: string[] }> {
  const providers = opts.providers ?? defaultStockProviders();
  const warnings: string[] = [];
  const ledger: Awaited<ReturnType<typeof resolveBrollFromStock>>["ledger"] = [];
  if (providers.length === 0) {
    return { slots, ledger, warnings: ["B-roll stock : aucune clé PEXELS_API_KEY / PIXABAY_API_KEY, seule la bibliothèque locale est utilisée."] };
  }
  await mkdir(opts.cacheDir, { recursive: true });
  const used = new Set<string>();
  const out: BrollSlot[] = [];
  for (const slot of slots) {
    if (slot.resolvedSource) {
      out.push(slot);
      continue;
    }
    let hit: StockHit | null = null;
    for (const p of providers) {
      try {
        hit = await p.find(slot.query, { cacheDir: opts.cacheDir, used, minDurationSec: slot.durationSec });
      } catch (e) {
        warnings.push(`B-roll ${p.name} : ${(e as Error).message}`);
      }
      if (hit) break;
    }
    if (!hit || !hasRights(hit.license)) {
      out.push(slot);
      continue;
    }
    used.add(`${hit.provider}:${hit.id}`);
    const { readFile } = await import("node:fs/promises");
    const sha = createHash("sha256").update(await readFile(hit.filePath)).digest("hex").slice(0, 16);
    ledger.push({ slotId: slot.id, query: slot.query, provider: hit.provider, id: hit.id, filePath: hit.filePath, license: hit.license, sha });
    out.push({ ...slot, resolvedSource: "stock", resolvedMediaId: `${hit.provider}:${hit.id}`, resolvedPath: hit.filePath, license: hit.license });
  }
  return { slots: out, ledger, warnings };
}
