// netlify/functions/admin-contract-templates.js
//
// Gestion des versions de contrat (Conformité → Contrats → Versions) —
// "je veux un système permettant plus tard de publier facilement une
// nouvelle version validée [...] v1, v2, v3, etc." Chaque signature reste
// reliée à la version EXACTE qu'elle a acceptée (contract_signatures.
// contract_version, jamais réécrite) — publier une nouvelle version ne
// touche jamais aux versions précédentes ni aux signatures déjà données.
//
// GET  /.netlify/functions/admin-contract-templates?role=vendeur|ambassadeur
//   → { templates: [{ version, is_current, published_at, change_notes }, ...] }
//
// POST /.netlify/functions/admin-contract-templates
//   { role, body, change_notes? }
//   → { ok: true, version }  (version suivante calculée automatiquement : v1, v2, v3...)

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { isAdminEmail } = require('./_lib/admin-check');

const ROLES = new Set(['vendeur', 'ambassadeur']);
const MAX_BODY_CHARS = 60_000;

function nextVersion(existingVersions) {
  const numbers = existingVersions
    .map(v => /^v(\d+)$/.exec(v))
    .filter(Boolean)
    .map(m => Number(m[1]));
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `v${max + 1}`;
}

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  const { id: adminUserId, email, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) return jsonResponse(401, { error: authError });
  if (!(await isAdminEmail(email))) return jsonResponse(403, { error: 'ADMIN_REQUIRED' });

  if (event.httpMethod === 'GET') {
    const role = (event.queryStringParameters || {}).role;
    if (!ROLES.has(role)) return jsonResponse(400, { error: 'INVALID_ROLE' });

    const r = await supabaseAdminRequest(
      `/rest/v1/contract_templates?role=eq.${role}&select=id,version,is_current,published_at,change_notes,body&order=published_at.desc`
    );
    const templates = r.ok ? await r.json() : [];
    return jsonResponse(200, { templates });
  }

  if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return jsonResponse(400, { error: 'INVALID_JSON' });
    }

    const role = payload.role;
    if (!ROLES.has(role)) return jsonResponse(400, { error: 'INVALID_ROLE' });
    const body = typeof payload.body === 'string' ? payload.body.trim() : '';
    if (body.length === 0 || body.length > MAX_BODY_CHARS) {
      return jsonResponse(400, { error: 'INVALID_BODY', message: `Le texte du contrat doit faire entre 1 et ${MAX_BODY_CHARS} caractères.` });
    }
    const changeNotes = typeof payload.change_notes === 'string' ? payload.change_notes.slice(0, 500) : null;

    const existingResp = await supabaseAdminRequest(`/rest/v1/contract_templates?role=eq.${role}&select=version`);
    const existingRows = existingResp.ok ? await existingResp.json() : [];
    const version = nextVersion((existingRows || []).map(r => r.version));

    // Désactive l'ancienne version courante AVANT d'insérer la nouvelle —
    // contract_templates_current_idx (index partiel) suppose au plus une
    // ligne is_current=true par rôle.
    await supabaseAdminRequest(`/rest/v1/contract_templates?role=eq.${role}&is_current=eq.true`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ is_current: false }),
    });

    const insertResp = await supabaseAdminRequest('/rest/v1/contract_templates', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ role, version, body, is_current: true, change_notes: changeNotes, published_by: adminUserId }),
    });
    if (!insertResp.ok) {
      const detail = await insertResp.text().catch(() => '');
      console.error('[admin-contract-templates] Échec publication', insertResp.status, detail);
      return jsonResponse(500, { error: 'PUBLISH_FAILED' });
    }

    await supabaseAdminRequest('/rest/v1/audit_logs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ event_type: 'contract_template_published', actor: `admin:${email}`, details: { role, version, change_notes: changeNotes } }),
    });

    return jsonResponse(200, { ok: true, version });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};
