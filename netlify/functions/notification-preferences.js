// netlify/functions/notification-preferences.js
//
// Lit/écrit les préférences de notification du compte authentifié
// (interrupteur général, horaires, fréquence, catégories) — "chaque
// utilisateur peut activer/désactiver, choisir les horaires, la fréquence,
// les catégories". Le jeu de catégories proposé dépend du rôle (admin vs
// vendeur), déterminé ici (table "admins"), jamais fait confiance côté client.
//
// GET  /.netlify/functions/notification-preferences
//   Authorization: Bearer <session_token>
//   → { preferences, availableCategories: [{ key, label }] }
//
// POST /.netlify/functions/notification-preferences
//   Authorization: Bearer <session_token>
//   { enabled, timezone, active_hours_start, active_hours_end, frequency, categories }
//   → { ok: true }

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { CATEGORY_LABELS, SELLER_CATEGORIES, ADMIN_CATEGORIES } = require('./_lib/notifications/templates');
const { isAdminEmail } = require('./_lib/admin-check');

const DEFAULT_PREFS = {
  enabled: true,
  timezone: 'Europe/Paris',
  active_hours_start: 8,
  active_hours_end: 20,
  frequency: 'normal',
  categories: {},
};

const VALID_FREQUENCIES = new Set(['normal', 'reduced', 'minimal']);

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  const { id: userId, email, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) {
    return jsonResponse(401, { error: authError });
  }

  if (event.httpMethod === 'GET') {
    const admin = await isAdminEmail(email);
    const categoryKeys = admin ? [...ADMIN_CATEGORIES, ...SELLER_CATEGORIES] : SELLER_CATEGORIES;
    const availableCategories = categoryKeys.map(key => ({ key, label: CATEGORY_LABELS[key] || key }));

    const r = await supabaseAdminRequest(`/rest/v1/notification_preferences?user_id=eq.${userId}&select=*`);
    const rows = r.ok ? await r.json() : [];
    const preferences = { ...DEFAULT_PREFS, ...(rows && rows[0] ? rows[0] : {}) };

    return jsonResponse(200, { preferences, availableCategories, isAdmin: admin });
  }

  if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return jsonResponse(400, { error: 'INVALID_JSON' });
    }

    const frequency = VALID_FREQUENCIES.has(payload.frequency) ? payload.frequency : 'normal';
    const start = Number.isInteger(payload.active_hours_start) ? Math.min(23, Math.max(0, payload.active_hours_start)) : 8;
    const end = Number.isInteger(payload.active_hours_end) ? Math.min(23, Math.max(0, payload.active_hours_end)) : 20;
    const timezone = typeof payload.timezone === 'string' && payload.timezone.length <= 64 ? payload.timezone : 'Europe/Paris';
    const enabled = payload.enabled !== false;

    // Ne garde que des booléens pour des clés de catégorie connues — jamais
    // un objet arbitraire venant du client stocké tel quel en base.
    const categories = {};
    if (payload.categories && typeof payload.categories === 'object') {
      for (const key of Object.keys(CATEGORY_LABELS)) {
        if (key in payload.categories) categories[key] = payload.categories[key] !== false;
      }
    }

    const r = await supabaseAdminRequest('/rest/v1/notification_preferences?on_conflict=user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: userId, enabled, timezone,
        active_hours_start: start, active_hours_end: end,
        frequency, categories, updated_at: new Date().toISOString(),
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[notification-preferences] Erreur écriture', r.status, detail);
      return jsonResponse(200, { error: 'SUPABASE_WRITE_ERROR' });
    }
    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};
