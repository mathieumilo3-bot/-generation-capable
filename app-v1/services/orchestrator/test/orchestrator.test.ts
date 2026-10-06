import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { FakeEngine, EngineError, type EngineClient } from "@app/video-engine";
import { MemoryBlobs } from "../src/blobs.ts";
import { loadConfig } from "../src/config.ts";
import { Orchestrator } from "../src/orchestrator.ts";
import { PgStore } from "../src/pg-store.ts";
import { sendPushes } from "../src/push.ts";
import { runRetention } from "../src/retention.ts";
import { pgAvailable, startPg, type PgHarness } from "./pg-harness.ts";

const d = pgAvailable ? describe : describe.skip;
let h: PgHarness;
let store: PgStore;
beforeAll(async () => {
  if (!pgAvailable) return;
  h = await startPg(); store = new PgStore(h.pool);
  // Ces scénarios testent l'orchestration ; le consentement IA est couvert par supabase/tests/60_ai_consent.test.sql.
  await h.pool.query("update public.app_settings set value='false' where key='features.third_party_ai'");
}, 60_000);
afterAll(async () => { if (h) await h.stop(); });

const cfg = (over: Record<string, string> = {}) => loadConfig({
  SUPABASE_URL: "https://x.supabase.co", SB_SECRET_KEY: "sb_secret_xxxxxxxxxxxxxx", ENGINE_URL: "http://engine", ENGINE_TOKEN: "t".repeat(32),
  CONCURRENCY: "2", STATUS_POLL_MS: "1", LEASE_SECONDS: "600", WORKER_ID: "test-worker", ...over,
});

/** Crée utilisateur + solde + brouillon + 1 rush uploadé, puis soumet la vidéo via les VRAIES RPC client. */
async function scenario(opts: { topupCents?: number; instructions?: string; method?: string } = {}) {
  const q = (sql: string, p: unknown[] = []) => h.pool.query(sql, p);
  const email = `u${Math.random().toString(36).slice(2)}@t.test`;
  const uid = (await q("insert into auth.users (email) values ($1) returning id", [email])).rows[0].id as string;
  const wallet = (await q("select id from public.wallets where user_id=$1", [uid])).rows[0].id as string;
  const pay = (await q("select (public.svc_payment_upsert('stripe',$1,$2,'topup',$3,'succeeded','web')).id as id", [`pi_${uid}`, wallet, opts.topupCents ?? 2640])).rows[0].id;
  await q("select public.svc_payment_settle($1)", [pay]);
  const as = async <T>(fn: () => Promise<T>) => { const c = await h.pool.connect(); try { await c.query(`select set_config('request.jwt.claim.sub','${uid}', false)`); return await fn(); } finally { await c.query("select set_config('request.jwt.claim.sub','',false)"); c.release(); } };
  const c = await h.pool.connect();
  try {
    await c.query(`select set_config('request.jwt.claim.sub','${uid}', false)`);
    const proj = (await c.query("select public.create_draft_project('Pub') as id")).rows[0].id as string;
    const a = (await c.query("select public.register_asset($1,'raw','rush.mp4','video/mp4',1000,12.5) as r", [proj])).rows[0].r;
    await c.query("insert into storage.objects (bucket_id,name,metadata) values ('raw',$1,'{\"size\":1000}')", [a.path]);
    await c.query("select public.complete_asset($1)", [a.asset_id]);
    const rule = (await c.query("select id from public.pricing_rules where mode='edit_rushes' and bucket_key='30_60s'")).rows[0].id;
    const meth = (await c.query("select id from public.editing_methods where slug=$1", [opts.method ?? "automatique"])).rows[0].id;
    const sub = (await c.query("select public.submit_video_job($1,$2,$3,'9:16',$4,$5) as r", [proj, rule, meth, opts.instructions ?? null, `key-${uid}-1`])).rows[0].r;
    if (!sub.ok) throw new Error("scenario submit refused: " + JSON.stringify(sub));
    return { uid, wallet, proj, job: sub.job_id as string, version: sub.version_id as string, c, release: () => c.release(), as };
  } catch (e) { c.release(); throw e; }
}
const wal = async (id: string) => (await h.pool.query("select balance_cents b, held_cents h from public.wallets where id=$1", [id])).rows[0] as { b: string; h: string };
const jobRow = async (id: string) => (await h.pool.query("select status, progress, error_code, attempt_count from public.video_jobs where id=$1", [id])).rows[0];
const mk = (engine: EngineClient, blobs = new MemoryBlobs(), over: Record<string, string> = {}) =>
  ({ blobs, orch: new Orchestrator({ store, engine, blobs, cfg: cfg(over), log: () => undefined }) });

