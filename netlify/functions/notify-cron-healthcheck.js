// netlify/functions/notify-cron-healthcheck.js
//
// Surveillance basique de disponibilité ("Site indisponible", "Temps de
// réponse anormal") — tourne toutes les 10 minutes (voir netlify.toml).
// N'alerte qu'au CHANGEMENT d'état (voir service_health_state), jamais en
// boucle pendant toute la durée d'une panne : une panne de 2h avec un
// passage toutes les 10 minutes ne doit générer qu'une notification "down"
// puis une notification "rétabli", pas 12 notifications identiques.
//
// Pas une vraie stack d'observabilité (APM, alerting multi-région) — un
// simple ping HTTP depuis Netlify. Suffisant pour détecter une panne
// franche, pas pour du monitoring de production sérieux — voir
// docs/notifications-system.md.

const { supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { notifyAdmins, safeNotify } = require('./_lib/notifications/send');

const CHECK_NAME = 'site_homepage';
const TIMEOUT_MS = 8000;
const SLOW_THRESHOLD_MS = Number(process.env.SLOW_RESPONSE_THRESHOLD_MS || 3000);
const CONSECUTIVE_FAILURES_BEFORE_ALERT = 2; // absorbe un timeout ponctuel isolé

async function pingSite() {
  const url = process.env.SITE_URL || 'https://generationcapable.fr';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const r = await fetch(url, { signal: controller.signal, redirect: 'follow' });
    const latencyMs = Date.now() - startedAt;
    return { up: r.status < 500, statusCode: r.status, latencyMs };
  } catch (e) {
    return { up: false, statusCode: null, latencyMs: Date.now() - startedAt, error: String(e) };
  } finally {
    clearTimeout(timer);
  }
}

async function getState() {
  const r = await supabaseAdminRequest(`/rest/v1/service_health_state?check_name=eq.${CHECK_NAME}&select=*`);
  const rows = r.ok ? await r.json() : [];
  if (rows && rows[0]) return rows[0];
  return { check_name: CHECK_NAME, is_up: true, consecutive_failures: 0, last_latency_ms: null, slow_alerted_at: null };
}

async function saveState(state) {
  await supabaseAdminRequest('/rest/v1/service_health_state?on_conflict=check_name', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(state),
  });
}

// ── Contrôle croisé paiements / accès ────────────────────────────────────
//
// LA PANNE LA PLUS COÛTEUSE N'EST PAS UN SITE HORS LIGNE.
//   Un site hors ligne se voit tout de suite. Un client qui PAIE et n'obtient
//   pas son accès, lui, ne se voit pas : le paiement est encaissé, Stripe est
//   content, le site répond normalement — et personne n'apprend le problème
//   avant que le client n'écrive, en colère, plusieurs heures plus tard.
//
//   Ce cas survient si le webhook Stripe échoue durablement (secret changé,
//   Supabase indisponible au mauvais moment, bug d'écriture). Le ping de la
//   page d'accueil n'en verrait rien.
//
// PRINCIPE : toute vente encaissée doit correspondre à un abonné actif.
//   On tolère 20 minutes de décalage — le temps que le webhook arrive et que
//   Stripe fasse ses propres réessais — pour ne pas alerter sur un paiement
//   en cours de traitement.
const PAYMENT_GRACE_MINUTES = 20;

async function findPaidWithoutAccess() {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const until = new Date(Date.now() - PAYMENT_GRACE_MINUTES * 60 * 1000).toISOString();

  const r = await supabaseAdminRequest(
    `/rest/v1/sales?created_at=gte.${encodeURIComponent(since)}` +
    `&created_at=lte.${encodeURIComponent(until)}` +
    `&status=eq.completed&select=id,buyer_user_id,created_at&limit=200`
  );
  if (!r.ok) return [];
  const sales = await r.json();
  if (!Array.isArray(sales) || sales.length === 0) return [];

  const buyerIds = [...new Set(sales.map(s => s.buyer_user_id).filter(Boolean))];
  if (buyerIds.length === 0) return [];

  const subR = await supabaseAdminRequest(
    `/rest/v1/subscribers?user_id=in.(${buyerIds.join(',')})&is_active=eq.true&select=user_id`
  );
  if (!subR.ok) return [];
  const active = new Set(((await subR.json()) || []).map(s => s.user_id));

  return sales.filter(s => s.buyer_user_id && !active.has(s.buyer_user_id));
}

exports.handler = async () => {
  // Contrôlé à chaque passage (toutes les 10 minutes), indépendamment de la
  // disponibilité du site : les deux pannes n'ont rien à voir.
  try {
    const orphans = await findPaidWithoutAccess();
    if (orphans.length > 0) {
      console.error('[healthcheck] PAIEMENTS SANS ACCÈS', JSON.stringify(orphans.map(o => o.id)));
      await safeNotify(() => notifyAdmins({
        category: 'admin.technical.site_down',
        // Une alerte par heure au maximum tant que la situation dure : assez
        // pour ne pas passer inaperçu, pas assez pour noyer la boîte mail.
        eventKey: `paid_without_access:${new Date().toISOString().slice(0, 13)}`,
        ctx: {
          message: `${orphans.length} paiement(s) encaissé(s) sans accès actif — vérifier le webhook Stripe`,
        },
      }));
    }
  } catch (e) {
    // Ne doit jamais empêcher le contrôle de disponibilité qui suit.
    console.error('[healthcheck] Contrôle paiements/accès impossible', e);
  }

  const result = await pingSite();
  const state = await getState();

  if (!result.up) {
    const failures = (state.consecutive_failures || 0) + 1;
    const wasUp = state.is_up !== false;
    if (failures >= CONSECUTIVE_FAILURES_BEFORE_ALERT && wasUp) {
      await safeNotify(() => notifyAdmins({
        category: 'admin.technical.site_down',
        eventKey: `down:${new Date().toISOString().slice(0, 16)}`,
        ctx: {},
      }));
    }
    await saveState({
      check_name: CHECK_NAME,
      is_up: !(failures >= CONSECUTIVE_FAILURES_BEFORE_ALERT) ? state.is_up : false,
      consecutive_failures: failures,
      last_latency_ms: result.latencyMs,
      last_status_change: (failures >= CONSECUTIVE_FAILURES_BEFORE_ALERT && wasUp) ? new Date().toISOString() : state.last_status_change,
    });
    return jsonResponse(200, result);
  }

  // Site up — transition "rétabli" si on était marqué down.
  if (state.is_up === false) {
    await safeNotify(() => notifyAdmins({
      category: 'admin.technical.site_recovered',
      eventKey: `recovered:${new Date().toISOString().slice(0, 16)}`,
      ctx: {},
    }));
  }

  if (result.latencyMs > SLOW_THRESHOLD_MS) {
    const lastAlert = state.slow_alerted_at ? new Date(state.slow_alerted_at).getTime() : 0;
    if (Date.now() - lastAlert > 3600 * 1000) { // au plus une alerte lenteur par heure
      await safeNotify(() => notifyAdmins({
        category: 'admin.technical.slow_response',
        eventKey: `slow:${new Date().toISOString().slice(0, 13)}`,
        ctx: { latence: result.latencyMs },
      }));
      state.slow_alerted_at = new Date().toISOString();
    }
  }

  await saveState({
    check_name: CHECK_NAME,
    is_up: true,
    consecutive_failures: 0,
    last_latency_ms: result.latencyMs,
    last_status_change: state.is_up === false ? new Date().toISOString() : state.last_status_change,
    slow_alerted_at: state.slow_alerted_at || null,
  });

  return jsonResponse(200, result);
};
