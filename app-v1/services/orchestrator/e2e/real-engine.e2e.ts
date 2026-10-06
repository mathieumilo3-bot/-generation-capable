/**
 * E2E RÉEL : Postgres (schéma de prod) → RPC client (hold) → orchestrateur → passerelle HTTP → moteur
 * (FFmpeg + Remotion) → livraison → capture → révision. Aucun mock du moteur.
 * Lancer : npm run e2e -w @app/orchestrator   (≈ 3–10 min selon la machine ; nécessite ffmpeg + Chromium Remotion)
 */
import { execFileSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream, mkdirSync, mkdtempSync, statSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHttpEngineClient } from "@app/video-engine";
import { loadConfig } from "../src/config.ts";
import { MemoryBlobs } from "../src/blobs.ts";
import { Orchestrator } from "../src/orchestrator.ts";
import { PgStore } from "../src/pg-store.ts";
import { startPg } from "../test/pg-harness.ts";

const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);
const assert = (c: unknown, m: string) => { if (!c) throw new Error("E2E ÉCHEC : " + m); log("  ✓", m); };
const ENGINE_DIR = resolve(import.meta.dirname, "../../../../video-editor/apps/web");
const work = mkdtempSync(join(tmpdir(), "e2e-"));
const TOKEN = "e2e-token-" + "x".repeat(24);
const GW = 3197, FILES = 3198;