d("orchestrateur ⇄ moteur ⇄ Postgres (schéma réel)", () => {
  it("rendu réussi : livré, encaissé une fois, version prête, coûts, notification", async () => {
    const s = await scenario(); s.release();
    const engine = new FakeEngine({ videoBytes: new Uint8Array(2048).fill(7) });
    const { orch, blobs } = mk(engine);
    await orch.syncCapabilities();
    await orch.drain();
    expect((await jobRow(s.job)).status).toBe("completed");
    expect((await jobRow(s.job)).progress).toBe(100);
    expect(await wal(s.wallet)).toEqual({ b: "2156", h: "0" });
    expect(blobs.files.get(`renders/${s.uid}/${s.proj}/${s.version}/render.mp4`)?.length).toBe(2048);
    expect(blobs.files.has(`thumbnails/${s.uid}/${s.proj}/${s.version}.jpg`)).toBe(true);
    const ver = (await h.pool.query("select status, render_path, duration_sec from public.project_versions where id=$1", [s.version])).rows[0];
    expect(ver).toMatchObject({ status: "ready", render_path: `${s.uid}/${s.proj}/${s.version}/render.mp4` });
    const cost = (await h.pool.query("select llm_cost_micro l, revenue_cents r from public.usage_costs where job_id=$1", [s.job])).rows[0];
    expect(Number(cost.l)).toBe(92000);            // 0,10 $ × 0,92
    expect(Number(cost.r)).toBe(484);
    expect((await h.pool.query("select count(*)::int n from public.notifications where user_id=$1 and kind='video_ready'", [s.uid])).rows[0].n).toBe(1);
    // Le moteur a reçu une URL signée (jamais un chemin brut) et le bon style.
    expect(engine.submitted[0]).toMatchObject({ externalJobId: s.job, presetId: "preset_dynamic_social", aspectRatio: "9:16" });
    expect(engine.submitted[0]!.inputs[0]!.url).toMatch(/^memory:\/\/raw\//);
    expect(engine.submitted[0]!.inputs[0]!.role).toBe("rush");
  });

  it("échec moteur définitif : le montant réservé est libéré, aucun encaissement", async () => {
    const s = await scenario(); s.release();
    const engine = new FakeEngine({ failWith: { code: "render_crashed", message: "boom", retryable: false } });
    await mk(engine).orch.drain();
    expect(await jobRow(s.job)).toMatchObject({ status: "failed", error_code: "render_crashed" });
    expect(await wal(s.wallet)).toEqual({ b: "2640", h: "0" });
    expect((await h.pool.query("select count(*)::int n from public.wallet_transactions where job_id=$1 and type='release'", [s.job])).rows[0].n).toBe(1);
    expect((await h.pool.query("select count(*)::int n from public.wallet_transactions where job_id=$1 and type='capture'", [s.job])).rows[0].n).toBe(0);
    expect((await h.pool.query("select body from public.notifications where user_id=$1 and kind='job_failed'", [s.uid])).rows[0].body).toBe("Aucun montant n'a été prélevé.");
  });

  it("échec temporaire : retry sans nouveau rendu, un seul encaissement", async () => {
    const s = await scenario(); s.release();
    const real = new FakeEngine();
    let n = 0;
    const flaky: EngineClient = { ...bind(real), submit: async (r) => { if (n++ === 0) throw new EngineError("server", "503", 503); return real.submit(r); } };
    const { orch } = mk(flaky);
    await orch.claimOnce(); await orch.idle();
    expect(await jobRow(s.job)).toMatchObject({ status: "queued", attempt_count: 1 });
    expect(await wal(s.wallet)).toEqual({ b: "2640", h: "484" });          // le hold reste pendant le retry
    await h.pool.query("update public.video_jobs set next_attempt_at = now() where id=$1", [s.job]);
    await orch.drain();
    expect((await jobRow(s.job)).status).toBe("completed");
    expect(await wal(s.wallet)).toEqual({ b: "2156", h: "0" });
    expect(real.submitted).toHaveLength(1);
  });

  it("réseau moteur instable pendant le suivi : le job survit", async () => {
    const s = await scenario(); s.release();
    const { orch } = mk(new FakeEngine({ flakyStatus: 5 }));
    await orch.drain();
    expect((await jobRow(s.job)).status).toBe("completed");
  });

  it("orchestrateur tué en plein rendu : bail expiré → relancé, résultat unique, un seul encaissement", async () => {
    const s = await scenario(); s.release();
    const engine = new FakeEngine();
    // Premier orchestrateur : réclame puis « meurt » (la promesse ne se termine jamais).
    const hang: EngineClient = { ...bind(engine), status: () => new Promise(() => undefined) };
    const first = mk(hang, new MemoryBlobs(), { STATUS_POLL_MS: "1" });
    await first.orch.claimOnce();
    await new Promise((r) => setTimeout(r, 20));
    expect((await jobRow(s.job)).status).toBe("preparing");
    await h.pool.query("update public.video_jobs set locked_until = now() - interval '1 minute' where id=$1", [s.job]);
    expect(await store.requeueStale()).toBeGreaterThanOrEqual(1);
    await h.pool.query("update public.video_jobs set next_attempt_at = now() where id=$1", [s.job]);
    await mk(engine).orch.drain();
    expect((await jobRow(s.job)).status).toBe("completed");
    expect(engine.submitted).toHaveLength(1);                                   // re-soumission idempotente
    expect(await wal(s.wallet)).toEqual({ b: "2156", h: "0" });
  });

  it("annulation demandée pendant le rendu : moteur stoppé, montant libéré", async () => {
    const s = await scenario(); s.release();
    const engine = new FakeEngine({ script: Array.from({ length: 40 }, () => ({ stage: "editing" as const, progress: 30 })) });
    const { orch } = mk(engine, new MemoryBlobs(), { STATUS_POLL_MS: "5" });
    await orch.claimOnce();
    await new Promise((r) => setTimeout(r, 40));
    const c = await h.pool.connect();
    await c.query(`select set_config('request.jwt.claim.sub','${s.uid}', false)`);
    const r = (await c.query("select public.cancel_video_job($1) as r", [s.job])).rows[0].r;
    c.release();
    expect(r.cancel_requested).toBe(true);
    await orch.idle();
    expect((await jobRow(s.job)).status).toBe("cancelled");
    expect(engine.cancelled).toHaveLength(1);
    expect(await wal(s.wallet)).toEqual({ b: "2640", h: "0" });
  });

  it("révision (réglage activé) : texte libre mappé sur les commandes supportées ; non supporté → échec propre, rien prélevé", async () => {
    await h.pool.query("update public.app_settings set value='true' where key='features.revisions'");
    const s = await scenario(); s.release();
    const engine = new FakeEngine();
    const { orch } = mk(engine, new MemoryBlobs(), { ENGINE_PURGE_AFTER_DELIVERY: "false" });
    await orch.syncCapabilities();
    await orch.drain();
    const as = async (sql: string, p: unknown[]) => { const c = await h.pool.connect(); try { await c.query(`select set_config('request.jwt.claim.sub','${s.uid}', false)`); return (await c.query(sql, p)).rows[0].r; } finally { c.release(); } };
    const ver1 = (await h.pool.query("select current_version_id v from public.projects where id=$1", [s.proj])).rows[0].v;

    const ok = await as("select public.submit_revision($1,$2,$3,$4) as r", [s.proj, ver1, "Raccourcis l'intro et plus de zooms", "rev-ok-" + s.uid]);
    await orch.drain();
    expect((await jobRow(ok.job_id)).status).toBe("completed");
    expect(engine.submitted.at(-1)!.revision!.commands.sort()).toEqual(["more_zooms", "shorter"]);
    expect(engine.submitted.at(-1)!.revision!.parentExternalJobId).toBe(s.job);

    const before = await wal(s.wallet);
    const bad = await as("select public.submit_revision($1,$2,$3,$4) as r", [s.proj, ver1, "Change la musique en jazz", "rev-bad-" + s.uid]);
    await orch.drain();
    expect(await jobRow(bad.job_id)).toMatchObject({ status: "failed", error_code: "revision_unsupported" });
    expect(await wal(s.wallet)).toEqual(before);
    expect((await h.pool.query("select status from public.projects where id=$1", [s.proj])).rows[0].status).toBe("ready");   // la version 1 reste lisible
  });

  it("modifications désactivées par défaut : refusées côté serveur, rien n'est réservé", async () => {
    await h.pool.query("update public.app_settings set value='false' where key='features.revisions'");
    const s = await scenario(); s.release();
    const { orch } = mk(new FakeEngine());
    await orch.drain();
    const c = await h.pool.connect();
    await c.query(`select set_config('request.jwt.claim.sub','${s.uid}', false)`);
    const ver = (await h.pool.query("select current_version_id v from public.projects where id=$1", [s.proj])).rows[0].v;
    const r = (await c.query("select public.submit_revision($1,$2,'plus court',$3) as r", [s.proj, ver, "rev-off-" + s.uid])).rows[0].r;
    c.release();
    expect(r).toEqual({ ok: false, code: "revisions_disabled" });
    expect(await wal(s.wallet)).toEqual({ b: "2156", h: "0" });
  });

  it("conservation : fichiers du moteur purgés après livraison", async () => {
    const s = await scenario(); s.release();
    const engine = new FakeEngine();
    await mk(engine).orch.drain();
    expect(engine.purged).toHaveLength(1);
  });

  it("conservation 24 h : vidéo expirée supprimée du Storage et marquée expirée ; objet déjà absent toléré", async () => {
    const s = await scenario(); s.release();
    const { orch, blobs } = mk(new FakeEngine());
    await orch.drain();
    const path = `renders/${s.uid}/${s.proj}/${s.version}/render.mp4`;
    expect(blobs.files.has(path)).toBe(true);
    // Pas encore expirée : rien ne bouge.
    expect(await runRetention(store, blobs)).toMatchObject({ versions: 0 });
    expect(blobs.files.has(path)).toBe(true);
    await h.pool.query("update public.project_versions set expires_at = now() - interval '1 minute' where id=$1", [s.version]);
    // Un objet déjà supprimé à la main ne doit pas bloquer la purge.
    const failing = Object.assign(Object.create(blobs), { remove: async (b: string, p: string) => { if (p.endsWith(".jpg")) throw new Error("Object not found"); return blobs.remove(b, p); } });
    expect(await runRetention(store, failing)).toMatchObject({ versions: 1 });
    expect(blobs.files.has(path)).toBe(false);
    const v = (await h.pool.query("select status, render_path from public.project_versions where id=$1", [s.version])).rows[0];
    expect(v).toEqual({ status: "expired", render_path: null });
    expect(await runRetention(store, blobs)).toMatchObject({ versions: 0 });                // idempotent
  });

  it("conservation 24 h : fichiers envoyés trop anciens supprimés, jamais ceux d'un job actif", async () => {
    const s = await scenario(); s.release();                       // job en file (actif) : ses rushs doivent survivre
    const blobs = new MemoryBlobs();
    await h.pool.query("update public.assets set created_at = now() - interval '48 hours' where project_id=$1", [s.proj]);
    expect(await runRetention(store, blobs)).toMatchObject({ assets: 0 });
    expect((await h.pool.query("select status from public.assets where project_id=$1", [s.proj])).rows[0].status).toBe("uploaded");
    await mk(new FakeEngine(), blobs).orch.drain();                // job terminé → plus protégé
    expect(await runRetention(store, blobs)).toMatchObject({ assets: 1 });
    expect(blobs.removed.some((x) => x.startsWith("raw/"))).toBe(true);
  });

  it("deux orchestrateurs en parallèle ne traitent jamais le même job", async () => {
    const a = await scenario(); a.release(); const b = await scenario(); b.release();
    const engine = new FakeEngine();
    const o1 = mk(engine).orch, o2 = mk(engine).orch;
    await Promise.all([o1.drain(), o2.drain()]);
    expect((await jobRow(a.job)).status).toBe("completed");
    expect((await jobRow(b.job)).status).toBe("completed");
    expect(engine.submitted.filter((r) => r.externalJobId === a.job)).toHaveLength(1);
    expect(await wal(a.wallet)).toEqual({ b: "2156", h: "0" });
  });

  it("capacités incomplètes du moteur : ignorées, les capacités publiées restent intactes", async () => {
    const bad: EngineClient = { ...bind(new FakeEngine()), capabilities: async () => ({ autonomous_creation: true }) };
    await mk(bad).orch.syncCapabilities();
    const caps = (await h.pool.query("select capabilities c from public.engine_capabilities where active")).rows[0].c;
    expect(caps.autonomous_creation).toBe(false);
    expect(caps.aspect_ratios).toEqual(["9:16"]);
  });

  it("capacités du moteur synchronisées (création autonome absente)", async () => {
    const { orch } = mk(new FakeEngine());
    await orch.syncCapabilities();
    const caps = (await h.pool.query("select capabilities c from public.engine_capabilities where active")).rows[0].c;
    expect(caps.autonomous_creation).toBe(false);
  });

  it("push : envoie via Expo, marque envoyé, supprime un jeton mort", async () => {
    const s = await scenario(); s.release();
    await h.pool.query("insert into public.push_tokens (user_id, token, platform) values ($1,'ExponentPushToken[abc]','ios')", [s.uid]);
    await h.pool.query("update public.notifications set push_sent_at = now() where user_id=$1 and push_sent_at is null", [s.uid]);
    await h.pool.query("select private.notify($1,'info','Test','Corps','{}'::jsonb,'t1')", [s.uid]);
    const f = vi.fn(async () => Response.json({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }] }));
    expect(await sendPushes(store, { fetchImpl: f as unknown as typeof fetch })).toBe(1);
    expect(JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body)[0]).toMatchObject({ to: "ExponentPushToken[abc]", title: "Test" });
    await new Promise((r) => setTimeout(r, 30));
    expect((await h.pool.query("select count(*)::int n from public.push_tokens where user_id=$1", [s.uid])).rows[0].n).toBe(0);
    expect(await sendPushes(store, { fetchImpl: f as unknown as typeof fetch })).toBe(0);
  });
});

function bind(e: FakeEngine): EngineClient {
  return { capabilities: () => e.capabilities(), submit: (r) => e.submit(r), status: (i) => e.status(i), cancel: (i) => e.cancel(i), result: () => e.result(), thumbnail: () => e.thumbnail(), purge: (i) => e.purge(i) };
}
