/**
 * Test bout-en-bout de l'import cloud, sans réseau externe : des serveurs
 * locaux reproduisent les protocoles iCloud (sharedstreams + CloudKit),
 * Google Drive v3 et S3/R2, et servent de VRAIS fichiers vidéo/photo
 * générés par ffmpeg. Tout le reste est le code de production : parsing,
 * téléchargement repris, ffprobe, miniatures, pré-analyse, envoi
 * multipart vers R2, reprise automatique, sélection et matérialisation
 * des rushs pour le moteur de montage.
 *
 * Ce test NE prouve PAS qu'Apple accepte ces appels aujourd'hui — seul
 * `node dist/cli.js check <lien>` sur le serveur de production le prouve.
 *
 * Usage : node dist/test-e2e-import.js
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { Db } from "@video-editor/db";
import { probe } from "@video-editor/render/dist/ffmpeg.js";
import { R2ObjectStore } from "./object-store.js";
import { runImport } from "./import-runner.js";
import { IcloudSharedStreamsSource } from "./sources/icloud-sharedstreams.js";
import { IcloudCloudKitSource } from "./sources/icloud-cloudkit.js";
import { GoogleDriveSource } from "./sources/google-drive.js";
import { selectForMontage, createProjectFromLibrary, materializeLibraryRushes } from "./library-montage.js";

let failures = 0;
let passes = 0;
function check(cond: unknown, label: string): void {
  if (cond) {
    passes++;
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.log(`  ✗ ${label}`);
  }
}

const root = mkdtempSync(join(tmpdir(), "ve-ingest-e2e-"));
const mediaDir = join(root, "media");
execFileSync("mkdir", ["-p", mediaDir]);

function ff(args: string[]): void {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
}

console.log("[0] Génération de vrais fichiers média (ffmpeg)");
// Vidéo parlée-ish, bien exposée, en mouvement.
ff(["-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30:duration=8", "-f", "lavfi", "-i", "sine=frequency=330:duration=8", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", join(mediaDir, "IMG_0001.MOV")]);
// Vidéo nocturne inexploitable.
ff(["-f", "lavfi", "-i", "color=c=0x060606:size=1280x720:rate=30:duration=6", "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", join(mediaDir, "IMG_0002.MOV")]);
// Longue vidéo (> 45 s) : le montage ne doit en prendre que les passages utiles.
ff(["-f", "lavfi", "-i", "testsrc=size=1280x720:rate=24:duration=50", "-f", "lavfi", "-i", "sine=frequency=220:duration=50", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", join(mediaDir, "IMG_0003.MP4")]);
ff(["-f", "lavfi", "-i", "testsrc2=size=2048x1536", "-frames:v", "1", join(mediaDir, "IMG_0004.JPG")]);
ff(["-f", "lavfi", "-i", "smptebars=size=1600x1200", "-frames:v", "1", join(mediaDir, "IMG_0005.JPG")]);
ff(["-f", "lavfi", "-i", "smptebars=size=320x240", "-frames:v", "1", join(mediaDir, "thumb.jpg")]);
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const size = (p: string) => statSync(p).size;

// ---------------------------------------------------------------------------
// Serveur de contenu (CDN) : Range, coupure en plein transfert, 503, 404.
const contentHits: Record<string, { ranges: string[]; count: number }> = {};
const behaviour: Record<string, "cut-once" | "503-always" | "503-once" | "404" | "ok"> = {};
function serveFile(req: IncomingMessage, res: ServerResponse, name: string): void {
  const path = join(mediaDir, name);
  const hits = (contentHits[name] ??= { ranges: [], count: 0 });
  hits.count++;
  if (req.headers.range) hits.ranges.push(String(req.headers.range));
  const mode = behaviour[name] ?? "ok";
  if (mode === "404" || !existsSync(path)) {
    res.writeHead(404).end("not found");
    return;
  }
  if (mode === "503-always" || (mode === "503-once" && hits.count === 1)) {
    res.writeHead(503).end("busy");
    return;
  }
  const buf = readFileSync(path);
  const m = /bytes=(\d+)-/.exec(String(req.headers.range ?? ""));
  if (m) {
    const start = parseInt(m[1]!, 10);
    res.writeHead(206, { "content-type": "application/octet-stream", "content-length": buf.length - start, "content-range": `bytes ${start}-${buf.length - 1}/${buf.length}` });
    res.end(buf.subarray(start));
    return;
  }
  res.writeHead(200, { "content-type": "application/octet-stream", "content-length": buf.length });
  if (mode === "cut-once" && hits.count === 1) {
    // Coupure réseau à mi-fichier : le client doit reprendre avec Range.
    res.write(buf.subarray(0, Math.floor(buf.length / 2)), () => res.destroy());
    return;
  }
  res.end(buf);
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

function listen(handler: (req: IncomingMessage, res: ServerResponse) => unknown): Promise<{ server: Server; base: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      Promise.resolve(handler(req, res)).catch((err) => {
        res.writeHead(500).end(String(err));
      });
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }));
  });
}

// ---------------------------------------------------------------------------
// Faux S3/R2 (path-style) : PutObject, multipart, HeadObject, GetObject.
const objects = new Map<string, Buffer>();
const objectGets: Record<string, number> = {};
const uploads = new Map<string, Map<number, Buffer>>();
let multipartCompleted = 0;
const s3 = await listen(async (req, res) => {
  const url = new URL(req.url!, "http://x");
  const key = decodeURIComponent(url.pathname.replace(/^\/[^/]+\//, ""));
  const body = await readBody(req);
  if (req.method === "POST" && url.searchParams.has("uploads")) {
    const id = randomBytes(8).toString("hex");
    uploads.set(id, new Map());
    res.writeHead(200, { "content-type": "application/xml" }).end(`<?xml version="1.0" encoding="UTF-8"?><InitiateMultipartUploadResult><Bucket>b</Bucket><Key>${key}</Key><UploadId>${id}</UploadId></InitiateMultipartUploadResult>`);
    return;
  }
  const uploadId = url.searchParams.get("uploadId");
  if (req.method === "PUT" && uploadId) {
    uploads.get(uploadId)!.set(parseInt(url.searchParams.get("partNumber")!, 10), body);
    res.writeHead(200, { etag: `"${createHash("md5").update(body).digest("hex")}"` }).end();
    return;
  }
  if (req.method === "POST" && uploadId) {
    const parts = [...uploads.get(uploadId)!.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
    objects.set(key, Buffer.concat(parts));
    uploads.delete(uploadId);
    multipartCompleted++;
    res.writeHead(200, { "content-type": "application/xml" }).end(`<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUploadResult><Bucket>b</Bucket><Key>${key}</Key><ETag>"x"</ETag></CompleteMultipartUploadResult>`);
    return;
  }
  if (req.method === "DELETE" && uploadId) {
    uploads.delete(uploadId);
    res.writeHead(204).end();
    return;
  }
  if (req.method === "PUT") {
    objects.set(key, body);
    res.writeHead(200, { etag: '"x"' }).end();
    return;
  }
  const obj = objects.get(key);
  if (!obj) {
    res.writeHead(404, { "content-type": "application/xml" }).end(req.method === "HEAD" ? undefined : "<Error><Code>NoSuchKey</Code></Error>");
    return;
  }
  if (req.method === "HEAD") {
    res.writeHead(200, { "content-length": obj.length }).end();
    return;
  }
  objectGets[key] = (objectGets[key] ?? 0) + 1;
  res.writeHead(200, { "content-length": obj.length, "content-type": "application/octet-stream" }).end(obj);
});
const store = new R2ObjectStore({ endpoint: s3.base, accessKeyId: "test", secretAccessKey: "test", bucket: "client-media" });

// ---------------------------------------------------------------------------
// Faux iCloud sharedstreams.
const STREAM_FILES = ["IMG_0001.MOV", "IMG_0002.MOV", "IMG_0003.MP4", "IMG_0004.JPG", "IMG_0005.JPG", "IMG_9999.JPG"];
let webstreamCalls = 0;
const icloud = await listen(async (req, res) => {
  const url = new URL(req.url!, "http://x");
  if (url.pathname.startsWith("/content/")) return serveFile(req, res, decodeURIComponent(url.pathname.slice(9)));
  const body = JSON.parse((await readBody(req)).toString() || "{}");
  if (url.pathname.endsWith("/webstream")) {
    webstreamCalls++;
    if (webstreamCalls === 1) {
      res.writeHead(330, { "content-type": "application/json" }).end(JSON.stringify({ "X-Apple-MMe-Host": "p42-sharedstreams.icloud.com" }));
      return;
    }
    const photos = STREAM_FILES.map((f, i) => {
      const isVideo = /\.(MOV|MP4)$/.test(f);
      const p = join(mediaDir, f);
      const derivatives: Record<string, unknown> = isVideo
        ? { PosterFrame: { checksum: `poster-${i}`, fileSize: String(size(join(mediaDir, "thumb.jpg"))), width: "320", height: "240" }, "720p": { checksum: `c-${i}`, fileSize: String(size(p)), width: "1280", height: "720" } }
        : { "342": { checksum: `t-${i}`, fileSize: String(size(join(mediaDir, "thumb.jpg"))), width: "320", height: "240" }, "2049": { checksum: `c-${i}`, fileSize: existsSync(p) ? String(size(p)) : "5000000", width: "2048", height: "1536" } };
      return { photoGuid: `GUID${i}`, derivatives, ...(isVideo ? { mediaAssetType: "video" } : {}), dateCreated: "2026-10-01T10:00:00Z" };
    });
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ streamName: "Mariage Julie & Tom", photos }));
    return;
  }
  if (url.pathname.endsWith("/webasseturls")) {
    const i = parseInt(String(body.photoGuids[0]).replace("GUID", ""), 10);
    const host = new URL(icloud.base).host;
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({
        items: {
          [`c-${i}`]: { url_location: "loc1", url_path: `/content/${STREAM_FILES[i]}?o=signed` },
          [`poster-${i}`]: { url_location: "loc1", url_path: "/content/thumb.jpg" },
          [`t-${i}`]: { url_location: "loc1", url_path: "/content/thumb.jpg" },
        },
        locations: { loc1: { scheme: "http", hosts: [host] } },
      })
    );
    return;
  }
  res.writeHead(404).end();
});
const trustLocal = (u: string) => u.startsWith("http://127.0.0.1:");

// ---------------------------------------------------------------------------
console.log("\n[1] iCloud album partagé — MODE TEST sur 3 fichiers");
const db = new Db(join(root, "web.sqlite"));
behaviour["IMG_0001.MOV"] = "cut-once"; // coupure à mi-fichier
behaviour["IMG_0004.JPG"] = "503-once"; // CDN momentanément saturé
behaviour["IMG_9999.JPG"] = "404"; // fichier supprimé côté iCloud
const imp = db.createMediaImport({ userId: "u1", clientName: "Mariage Julie & Tom", sourceUrl: "https://www.icloud.com/sharedalbum/#B0aGWZuqDGKPZvv", provider: "icloud_shared_album", mode: "probe", sampleSize: 3 });
const streamSource = new IcloudSharedStreamsSource("B0aGWZuqDGKPZvv", { baseUrlOverride: icloud.base, trustUrl: trustLocal });
const workDir = join(root, "ingest-tmp");
const quiet = (m: string) => console.log(`    ${m}`);
const st1 = await runImport({ db, store, importId: imp.id, workDir, source: streamSource, concurrency: 2, log: quiet });
check(st1 === "sampled", `statut après test = sampled (obtenu ${st1})`);
check(webstreamCalls === 2, "redirection de partition HTTP 330 suivie");
let c = db.countMediaAssets(imp.id);
check(c.total === 6 && c.videos === 3 && c.photos === 3, `listage complet : ${c.total} fichiers, ${c.videos} vidéos, ${c.photos} photos`);
check(c.ready === 3 && c.pending === 3, `seulement 3 fichiers importés en mode test (${c.ready} prêts, ${c.pending} en attente)`);
const sampled = db.listMediaAssets(imp.id, { status: "ready" });
check(sampled.some((a) => a.kind === "photo") && sampled.filter((a) => a.kind === "video").length === 2, "échantillon = 2 vidéos + 1 photo");
const v1 = db.listMediaAssets(imp.id).find((a) => a.originalFilename === "IMG_0001.MOV");
check(Boolean(v1), "nom d'origine récupéré depuis l'URL iCloud (IMG_0001.MOV)");
check(contentHits["IMG_0001.MOV"]?.ranges.length === 1, `coupure réseau → reprise avec Range (${contentHits["IMG_0001.MOV"]?.ranges.join(",")})`);
check(v1?.sha256 === sha(join(mediaDir, "IMG_0001.MOV")), "empreinte SHA-256 identique à l'original après reprise");
check(v1?.objectKey && objects.get(v1.objectKey)?.equals(readFileSync(join(mediaDir, "IMG_0001.MOV"))), "original stocké dans R2 octet pour octet");
check(v1?.objectKey?.startsWith(`clients/mariage-julie-tom/${imp.id}/originals/`), `clé R2 rangée par client : ${v1?.objectKey}`);
check(v1?.kind === "video" && Math.abs((v1.durationSec ?? 0) - 8) < 0.3 && v1.width === 1280 && v1.videoCodec === "h264" && v1.hasAudio === true, `type/durée/format mesurés : ${v1?.kind} ${v1?.durationSec?.toFixed(2)}s ${v1?.width}x${v1?.height} ${v1?.videoCodec} ${v1?.container}`);
check(v1?.thumbKey && (objects.get(v1.thumbKey)?.length ?? 0) > 1000, "miniature JPEG générée et stockée dans R2");
check((v1?.analysis?.highlights.length ?? 0) > 0 && (v1?.analysis?.score ?? 0) > 0.6, `pré-analyse : score ${v1?.analysis?.score}, ${v1?.analysis?.highlights.length} passage(s) utile(s)`);
const v2 = db.listMediaAssets(imp.id).find((a) => a.externalId === "GUID1");
check(v2?.analysis?.tooDark === true, `vidéo nocturne détectée comme trop sombre (luma ${v2?.analysis?.brightness})`);
const photo = sampled.find((a) => a.kind === "photo");
check(photo?.width === 2048 && photo.durationSec === undefined, `photo reconnue : ${photo?.originalFilename} ${photo?.width}x${photo?.height}`);
check((contentHits["IMG_0004.JPG"]?.count ?? 0) >= 2 && photo?.originalFilename === "IMG_0004.JPG", "erreur 503 du CDN → nouvel essai automatique réussi");

console.log("\n[2] Feu vert → import COMPLET (les 3 fichiers déjà importés ne sont pas retéléchargés)");
const hitsBefore = contentHits["IMG_0001.MOV"]!.count;
behaviour["IMG_0005.JPG"] = "503-always"; // panne prolongée → reprise automatique plus tard
db.requeueMediaImport(imp.id, { mode: "full" });
db.updateMediaImport(imp.id, { status: "listing" });
const st2 = await runImport({ db, store, importId: imp.id, workDir, source: streamSource, concurrency: 3, inlineRetries: 1, retryDelayBaseMs: 1, log: quiet });
c = db.countMediaAssets(imp.id);
check(st2 === "partial", `statut = partial (obtenu ${st2}) : ${c.ready} prêts, ${c.failed} échec définitif, ${c.pending} en attente de reprise`);
check(contentHits["IMG_0001.MOV"]!.count === hitsBefore, "aucun retéléchargement des fichiers déjà prêts (idempotence)");
const missing = db.listMediaAssets(imp.id).find((a) => a.externalId === "GUID5");
check(missing?.status === "failed" && /404/.test(missing.error ?? ""), "fichier supprimé côté iCloud (404) → échec définitif, sans réessais inutiles");
const afterFull = db.getMediaImport(imp.id)!;
check(Boolean(afterFull.nextRetryAt), `reprise automatique programmée (${afterFull.nextRetryAt})`);

console.log("\n[3] Reprise automatique : le superviseur réclame l'import dès que la reprise est échue");
behaviour["IMG_0005.JPG"] = "ok";
await new Promise((r) => setTimeout(r, 20));
const claimed = db.claimNextMediaImport("test-worker");
check(claimed?.id === imp.id, "import réclamé pour reprise automatique");
const st3 = await runImport({ db, store, importId: imp.id, workDir, source: streamSource, log: quiet });
c = db.countMediaAssets(imp.id);
check(c.ready === 5 && c.failed === 1 && st3 === "partial", `après reprise : ${c.ready} prêts, ${c.failed} échec définitif (statut ${st3})`);

console.log("\n[4] Reprise après crash du worker (heartbeat perdu)");
const crashed = db.createMediaImport({ userId: "u1", clientName: "X", sourceUrl: "https://www.icloud.com/sharedalbum/#B0aGWZuqDGKPZvv", provider: "icloud_shared_album", mode: "full", sampleSize: 3 });
db.claimNextMediaImport("dead-worker");
const a = db.upsertMediaAsset({ importId: crashed.id, externalId: "e1", originalFilename: "a.mov", kind: "video", position: 0 });
db.markMediaAssetDownloading(a.id);
const rec = db.recoverStaleMediaImports(0);
check(rec.some((r) => r.id === crashed.id) && db.getMediaImport(crashed.id)?.status === "queued", "import orphelin remis en file");
check(db.getMediaAsset(a.id)?.status === "pending", "fichier en cours de téléchargement remis en attente");
db.updateMediaImport(crashed.id, { status: "cancelled" });

// ---------------------------------------------------------------------------
console.log("\n[5] iCloud lien de partage (CloudKit) — originaux, pagination, ${f}");
const ckFiles = ["IMG_0001.MOV", "IMG_0004.JPG", "IMG_0005.JPG"];
let resolveBody = "";
const ck = await listen(async (req, res) => {
  const url = new URL(req.url!, "http://x");
  if (url.pathname.startsWith("/ckcontent/")) return serveFile(req, res, decodeURIComponent(url.pathname.slice(11)));
  const body = (await readBody(req)).toString();
  if (url.pathname.endsWith("/public/records/resolve")) {
    resolveBody = body;
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({ results: [{ anonymousPublicAccess: { token: "anon-tok", databasePartition: `${ck.base}/` }, zoneID: { zoneName: "SharedSync-1", ownerRecordName: "_o" }, share: { fields: { "cloudkit.title": { value: "Séminaire Acme" } } } }] })
    );
    return;
  }
  if (url.pathname.endsWith("/shared/records/query")) {
    if (url.searchParams.get("publicAccessAuthToken") !== "anon-tok") {
      res.writeHead(401).end();
      return;
    }
    const q = JSON.parse(body);
    const page = q.continuationMarker ? 1 : 0;
    const files = page === 0 ? ckFiles.slice(0, 2) : ckFiles.slice(2);
    const records = files.flatMap((f) => {
      const id = f.replace(".", "_");
      const isVideo = f.endsWith(".MOV");
      return [
        { recordName: `A-${id}`, recordType: "CPLAsset", fields: { masterRef: { value: { recordName: `M-${id}` } }, assetDate: { value: 1759312800000 } } },
        {
          recordName: `M-${id}`,
          recordType: "CPLMaster",
          fields: {
            filenameEnc: { value: Buffer.from(f).toString("base64"), type: "ENCRYPTED_BYTES" },
            itemType: { value: isVideo ? "com.apple.quicktime-movie" : "public.jpeg" },
            resOriginalRes: { value: { downloadURL: `${ck.base}/ckcontent/\${f}`, size: size(join(mediaDir, f)), fileChecksum: "AAAA" } },
            resOriginalWidth: { value: isVideo ? 1280 : 2048 },
            resOriginalHeight: { value: isVideo ? 720 : 1536 },
            ...(isVideo ? {} : { resJPEGThumbRes: { value: { downloadURL: `${ck.base}/ckcontent/thumb.jpg`, size: 100 } } }),
          },
        },
      ];
    });
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ records, ...(page === 0 ? { continuationMarker: "page2" } : {}) }));
    return;
  }
  res.writeHead(404).end();
});
behaviour["IMG_0001.MOV"] = "ok";
behaviour["IMG_0004.JPG"] = "ok";
const thumbHitsBefore = contentHits["thumb.jpg"]?.count ?? 0;
const imp2 = db.createMediaImport({ userId: "u1", clientName: "Acme", sourceUrl: "https://share.icloud.com/photos/0aBcDeFgHiJkLmNoPq", provider: "icloud_link", mode: "full", sampleSize: 3 });
db.updateMediaImport(imp2.id, { status: "listing" });
const ckSource = new IcloudCloudKitSource("0aBcDeFgHiJkLmNoPq", "icloud_link", { ckBaseOverride: ck.base, trustPartition: (u) => u.startsWith(ck.base), trustUrl: trustLocal });
const st5 = await runImport({ db, store, importId: imp2.id, workDir, source: ckSource, log: quiet });
const ckAssets = db.listMediaAssets(imp2.id);
check(JSON.parse(resolveBody).shortGUIDs[0].value === "0aBcDeFgHiJkLmNoPq", "resolve CloudKit appelé avec le shortGUID du lien");
check(st5 === "completed" && ckAssets.length === 3, `${ckAssets.length} fichiers sur 2 pages, statut ${st5}`);
check(db.getMediaImport(imp2.id)?.sourceTitle === "Séminaire Acme", "titre du partage récupéré");
check(ckAssets.map((x) => x.originalFilename).join(",") === ckFiles.join(","), "noms d'origine décodés (filenameEnc)");
check(ckAssets[0]?.takenAt === new Date(1759312800000).toISOString(), "date de prise de vue reprise de CPLAsset");
check((contentHits["thumb.jpg"]?.count ?? 0) - thumbHitsBefore === 2, "miniatures des photos prises chez iCloud (compatibles HEIC)");

// ---------------------------------------------------------------------------
console.log("\n[6] Alternative Google Drive — dossier avec sous-dossier, fichier non média ignoré");
let keySeen = true;
const drive = await listen((req, res) => {
  const url = new URL(req.url!, "http://x");
  if (url.searchParams.get("key") !== "test-key") keySeen = false;
  const json = (o: unknown) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(o));
  if (url.pathname === "/files/ROOTFOLDER123") return json({ name: "Rushs client Durand", mimeType: "application/vnd.google-apps.folder" });
  if (url.pathname === "/files") {
    const q = url.searchParams.get("q") ?? "";
    if (q.includes("ROOTFOLDER123")) {
      return json({
        files: [
          { id: "FILEVIDEO001", name: "IMG_0003.MP4", mimeType: "video/mp4", size: String(size(join(mediaDir, "IMG_0003.MP4"))), videoMediaMetadata: { width: 1280, height: 720, durationMillis: "50000" } },
          { id: "SUBFOLDER0001", name: "Photos", mimeType: "application/vnd.google-apps.folder" },
          { id: "GDOC000000001", name: "Brief", mimeType: "application/vnd.google-apps.document" },
        ],
      });
    }
    if (q.includes("SUBFOLDER0001")) return json({ files: [{ id: "FILEPHOTO001", name: "IMG_0005.JPG", mimeType: "image/jpeg", size: String(size(join(mediaDir, "IMG_0005.JPG"))) }] });
  }
  if (url.pathname === "/files/FILEVIDEO001" && url.searchParams.get("alt") === "media") return serveFile(req, res, "IMG_0003.MP4");
  if (url.pathname === "/files/FILEPHOTO001" && url.searchParams.get("alt") === "media") return serveFile(req, res, "IMG_0005.JPG");
  res.writeHead(404).end("{}");
});
const imp3 = db.createMediaImport({ userId: "u1", clientName: "Durand", sourceUrl: "https://drive.google.com/drive/folders/ROOTFOLDER123", provider: "google_drive", mode: "full", sampleSize: 3 });
db.updateMediaImport(imp3.id, { status: "listing" });
const driveSource = new GoogleDriveSource("ROOTFOLDER123", { apiKey: "test-key", apiBaseOverride: drive.base });
const st6 = await runImport({ db, store, importId: imp3.id, workDir, source: driveSource, log: quiet });
const dAssets = db.listMediaAssets(imp3.id);
check(st6 === "completed" && dAssets.length === 2, `2 médias importés depuis Drive (Google Doc ignoré), statut ${st6}`);
check(keySeen, "clé d'API Drive transmise à chaque appel");
const longVideo = dAssets.find((x) => x.kind === "video");
check(Math.abs((longVideo?.durationSec ?? 0) - 50) < 0.5, `durée mesurée ${longVideo?.durationSec?.toFixed(1)}s`);

// ---------------------------------------------------------------------------
console.log("\n[7] Envoi R2 multipart d'un gros fichier (20 Mo, parts de 16 Mo)");
const big = join(root, "big.bin");
writeFileSync(big, randomBytes(20 * 1024 * 1024));
await store.putFile("clients/test/big.bin", big, "application/octet-stream");
check(multipartCompleted >= 1, "upload multipart utilisé");
check((await store.head("clients/test/big.bin")) === 20 * 1024 * 1024, "taille vérifiée par HeadObject");
await store.getToFile("clients/test/big.bin", join(root, "big.back"));
check(sha(join(root, "big.back")) === sha(big), "relecture identique (GetObject)");
check((await store.presignGet("clients/test/big.bin"))?.includes("X-Amz-Signature"), "URL signée temporaire générée (lecture des miniatures sans transiter par le serveur)");

// ---------------------------------------------------------------------------
console.log("\n[8] Montages depuis la bibliothèque — 2 montages, mêmes fichiers, aucune ré-importation");
const allAssets = [...db.listMediaAssets(imp.id), ...db.listMediaAssets(imp3.id)];
const plans = selectForMontage(allAssets);
const rushesNamed = () => db.listMediaAssets(imp.id, { status: "ready" }).every((x) => !x.originalFilename.startsWith("GUID"));
check(!plans.some((p) => p.asset.analysis?.tooDark), "sélection automatique : la vidéo nocturne est écartée");
const cut = plans.find((p) => p.asset.id === longVideo?.id);
check(rushesNamed(), "noms d'origine conservés après relecture de la source");
check(cut?.startSec !== undefined, `vidéo de 50 s réduite à ses passages utiles (${plans.filter((p) => p.asset.id === longVideo?.id).map((p) => `${p.startSec}-${p.endSec}s`).join(", ")})`);
const storageRoot = join(root, "storage");
const projA = createProjectFromLibrary(db, { userId: "u1", title: "Teaser 30s", plans, storageRoot });
const projB = createProjectFromLibrary(db, { userId: "u1", title: "Version longue", plans: selectForMontage(allAssets, { assetIds: [longVideo!.id, v1!.id] }), storageRoot });
const getsBefore = { ...objectGets };
await materializeLibraryRushes(db, store, projA.id, storageRoot, quiet);
await materializeLibraryRushes(db, store, projB.id, storageRoot, quiet);
const rushesA = db.listRushesByProject(projA.id);
const rushesB = db.listRushesByProject(projB.id);
check(rushesA.length === plans.length && rushesB.length >= 2, `rushs créés : ${rushesA.length} (montage A), ${rushesB.length} (montage B)`);
let allOk = true;
for (const r of [...rushesA, ...rushesB]) {
  const info = await probe(r.storagePath);
  if (Math.abs(info.durationSec - r.durationSec) > 0.6) {
    allOk = false;
    console.log(`    rush ${r.storagePath}: ${info.durationSec}s vs ${r.durationSec}s attendus`);
  }
}
check(allOk, "chaque rush est lisible par ffprobe avec la durée prévue (extraits compris)");
const v1Gets = (objectGets[v1!.objectKey!] ?? 0) - (getsBefore[v1!.objectKey!] ?? 0);
check(v1Gets === 1, `l'original IMG_0001.MOV n'est descendu de R2 qu'une fois pour 2 montages (${v1Gets})`);
check(db.listProjectsForMediaImport(imp.id).length === 2, "les 2 montages sont rattachés à l'import");
await materializeLibraryRushes(db, store, projA.id, storageRoot, quiet);
check((objectGets[v1!.objectKey!] ?? 0) - (getsBefore[v1!.objectKey!] ?? 0) === 1, "relancer un montage ne retélécharge rien");
check(!existsSync(join(workDir, imp.id)) || readdirSync(join(workDir, imp.id)).length === 0, "aucun fichier temporaire laissé sur le disque du serveur");

db.close();
for (const s of [s3, icloud, ck, drive]) s.server.close();
if (process.env.KEEP_E2E_DIR !== "1") rmSync(root, { recursive: true, force: true });
else console.log(`\nDossier conservé : ${root}`);
console.log(`\n${failures === 0 ? "✅ OK" : "❌ ÉCHEC"} — ${passes} assertions passées, ${failures} en échec`);
if (failures > 0) process.exitCode = 1;
