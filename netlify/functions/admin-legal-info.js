// netlify/functions/admin-legal-info.js
//
// Administration → Informations légales. Une seule ligne
// (company_legal_info, id=1) qui remplit automatiquement tous les contrats
// générés (voir _lib/compliance/contracts.js) — plus aucune valeur codée en
// dur ni "[À CONFIGURER]" une fois cette page remplie.
//
// GET  /.netlify/functions/admin-legal-info
//   → { info: {...}, logoUrl, signatureUrl }
//
// POST /.netlify/functions/admin-legal-info
//   { company_name, legal_rep_name, legal_rep_title, address, postal_code,
//     city, country, siret, vat_number, email, phone,
//     logoDataUrl?, signatureDataUrl? }
//   → { ok: true }

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { isAdminEmail } = require('./_lib/admin-check');
const { uploadObject, signedUrl } = require('./_lib/compliance/storage');

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' };

function parseDataUrl(dataUrl) {
  const match = typeof dataUrl === 'string' && dataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/);
  if (!match) return null;
  const ext = ALLOWED_MIME[match[1]];
  if (!ext) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) return null;
  return { bytes, mime: match[1], ext };
}

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  const { email, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) return jsonResponse(401, { error: authError });
  if (!(await isAdminEmail(email))) return jsonResponse(403, { error: 'ADMIN_REQUIRED' });

  if (event.httpMethod === 'GET') {
    const r = await supabaseAdminRequest('/rest/v1/company_legal_info?id=eq.1&select=*');
    const rows = r.ok ? await r.json() : [];
    const info = (rows && rows[0]) || {};
    const logoUrl = info.logo_path ? await signedUrl(info.logo_path, 600).catch(() => null) : null;
    const signatureUrl = info.signature_path ? await signedUrl(info.signature_path, 600).catch(() => null) : null;
    return jsonResponse(200, { info, logoUrl, signatureUrl });
  }

  if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return jsonResponse(400, { error: 'INVALID_JSON' });
    }

    const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : null);
    const fields = {
      id: 1,
      company_name: str(payload.company_name, 150),
      legal_rep_name: str(payload.legal_rep_name, 150),
      legal_rep_title: str(payload.legal_rep_title, 100),
      address: str(payload.address, 300),
      postal_code: str(payload.postal_code, 20),
      city: str(payload.city, 100),
      country: str(payload.country, 60) || 'France',
      siret: str(payload.siret, 20),
      vat_number: str(payload.vat_number, 30),
      email: str(payload.email, 150),
      phone: str(payload.phone, 30),
      updated_at: new Date().toISOString(),
    };

    if (payload.logoDataUrl) {
      const parsed = parseDataUrl(payload.logoDataUrl);
      if (!parsed) return jsonResponse(400, { error: 'INVALID_LOGO' });
      const path = `legal/logo-${Date.now()}.${parsed.ext}`;
      try {
        await uploadObject(path, parsed.bytes, parsed.mime);
        fields.logo_path = path;
      } catch (e) {
        console.error('[admin-legal-info] Échec upload logo', e);
        return jsonResponse(500, { error: 'LOGO_UPLOAD_FAILED' });
      }
    }

    if (payload.signatureDataUrl) {
      const parsed = parseDataUrl(payload.signatureDataUrl);
      if (!parsed) return jsonResponse(400, { error: 'INVALID_SIGNATURE' });
      const path = `legal/signature-${Date.now()}.${parsed.ext}`;
      try {
        await uploadObject(path, parsed.bytes, parsed.mime);
        fields.signature_path = path;
      } catch (e) {
        console.error('[admin-legal-info] Échec upload signature', e);
        return jsonResponse(500, { error: 'SIGNATURE_UPLOAD_FAILED' });
      }
    }

    const r = await supabaseAdminRequest('/rest/v1/company_legal_info?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(fields),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[admin-legal-info] Échec écriture', r.status, detail);
      return jsonResponse(200, { error: 'WRITE_FAILED' });
    }

    // Journal comptable existant (0003) — un changement d'identité légale
    // n'a pas de "role" vendeur/ambassadeur, ne rentre pas dans
    // compliance_audit_log par construction (contrainte de rôle).
    await supabaseAdminRequest('/rest/v1/audit_logs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ event_type: 'legal_info_updated', actor: `admin:${email}`, details: { fields: Object.keys(fields) } }),
    });

    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};
