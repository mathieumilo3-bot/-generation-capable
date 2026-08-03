// netlify/functions/_lib/notifications/send.js
//
// Moteur d'envoi central. Toute notification Push (vendeur ou admin) passe
// par sendToUser()/notifyAdmins() ci-dessous, qui appliquent dans l'ordre :
//   1. préférences (interrupteur général + catégorie précise)
//   2. fréquence choisie (normal / reduced / minimal)
//   3. déduplication (jamais deux fois le même évènement)
//   4. heures creuses (sauf catégories critiques — voir CRITICAL_CATEGORIES)
//   5. choix d'une variante jamais envoyée récemment à cet utilisateur
//   6. envoi Push à tous les abonnements actifs, révocation des abonnements
//      expirés (404/410)
// puis journalisent systématiquement le résultat dans notification_log,
// que l'envoi ait eu lieu ou non (avec la raison du skip) — c'est ce qui
// permet à l'admin de voir CE QUI a été décidé et pourquoi, pas seulement
// ce qui a été envoyé.
//
// Conçu pour être appelé "fire and forget" depuis des flux critiques
// (webhook Stripe) : aucune fonction ici ne doit jamais lever d'exception
// vers l'appelant — voir safeNotify() en bas de fichier.

const { supabaseAdminRequest, getAuthUserByEmail } = require('../supabase-admin');
const { TEMPLATES, CRITICAL_CATEGORIES } = require('./templates');
const { sendToSubscription } = require('./webpush');

const CHATTY_CATEGORIES = new Set([
  'seller.coach.goal_prompt',
  'seller.coach.midday_checkin',
  'seller.coach.no_activity_today',
]);

const DEFAULT_PREFS = {
  enabled: true,
  timezone: 'Europe/Paris',
  active_hours_start: 8,
  active_hours_end: 20,
  frequency: 'normal',
  categories: {},
};

async function getPreferences(userId) {
  const r = await supabaseAdminRequest(`/rest/v1/notification_preferences?user_id=eq.${userId}&select=*`);
  if (!r.ok) return { ...DEFAULT_PREFS, user_id: userId };
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0) return { ...DEFAULT_PREFS, user_id: userId };
  return { ...DEFAULT_PREFS, ...rows[0] };
}

function localHour(timezone, date = new Date()) {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hour12: false });
    return Number(fmt.format(date));
  } catch (e) {
    return date.getUTCHours();
  }
}

function localDateKey(timezone, date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(date); // YYYY-MM-DD
  } catch (e) {
    return date.toISOString().slice(0, 10);
  }
}

// Instant UTC correspondant à minuit dans le fuseau donné, pour le jour de
// `date`. Utilisé pour borner des requêtes "aujourd'hui" (ex: activité de
// prospection du jour) sans dépendre d'une librairie de fuseaux horaires.
function startOfLocalDayUTC(timezone, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const fakeUTC = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour) === 24 ? 0 : Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    const offsetMs = fakeUTC - date.getTime();
    const localMidnightFakeUTC = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 0, 0, 0);
    return new Date(localMidnightFakeUTC - offsetMs);
  } catch (e) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
  }
}

function isWithinActiveHours(prefs, date = new Date()) {
  const hour = localHour(prefs.timezone, date);
  const { active_hours_start: start, active_hours_end: end } = prefs;
  if (start === end) return true; // fenêtre dégénérée = pas de restriction
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end; // fenêtre traversant minuit
}

function isCategoryEnabled(prefs, category) {
  if (prefs.enabled === false) return false;
  const override = prefs.categories && prefs.categories[category];
  if (override === false) return false;
  if (prefs.frequency === 'minimal' && !CRITICAL_CATEGORIES.has(category)) return false;
  if (prefs.frequency === 'reduced' && CHATTY_CATEGORIES.has(category)) return false;
  return true;
}

