// netlify/functions/admin-compliance.js
//
// Back-office "Contrats à valider" : liste, détail d'un dossier, et actions
// de validation/refus (contrat / document / RIB). Toute vérification de
// droit admin est faite CÔTÉ BASE (is_current_user_admin(), voir les
// fonctions RPC appelées ici) — jamais seulement côté Netlify Function.
//
// GET  /.netlify/functions/admin-compliance?action=list
//   → { dossiers: [...] }  (admin_list_compliance_dossiers())
// GET  /.netlify/functions/admin-compliance?action=detail&userId=...&role=...
//   → { dossier: {...} }  (admin_get_compliance_dossier())
// POST /.netlify/functions/admin-compliance
//   { action: 'set_contract_status'|'set_document_status'|'set_payment_status',
//     id, status: 'validated'|'refused'|'pending', notes? }
//   → { ok: true }

const { verifySessionToken, supabaseAdminRequest, jsonResponse, SUPABASE_URL } = require('./_lib/supabase-admin');
const { notifyAdmins, safeNotify } = require('./_lib/notifications/send');
const { signedUrl } = require('./_lib/compliance/storage');

const STATUS_ACTIONS = {
  set_contract_status: 'admin_set_contract_status',
  set_document_status: 'admin_set_document_status',
  set_payment_status: 'admin_set_payment_info_status',
};
const RPC_PARAM_NAMES = {
  set_contract_status: 'p_signature_id',
  set_document_status: 'p_document_id',
  set_payment_status: 'p_payment_id',
};

async function callRpc(authHeader, anonKey, fnName, params) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: authHeader },
    body: JSON.stringify(params),
  });
  const data = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, data };
}

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  const { error: authError } = await verifySessionToken(event, anonKey);
  if (authError) return jsonResponse(401, { error: authError });
  const authHeader = event.headers.authorization || event.headers.Authorization;

  if (event.httpMethod === 'GET') {
    const qs = event.queryStringParameters || {};

    if (qs.action === 'list') {
      const { ok, status, data } = await callRpc(authHeader, anonKey, 'admin_list_compliance_dossiers', {});
      if (!ok) return jsonResponse(status === 400 ? 403 : 200, { error: 'RPC_ERROR', detail: data });
      return jsonResponse(200, { dossiers: data });
    }

    if (qs.action === 'detail') {
      if (!qs.userId || !qs.role) return jsonResponse(400, { error: 'MISSING_PARAMS' });
      const { ok, status, data } = await callRpc(authHeader, anonKey, 'admin_get_compliance_dossier', {
        p_user_id: qs.userId, p_role: qs.role,
      });
      if (!ok) return jsonResponse(status === 400 ? 403 : 200, { error: 'RPC_ERROR', detail: data });

      // Enrichit avec des URLs signées à courte durée — jamais de chemin
      // Storage brut renvoyé au client, encore moins une URL publique.
      if (data && Array.isArray(data.signatures)) {
        for (const s of data.signatures) {
          s.pdf_url = await signedUrl(s.contract_pdf_path, 600).catch(() => null);
        }
      }
      if (data && Array.isArray(data.documents)) {
        for (const d of data.documents) {
          d.url = await signedUrl(d.storage_path, 600).catch(() => null);
        }
      }

      return jsonResponse(200, { dossier: data });
    }

    return jsonResponse(400, { error: 'UNKNOWN_ACTION' });
  }

  if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return jsonResponse(400, { error: 'INVALID_JSON' });
    }

    const fnName = STATUS_ACTIONS[payload.action];
    if (!fnName) return jsonResponse(400, { error: 'UNKNOWN_ACTION' });
    if (!['validated', 'refused', 'pending'].includes(payload.status)) {
      return jsonResponse(400, { error: 'INVALID_STATUS' });
    }
    if (!payload.id) return jsonResponse(400, { error: 'MISSING_ID' });

    const params = {
      [RPC_PARAM_NAMES[payload.action]]: payload.id,
      p_status: payload.status,
      p_notes: typeof payload.notes === 'string' ? payload.notes.slice(0, 500) : null,
    };
    const { ok, status, data } = await callRpc(authHeader, anonKey, fnName, params);
    if (!ok) {
      console.error('[admin-compliance] RPC échouée', fnName, status, JSON.stringify(data));
      return jsonResponse(status === 400 ? 403 : 200, { error: 'RPC_ERROR', detail: data });
    }

    // Après une validation, vérifie si le dossier vient de passer à 100% —
    // notification dédiée (déduplication naturelle : ne se déclenche qu'une
    // fois par dossier grâce à l'event_key basé sur user/role, voir send.js).
    if (payload.status === 'validated') {
      await safeNotify(async () => {
        const table = payload.action === 'set_contract_status' ? 'contract_signatures'
          : payload.action === 'set_document_status' ? 'compliance_documents' : 'payment_info';
        const row = await supabaseAdminRequest(`/rest/v1/${table}?id=eq.${payload.id}&select=user_id,role`);
        const rows = row.ok ? await row.json() : [];
        const target = rows && rows[0];
        if (!target) return;
        const check = await callRpc(authHeader, anonKey, 'admin_get_compliance_dossier', { p_user_id: target.user_id, p_role: target.role });
        if (check.ok && check.data && check.data.score === 100) {
          const emailResp = await supabaseAdminRequest(`/auth/v1/admin/users/${target.user_id}`);
          const emailData = emailResp.ok ? await emailResp.json() : null;
          await notifyAdmins({
            category: 'admin.compliance.dossier_complete',
            eventKey: `dossier_complete:${target.user_id}:${target.role}`,
            ctx: { email: emailData && emailData.email, role: target.role },
          });
        }
      });
    }

    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};
