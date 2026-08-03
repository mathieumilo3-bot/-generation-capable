// netlify/functions/compliance-sign-contract.js
//
// Signature électronique du contrat (Vendeur ou Ambassadeur) : remplit le
// texte du contrat avec les informations du dossier, génère le PDF signé,
// archive la signature (image) et le PDF dans Supabase Storage, enregistre
// la preuve (date, heure, IP, identifiant, version) — jamais réécrite
// ensuite (voir 0015_compliance_contracts.sql, contract_signatures est
// append-only et immuable après création).
//
// POST /.netlify/functions/compliance-sign-contract
//   Authorization: Bearer <session_token>
//   { role: 'vendeur'|'ambassadeur', hasRead: true, hasAccepted: true,
//     signatureImageDataUrl: 'data:image/png;base64,...' }
//   → { ok: true, signatureId, pdfUrl }

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { renderContract } = require('./_lib/compliance/contracts');
const { generateContractPdf } = require('./_lib/compliance/pdf');
const { uploadObject, signedUrl } = require('./_lib/compliance/storage');
const { notifyAdmins, safeNotify } = require('./_lib/notifications/send');

const ROLES = new Set(['vendeur', 'ambassadeur']);
const MAX_SIGNATURE_BYTES = 400_000; // largement suffisant pour un tracé signature PNG

const REQUIRED_PROFILE_FIELDS = ['first_name', 'last_name', 'birth_date', 'birth_place', 'address', 'nationality', 'legal_status'];

function clientIp(event) {
  const xff = event.headers['x-forwarded-for'] || event.headers['X-Forwarded-For'];
  if (xff) return xff.split(',')[0].trim();
  return event.headers['x-nf-client-connection-ip'] || null;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  const { id: userId, email, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) return jsonResponse(401, { error: authError });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'INVALID_JSON' });
  }

  const role = payload.role;
  if (!ROLES.has(role)) return jsonResponse(400, { error: 'INVALID_ROLE' });
  if (payload.hasRead !== true || payload.hasAccepted !== true) {
    return jsonResponse(400, { error: 'CONSENT_REQUIRED', message: 'Tu dois confirmer avoir lu et accepté le contrat.' });
  }

  const dataUrl = payload.signatureImageDataUrl;
  const match = typeof dataUrl === 'string' && dataUrl.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return jsonResponse(400, { error: 'INVALID_SIGNATURE_IMAGE' });
  const signatureBytes = Buffer.from(match[1], 'base64');
  if (signatureBytes.length === 0 || signatureBytes.length > MAX_SIGNATURE_BYTES) {
    return jsonResponse(400, { error: 'SIGNATURE_IMAGE_TOO_LARGE' });
  }

  // Profil requis AVANT signature : le contrat doit refléter de vraies
  // informations, jamais des blancs "[non renseigné]" sur un document signé.
  const profileResp = await supabaseAdminRequest(
    `/rest/v1/compliance_profiles?user_id=eq.${userId}&role=eq.${role}&select=*`
  );
  const profileRows = profileResp.ok ? await profileResp.json() : [];
  const profile = profileRows && profileRows[0];
  const missing = REQUIRED_PROFILE_FIELDS.filter(f => !profile || !profile[f] || String(profile[f]).trim().length === 0);
  if (!profile || missing.length > 0) {
    return jsonResponse(400, {
      error: 'PROFILE_INCOMPLETE',
      message: 'Complète tes informations personnelles avant de signer le contrat.',
      missingFields: missing,
    });
  }

  const { text, filledFields, version } = renderContract(role, profile, email, new Date());

  // Une re-signature de la MÊME version est bloquée en amont (message clair)
  // plutôt que de laisser remonter l'erreur brute de contrainte unique.
  const existingResp = await supabaseAdminRequest(
    `/rest/v1/contract_signatures?user_id=eq.${userId}&role=eq.${role}&contract_version=eq.${encodeURIComponent(version)}&select=id`
  );
  const existingRows = existingResp.ok ? await existingResp.json() : [];
  if (existingRows && existingRows[0]) {
    return jsonResponse(200, { ok: true, alreadySigned: true, signatureId: existingRows[0].id });
  }

  const now = new Date();
  const ip = clientIp(event);
  const userAgent = (event.headers['user-agent'] || '').slice(0, 300);
  const timestamp = now.getTime();

  let pdfBuffer;
  try {
    pdfBuffer = await generateContractPdf({
      title: role === 'vendeur' ? 'CONTRAT DE VENDEUR — Génération Capable' : "CONTRAT D'AMBASSADEUR — Génération Capable",
      contractText: text,
      proof: { signedAt: now.toISOString(), ipAddress: ip, userId, version, signatureImageBytes: signatureBytes },
    });
  } catch (e) {
    console.error('[compliance-sign-contract] Échec génération PDF', e);
    return jsonResponse(500, { error: 'PDF_GENERATION_FAILED' });
  }

  const signaturePath = `${role}/${userId}/signature-${timestamp}.png`;
  const pdfPath = `${role}/${userId}/contract-${version}-${timestamp}.pdf`;

  try {
    await uploadObject(signaturePath, signatureBytes, 'image/png');
    await uploadObject(pdfPath, pdfBuffer, 'application/pdf');
  } catch (e) {
    console.error('[compliance-sign-contract] Échec upload Storage', e);
    return jsonResponse(500, { error: 'STORAGE_UPLOAD_FAILED' });
  }

  const insertResp = await supabaseAdminRequest('/rest/v1/contract_signatures', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: userId,
      role,
      contract_version: version,
      signed_at: now.toISOString(),
      ip_address: ip,
      user_agent: userAgent,
      filled_fields: filledFields,
      signature_image_path: signaturePath,
      contract_pdf_path: pdfPath,
    }),
  });
  if (!insertResp.ok) {
    const detail = await insertResp.text().catch(() => '');
    console.error('[compliance-sign-contract] Échec enregistrement signature', insertResp.status, detail);
    return jsonResponse(500, { error: 'SIGNATURE_RECORD_FAILED' });
  }
  const inserted = await insertResp.json();
  const signature = Array.isArray(inserted) ? inserted[0] : null;

  await supabaseAdminRequest('/rest/v1/compliance_audit_log', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      user_id: userId, role, actor: `user:${userId}`, action: 'contract_signed',
      details: { signature_id: signature && signature.id, version, ip },
    }),
  });

  await safeNotify(() => notifyAdmins({
    category: 'admin.compliance.new_signature',
    eventKey: `signature:${signature && signature.id}`,
    ctx: { email, role },
  }));

  const pdfUrl = await signedUrl(pdfPath, 600).catch(() => null);

  return jsonResponse(200, { ok: true, signatureId: signature && signature.id, pdfUrl });
};