async function alreadySent(audience, userId, category, eventKey) {
  const userFilter = userId ? `&user_id=eq.${userId}` : '&user_id=is.null';
  const r = await supabaseAdminRequest(
    `/rest/v1/notification_log?audience=eq.${audience}${userFilter}&category=eq.${encodeURIComponent(category)}&event_key=eq.${encodeURIComponent(eventKey)}&status=eq.sent&select=id&limit=1`
  );
  if (!r.ok) return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function recentVariants(userId, category, limit = 4) {
  const r = await supabaseAdminRequest(
    `/rest/v1/notification_log?user_id=eq.${userId}&category=eq.${encodeURIComponent(category)}&status=eq.sent&select=variant_key&order=created_at.desc&limit=${limit}`
  );
  if (!r.ok) return [];
  const rows = await r.json();
  return Array.isArray(rows) ? rows.map(r => r.variant_key).filter(Boolean) : [];
}

function pickVariant(pool, recentlyUsed) {
  const eligible = pool.map((_, i) => String(i)).filter(i => !recentlyUsed.includes(i));
  const candidates = eligible.length > 0 ? eligible : pool.map((_, i) => String(i));
  const idx = Number(candidates[Math.floor(Math.random() * candidates.length)]);
  return { idx, render: pool[idx] };
}

async function logNotification(row) {
  await supabaseAdminRequest('/rest/v1/notification_log', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
}

async function fetchActiveSubscriptions(userId) {
  const r = await supabaseAdminRequest(
    `/rest/v1/push_subscriptions?user_id=eq.${userId}&revoked_at=is.null&select=id,endpoint,p256dh,auth_key`
  );
  if (!r.ok) return [];
  const rows = await r.json();
  return Array.isArray(rows) ? rows : [];
}

async function revokeSubscription(id) {
  await supabaseAdminRequest(`/rest/v1/push_subscriptions?id=eq.${id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ revoked_at: new Date().toISOString() }),
  });
}

// Envoie (ou décide de ne pas envoyer) une notification à UN utilisateur.
// eventKey doit identifier l'évènement de façon unique et stable (ex:
// "sale:<sale_id>", "coach:morning:2026-08-02") pour que la déduplication
// fonctionne. ctx alimente le rendu du template (voir templates.js).
async function sendToUser({ userId, audience = 'user', category, eventKey, ctx = {} }) {
  const poolOrResolver = TEMPLATES[category];
  const pool = typeof poolOrResolver === 'function' ? poolOrResolver(ctx) : poolOrResolver;
  if (!pool || pool.length === 0) {
    console.error('[notifications] Catégorie inconnue:', category);
    return { status: 'unknown_category' };
  }

  const prefs = await getPreferences(userId);

  if (await alreadySent(audience, userId, category, eventKey)) {
    return { status: 'deduped' };
  }

  if (!isCategoryEnabled(prefs, category)) {
    await logNotification({
      audience, user_id: userId, category, event_key: eventKey,
      title: '', body: '', status: 'skipped_pref', metadata: ctx,
    });
    return { status: 'skipped_pref' };
  }

  if (!CRITICAL_CATEGORIES.has(category) && !isWithinActiveHours(prefs)) {
    await logNotification({
      audience, user_id: userId, category, event_key: eventKey,
      title: '', body: '', status: 'skipped_quiet_hours', metadata: ctx,
    });
    return { status: 'skipped_quiet_hours' };
  }

  const subscriptions = await fetchActiveSubscriptions(userId);
  if (subscriptions.length === 0) {
    await logNotification({
      audience, user_id: userId, category, event_key: eventKey,
      title: '', body: '', status: 'skipped_no_subscription', metadata: ctx,
    });
    return { status: 'skipped_no_subscription' };
  }

  const recent = await recentVariants(userId, category);
  const { idx, render } = pickVariant(pool, recent);
  const { title, body } = render(ctx);

  const payload = { title, body, tag: category, url: ctx.url || '/' };
  // "As-tu défini ton objectif aujourd'hui ? [Oui] [Plus tard]" — la seule
  // catégorie du système avec des boutons d'action directement dans la
  // notification (voir sw.js::notificationclick et le hook `gcGoal=yes`
  // lu par notifications-client.js au chargement de la page).
  if (category === 'seller.coach.goal_prompt') {
    payload.actions = [
      { action: 'goal_yes', title: 'Oui' },
      { action: 'goal_later', title: 'Plus tard' },
    ];
  }

  let anySent = false;
  for (const sub of subscriptions) {
    const result = await sendToSubscription(sub, payload);
    if (result.ok) anySent = true;
    else if (result.expired) await revokeSubscription(sub.id);
  }

  await logNotification({
    audience, user_id: userId, category, event_key: eventKey,
    variant_key: String(idx), title, body,
    status: anySent ? 'sent' : 'failed', metadata: ctx,
  });

  return { status: anySent ? 'sent' : 'failed', title, body };
}

let _adminUserIdsCache = null;
let _adminUserIdsCacheAt = 0;
async function resolveAdminUserIds() {
  if (_adminUserIdsCache && Date.now() - _adminUserIdsCacheAt < 5 * 60 * 1000) return _adminUserIdsCache;
  const r = await supabaseAdminRequest('/rest/v1/admins?select=email');
  const rows = r.ok ? await r.json() : [];
  const ids = [];
  for (const row of rows || []) {
    const user = await getAuthUserByEmail(row.email);
    if (user && user.id) ids.push(user.id);
  }
  _adminUserIdsCache = ids;
  _adminUserIdsCacheAt = Date.now();
  return ids;
}

// Diffuse une notification à TOUS les comptes admin (chacun avec ses
// propres préférences — "je veux pouvoir choisir quelles notifications
// activer ou désactiver").
async function notifyAdmins({ category, eventKey, ctx = {} }) {
  const adminIds = await resolveAdminUserIds();
  const results = await Promise.all(
    adminIds.map(userId => sendToUser({ userId, audience: 'admin', category, eventKey, ctx }))
  );
  return results;
}

// Wrapper "ne jamais planter l'appelant" — à utiliser systématiquement
// depuis les flux critiques (webhook Stripe, création de compte...).
async function safeNotify(fn) {
  try {
    await fn();
  } catch (e) {
    console.error('[notifications] safeNotify a intercepté une erreur (ignorée volontairement):', e);
  }
}

module.exports = {
  sendToUser,
  notifyAdmins,
  safeNotify,
  getPreferences,
  isWithinActiveHours,
  localHour,
  localDateKey,
  startOfLocalDayUTC,
  isCategoryEnabled,
};
