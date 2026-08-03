// netlify/functions/compliance-payment-info.js
//
// Coordonnées bancaires (RIB/IBAN/BIC). Append-only : chaque enregistrement
// crée une NOUVELLE ligne plutôt que d'écraser la précédente (voir
// 0015_compliance_contracts.sql) — l'historique des RIB successifs doit
// rester consultable, et "chaque modification doit créer une notification
// administrateur" implique qu'un changement n'est jamais silencieux.
//
// GET  /.netlify/functions/compliance-payment-info?role=vendeur|ambassadeur
//   → { current: {...}|null, history: [...] }
//
// POST /.netlify/functions/compliance-payment-info
//   { role, iban, bic, bank_name, account_holder }
//   → { ok: true }

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { notifyAdmins, safeNotify } = require('./_lib/notifications/send');

const ROLES = new Set(['vendeur', 'ambassadeur']);
const IBAN_RE = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/;
const BIC_RE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

function maskIban(iban) {
  if (!iban || iban.length < 8) return iban;
  return iban.slice(0, 4) + ' •••• •••• ' + iban.slice(-4);
}

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  const { id: userId, email, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) return jsonResponse(401, { error: authError });

  if (event.httpMethod === 'GET') {
    const role = (event.queryStringParameters || {}).role;
    if (!ROLES.has(role)) return jsonResponse(400, { error: 'INVALID_ROLE' });

    const r = await supabaseAdminRequest(
      `/rest/v1/payment_info?user_id=eq.${userId}&role=eq.${role}&select=id,iban,bic,bank_name,account_holder,created_at,admin_status,admin_notes&order=created_at.desc`
    );
    const rows = r.ok ? await r.json() : [];
    const masked = (rows || []).map(row => ({ ...row, iban: maskIban(row.iban) }));
    return jsonResponse(200, { current: masked[0] || null, history: masked });
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

    const iban = typeof payload.iban === 'string' ? payload.iban.replace(/\s+/g, '').toUpperCase() : '';
    const bic = typeof payload.bic === 'string' ? payload.bic.replace(/\s+/g, '').toUpperCase() : '';
    const bankName = typeof payload.bank_name === 'string' ? payload.bank_name.trim().slice(0, 100) : null;
    const accountHolder = typeof payload.account_holder === 'string' ? payload.account_holder.trim().slice(0, 150) : '';

    if (!IBAN_RE.test(iban)) return jsonResponse(400, { error: 'INVALID_IBAN', message: 'IBAN invalide.' });
    if (!BIC_RE.test(bic)) return jsonResponse(400, { error: 'INVALID_BIC', message: 'BIC/SWIFT invalide.' });
    if (accountHolder.length === 0) return jsonResponse(400, { error: 'MISSING_ACCOUNT_HOLDER' });

    const insertResp = await supabaseAdminRequest('/rest/v1/payment_info', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ user_id: userId, role, iban, bic, bank_name: bankName, account_holder: accountHolder }),
    });
    if (!insertResp.ok) {
      const detail = await insertResp.text().catch(() => '');
      console.error('[compliance-payment-info] Échec écriture', insertResp.status, detail);
      return jsonResponse(500, { error: 'WRITE_FAILED' });
    }
    const inserted = await insertResp.json();
    const row = Array.isArray(inserted) ? inserted[0] : null;

    await supabaseAdminRequest('/rest/v1/compliance_audit_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: userId, role, actor: `user:${userId}`, action: 'payment_info_updated',
        details: { payment_id: row && row.id, iban_last4: iban.slice(-4) },
      }),
    });

    await safeNotify(() => notifyAdmins({
      category: 'admin.compliance.payment_info_changed',
      eventKey: `payment_info:${row && row.id}`,
      ctx: { email, role },
    }));

    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};
