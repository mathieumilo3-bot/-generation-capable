// earn-agent — hub of the autonomous Superteam Earn agent.
//
//   POST /tick      (x-earn-agent-token)  30-min cycle from pg_cron: register,
//                                         discover, score, enqueue, ingest, submit, track
//   POST /register  (x-earn-agent-token)  one-off registration (idempotent)
//   POST /ingest    (public, throttled)   pulls finished deliverables from the
//                                         workspace branch and submits them
//   GET  /status    (public)              agent, pipeline, ledger, heartbeat — no secrets
//   GET  /queue     (public)              work order for the AI worker
//   GET  /heartbeat (public)              heartbeat.md format
//
// Verify-JWT is off: protected routes check the Vault-held token instead.

import { EarnClient } from './lib/earn.ts';
import { GitHubWorkspace } from './lib/github.ts';
import { PgStore } from './lib/pg_store.ts';
import { buildQueue, buildStatus, ensureRegistered, getSettings, tick, type Deps } from './lib/pipeline.ts';
import { safeEqual } from './lib/text.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const store = new PgStore(Deno.env.get('SUPABASE_DB_URL')!);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });

async function deps(): Promise<Deps> {
  const s = await getSettings(store);
  return {
    store,
    earn: new EarnClient(null, Deno.env.get('EARN_BASE_URL') ?? 'https://superteam.fun'),
    github: new GitHubWorkspace(s.repoOwner, s.repoName, s.branch),
    log: (m) => console.log(`[earn-agent] ${m}`),
  };
}

async function authorized(req: Request): Promise<boolean> {
  const given = req.headers.get('x-earn-agent-token') ?? '';
  const expected = await store.getSecret('earn_agent_cron_token');
  return Boolean(expected) && safeEqual(given, expected!);
}

/** Long work keeps running after the response so pg_net never times out on it. */
function background(req: Request, work: () => Promise<unknown>) {
  if (new URL(req.url).searchParams.get('sync') === '1' || typeof EdgeRuntime === 'undefined') {
    return work().then((r) => json(r));
  }
  EdgeRuntime.waitUntil(work().catch((e) => console.error('[earn-agent] background', e)));
  return Promise.resolve(json({ accepted: true }, 202));
}

Deno.serve(async (req) => {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const route = parts[parts.indexOf('earn-agent') + 1] ?? '';
  try {
    if (req.method === 'OPTIONS') return json({}, 204);
    if (req.method === 'GET' && route === 'status') return json(await buildStatus(await deps()));
    if (req.method === 'GET' && route === 'queue') return json(await buildQueue(await deps()));
    if (req.method === 'GET' && route === 'heartbeat') return json((await buildStatus(await deps())).heartbeat);
    if (req.method === 'POST' && route === 'tick') {
      if (!(await authorized(req))) return json({ error: 'unauthorized' }, 401);
      const d = await deps();
      return background(req, () => tick(d, 'tick'));
    }
    if (req.method === 'POST' && route === 'register') {
      if (!(await authorized(req))) return json({ error: 'unauthorized' }, 401);
      const { identity, created } = await ensureRegistered(await deps());
      return json({ created, agent: identity });
    }
    if (req.method === 'POST' && route === 'ingest') {
      // Public on purpose (called by the workspace workflow): it only reads the
      // branch head we resolve ourselves; throttled to one run per minute.
      if (!(await store.tryLock('ingest_ping', 60))) return json({ throttled: true }, 429);
      const d = await deps();
      return background(req, () => tick(d, 'ingest'));
    }
    if (req.method === 'GET' && route === '') {
      return json({ service: 'earn-agent', routes: ['GET /status', 'GET /queue', 'GET /heartbeat', 'POST /ingest'] });
    }
    return json({ error: 'not found' }, 404);
  } catch (e) {
    console.error('[earn-agent]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