// 1. Rushs réels (vertical 9:16, vidéo + audio) générés par FFmpeg.
mkdirSync(join(work, "files"), { recursive: true });
const clip = (name: string, hue: number) => execFileSync("ffmpeg", ["-y", "-f", "lavfi", "-i", `testsrc2=size=1080x1920:rate=30,hue=h=${hue}`, "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
  "-t", "9", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", join(work, "files", name)], { stdio: "ignore" });
clip("rush1.mp4", 0); clip("rush2.mp4", 120);
const fileServer = createServer((req, res) => {
  const p = join(work, "files", (req.url ?? "").split("?")[0]!.split("/").pop()!);
  if (!existsSync(p)) { res.statusCode = 404; res.end(); return; }
  res.setHeader("content-length", statSync(p).size); createReadStream(p).pipe(res);
}).listen(FILES, "127.0.0.1");

// 2. Passerelle + moteur réels (Next).
const gw = spawn(join(ENGINE_DIR, "node_modules/.bin/next"), ["start", "-p", String(GW)], {
  cwd: ENGINE_DIR, stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, ENGINE_GATEWAY_TOKEN: TOKEN, ENGINE_ALLOWED_INPUT_HOSTS: "x.supabase.co", ENGINE_ALLOW_LOCAL_INPUTS: "true",
    VIDEO_EDITOR_STORAGE_ROOT: join(work, "storage"), VIDEO_EDITOR_MAX_CONCURRENT_JOBS: "1", RENDER_PROFILE: "fast", NODE_ENV: "production" },
});
gw.stderr.on("data", (d) => { const s = String(d); if (/error/i.test(s)) process.stderr.write("[gateway] " + s); });
const stopAll = async () => { gw.kill("SIGTERM"); fileServer.close(); };
process.on("exit", () => gw.kill("SIGKILL"));

try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://127.0.0.1:${GW}/api/engine/v1/capabilities`, { headers: { authorization: `Bearer ${TOKEN}` } })).ok) break; } catch { /* démarrage */ } await new Promise((r) => setTimeout(r, 1000)); }
  const engine = createHttpEngineClient({ baseUrl: `http://127.0.0.1:${GW}`, token: TOKEN, timeoutMs: 30_000 });

  // Sécurité de la passerelle.
  assert((await fetch(`http://127.0.0.1:${GW}/api/engine/v1/capabilities`)).status === 401, "passerelle fermée sans jeton");
  assert((await fetch(`http://127.0.0.1:${GW}/api/engine/v1/capabilities`, { headers: { authorization: "Bearer mauvais" } })).status === 401, "passerelle fermée avec un mauvais jeton");
  const caps = await engine.capabilities();
  assert(caps.autonomous_creation === false && Array.isArray(caps.aspect_ratios), "capacités réelles publiées (création autonome absente)");

  // 3. Base + scénario produit (vraies RPC).
  const pg = await startPg();
  const store = new PgStore(pg.pool);
  const q = (s: string, p: unknown[] = []) => pg.pool.query(s, p);
  const uid = (await q("insert into auth.users (email) values ('e2e@t.test') returning id")).rows[0].id as string;
  const wallet = (await q("select id from public.wallets where user_id=$1", [uid])).rows[0].id as string;
  await q("select public.svc_payment_settle((public.svc_payment_upsert('stripe','pi_e2e',$1,'topup',2640,'succeeded','web')).id)", [wallet]);
  const c = await pg.pool.connect();
  await c.query(`select set_config('request.jwt.claim.sub','${uid}', false)`);
  const proj = (await c.query("select public.create_draft_project('E2E pub') as id")).rows[0].id as string;
  const names: string[] = [];
  for (const f of ["rush1.mp4", "rush2.mp4"]) {
    const size = statSync(join(work, "files", f)).size;
    const a = (await c.query("select public.register_asset($1,'raw',$2,'video/mp4',$3,9) as r", [proj, f, size])).rows[0].r;
    await q("insert into storage.objects (bucket_id,name,metadata) values ('raw',$1,$2)", [a.path, JSON.stringify({ size })]);
    await c.query("select public.complete_asset($1)", [a.asset_id]);
    names.push(f);
  }
  const rule = (await q("select id from public.pricing_rules where mode='edit_rushes' and bucket_key='lt_30s'")).rows[0].id;
  const meth = (await q("select id from public.editing_methods where slug='automatique'")).rows[0].id;
  await q("update public.app_settings set value='true' where key='features.revisions'");
  await q("update public.app_settings set value='false' where key='features.third_party_ai'");
  const sub = (await c.query("select public.submit_video_job($1,$2,$3,'9:16','Rythme dynamique, pub produit',$4) as r", [proj, rule, meth, "e2e-key-" + uid])).rows[0].r;
  assert(sub.ok && sub.price_cents === 242, "job créé au prix serveur 2,42 €");
  const job = sub.job_id as string;
  assert((await q("select held_cents h from public.wallets where id=$1", [wallet])).rows[0].h === "242", "montant réservé (hold)");

  // 4. Orchestrateur réel → passerelle réelle.
  const blobs = new MemoryBlobs();
  blobs.signedDownloadUrl = async (_b, p) => `http://127.0.0.1:${FILES}/${p.split("/").pop()!}`;
  const cfg = loadConfig({ SUPABASE_URL: "https://x.supabase.co", SB_SECRET_KEY: "sb_secret_xxxxxxxxxxxxxx", ENGINE_URL: `http://127.0.0.1:${GW}`, ENGINE_TOKEN: TOKEN,
    STATUS_POLL_MS: "2000", ENGINE_PURGE_AFTER_DELIVERY: "false", JOB_TIMEOUT_MS: String(25 * 60_000), LEASE_SECONDS: "900" });
  const orch = new Orchestrator({ store, engine, blobs, cfg, log: (l, m, d) => { if (l !== "info") log(`[orch:${l}]`, m, JSON.stringify(d ?? {})); } });
  await orch.syncCapabilities();
  let lastP = -1;
  const watcher = setInterval(async () => { const r = (await q("select status, progress from public.video_jobs where id=$1", [job])).rows[0]; if (r && r.progress !== lastP) { lastP = r.progress; log(`  job: ${r.status} ${r.progress}%`); } }, 4000);
  const t0 = Date.now();
  await orch.drain();
  clearInterval(watcher);
  log(`rendu terminé en ${Math.round((Date.now() - t0) / 1000)} s`);

  const j = (await q("select status, error_code from public.video_jobs where id=$1", [job])).rows[0];
  if (j.status !== "completed") { const ev = await q("select level, stage, message from public.job_events where job_id=$1 order by id", [job]); console.log(ev.rows); throw new Error(`job non terminé : ${j.status} ${j.error_code}`); }
  assert(true, "job complété par le vrai moteur");
  const w1 = (await q("select balance_cents b, held_cents h from public.wallets where id=$1", [wallet])).rows[0];
  assert(w1.b === "2398" && w1.h === "0", "montant encaissé (26,40 − 2,42 = 23,98 €), rien de réservé");
  const ver = (await q("select render_path, duration_sec, width, height from public.project_versions where id=$1", [sub.version_id])).rows[0];
  const bytes = blobs.files.get(`renders/${ver.render_path}`)!;
  assert(bytes && bytes.length > 10_000, `MP4 livré dans le storage privé (${bytes?.length} octets)`);
  const out1 = join(work, "v1.mp4"); writeFileSync(out1, bytes);
  const probe = (f: string) => JSON.parse(execFileSync("ffprobe", ["-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", f]).toString());
  const p1 = probe(out1); const v1 = p1.streams.find((s: { codec_type: string }) => s.codec_type === "video");
  assert(v1.codec_name === "h264" && v1.width === 1080 && v1.height === 1920, `sortie réelle 1080×1920 h264 (${v1.codec_name} ${v1.width}x${v1.height})`);
  assert(p1.streams.some((s: { codec_type: string }) => s.codec_type === "audio"), "piste audio présente");
  const d1 = Number(p1.format.duration);
  assert(d1 > 3 && d1 <= 30, `durée ${d1.toFixed(1)} s ≤ palier payé (30 s)`);
  assert([...blobs.files.keys()].some((k) => k.startsWith("thumbnails/")), "miniature livrée");
  const cost = (await q("select total_actual_cost_micro t, revenue_cents r from public.usage_costs where job_id=$1", [job])).rows[0];
  log("  coûts:", JSON.stringify(cost));

  // 5. Révision (version 2) via commande supportée.
  const ver1 = (await q("select current_version_id v from public.projects where id=$1", [proj])).rows[0].v;
  const rev = (await c.query("select public.submit_revision($1,$2,'Raccourcis la vidéo',$3) as r", [proj, ver1, "e2e-rev-" + uid])).rows[0].r;
  assert(rev.ok, "révision créée (version 2, prix serveur)");
  await orch.drain();
  const rj = (await q("select status, error_code from public.video_jobs where id=$1", [rev.job_id])).rows[0];
  if (rj.status !== "completed") { console.log((await q("select level, stage, message from public.job_events where job_id=$1 order by id", [rev.job_id])).rows); throw new Error(`révision non terminée : ${rj.status} ${rj.error_code}`); }
  const vers = (await q("select version_number n, status, parent_version_id p, render_path from public.project_versions where project_id=$1 order by version_number", [proj])).rows;
  assert(vers.length === 2 && vers[0].status === "ready" && vers[1].status === "ready" && vers[1].p === ver1, "version 2 liée à la version 1 (parent_version_id), version 1 intacte");
  const out2 = join(work, "v2.mp4"); writeFileSync(out2, blobs.files.get(`renders/${vers[1].render_path}`)!);
  const d2 = Number(probe(out2).format.duration);
  assert(d2 < d1, `la version 2 est plus courte (${d2.toFixed(1)} s < ${d1.toFixed(1)} s)`);
  const w2 = (await q("select balance_cents b, held_cents h from public.wallets where id=$1", [wallet])).rows[0];
  assert(w2.b === "2277" && w2.h === "0", "révision facturée 1,21 € (23,98 − 1,21 = 22,77 €)");
  await pg.pool.query("select 1"); c.release();
  log("✅ E2E RÉEL RÉUSSI");
  await pg.stop();
  await stopAll();
  process.exit(0);
} catch (e) {
  console.error("❌", (e as Error).message);
  await stopAll();
  process.exit(1);
}
