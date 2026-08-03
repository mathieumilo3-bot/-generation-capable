// netlify/functions/compliance-dossier.js
//
// "Mon dossier administratif" — lecture (profil + score + checklist) et
// écriture des informations personnelles/professionnelles déclaratives.
// La signature et les documents ont leurs propres endpoints (voir
// compliance-sign-contract.js / compliance-documents.js) car ils exigent
// une génération/validation côté serveur qu'une simple RPC ne peut pas faire.
//
// GET  /.netlify/functions/compliance-dossier?role=vendeur|ambassadeur
//   Authorization: Bearer <session_token>
//   → { dossier: {...} }  (voir get_my_compliance_dossier() en base)
//
// POST /.netlify/functions/compliance-dossier
//   { role, first_name, last_name, birth_date, birth_place, address, phone,
//     nationality, legal_status, siret, vat_number, company_name, company_created_at }
//   → { ok: true }

const { verifySessionToken, supabaseAdminRequest, jsonResponse, SUPABASE_URL } = require('./_lib/supabase-admin');
const { signedUrl } = require('./_lib/compliance/storage');

const ROLES = new Set(['vendeur', 'ambassadeur']);

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  const { id: userId, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) return jsonResponse(401, { error: authError });

  if (event.httpMethod === 'GET') {
    const role = (event.queryStringParameters || {}).role;
    if (!ROLES.has(role)) return jsonResponse(400, { error: 'INVALID_ROLE' });

    // Utilise le token de SESSION (pas service_role) : get_my_compliance_dossier()
    // dépend de auth.uid() pour ne jamais pouvoir renvoyer le dossier de
    // quelqu'un d'autre, même en cas de bug applicatif côté Netlify.
    const authHeader = event.headers.authorization || event.headers.Authorization;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_my_compliance_dossier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: authHeader,
      },
      body: JSON.stringify({ p_role: role }),
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('[compliance-dossier] Erreur RPC', r.status, JSON.stringify(data));
      return jsonResponse(200, { error: 'READ_ERROR', detail: data });
    }
    if (data && data.latest_signature && data.latest_signature.contract_pdf_path) {
      data.latest_signature.pdf_url = await signedUrl(data.latest_signature.contract_pdf_path, 600).catch(() => null);
    }
    return jsonResponse(200, { dossier: data });
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

    const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max || 200) : null);
    const dateOnly = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

    const fields = {
      user_id: userId,
      role,
      first_name: str(payload.first_name, 100),
      last_name: str(payload.last_name, 100),
      birth_date: dateOnly(payload.birth_date),
      birth_place: str(payload.birth_place, 150),
      address: str(payload.address, 300),
      phone: str(payload.phone, 30),
      nationality: str(payload.nationality, 60),
      legal_status: str(payload.legal_status, 80),
      siret: str(payload.siret, 20),
      vat_number: str(payload.vat_number, 30),
      company_name: str(payload.company_name, 150),
      company_created_at: dateOnly(payload.company_created_at),
      updated_at: new Date().toISOString(),
    };

    const r = await supabaseAdminRequest('/rest/v1/compliance_profiles?on_conflict=user_id,role', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(fields),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[compliance-dossier] Erreur écriture', r.status, detail);
      return jsonResponse(200, { error: 'WRITE_ERROR' });
    }

    await supabaseAdminRequest('/rest/v1/compliance_audit_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: userId, role, actor: `user:${userId}`, action: 'profile_updated', details: {} }),
    });

    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};
