// netlify/functions/compliance-documents.js
//
// Dépôt et consultation des pièces justificatives (identité, RIB scanné,
// justificatif SIRET, attestation URSSAF, certificat TVA...). Le fichier
// est reçu en base64 (data URL), validé (type/taille), archivé dans le
// bucket privé "compliance-documents", puis référencé en base — jamais
// l'inverse (une ligne sans fichier réellement stocké n'a aucun sens).
//
// GET  /.netlify/functions/compliance-documents?role=vendeur|ambassadeur
//   → { documents: [{ id, doc_type, file_name, uploaded_at, expires_at, admin_status, url }] }
//
// POST /.netlify/functions/compliance-documents
//   { role, doc_type, file_name, fileDataUrl, expires_at? }
//   → { ok: true, documentId }

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { uploadObject, signedUrl } = require('./_lib/compliance/storage');
const { notifyAdmins, safeNotify } = require('./_lib/notifications/send');

const ROLES = new Set(['vendeur', 'ambassadeur']);
const DOC_TYPES = new Set(['identity', 'rib', 'siret_proof', 'urssaf', 'vat_cert', 'other']);
const DOC_TYPE_LABELS = {
  identity: "Pièce d'identité", rib: 'RIB', siret_proof: "Justificatif SIRET (extrait INPI)",
  urssaf: 'Attestation URSSAF', vat_cert: 'Certificat de TVA', other: 'Autre document',
};
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };

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
      `/rest/v1/compliance_documents?user_id=eq.${userId}&role=eq.${role}&select=id,doc_type,file_name,storage_path,uploaded_at,expires_at,admin_status,admin_notes&order=uploaded_at.desc`
    );
    const rows = r.ok ? await r.json() : [];
    const documents = await Promise.all((rows || []).map(async d => ({
      id: d.id, doc_type: d.doc_type, file_name: d.file_name, uploaded_at: d.uploaded_at,
      expires_at: d.expires_at, admin_status: d.admin_status, admin_notes: d.admin_notes,
      url: await signedUrl(d.storage_path, 300).catch(() => null),
    })));
    return jsonResponse(200, { documents });
  }

  if (event.httpMethod === 'POST') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return jsonResponse(400, { error: 'INVALID_JSON' });
    }

    const role = payload.role;
    const docType = payload.doc_type;
    if (!ROLES.has(role)) return jsonResponse(400, { error: 'INVALID_ROLE' });
    if (!DOC_TYPES.has(docType)) return jsonResponse(400, { error: 'INVALID_DOC_TYPE' });

    const match = typeof payload.fileDataUrl === 'string' && payload.fileDataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/);
    if (!match) return jsonResponse(400, { error: 'INVALID_FILE' });
    const mime = match[1];
    const ext = ALLOWED_MIME[mime];
    if (!ext) return jsonResponse(400, { error: 'UNSUPPORTED_FILE_TYPE', message: 'Formats acceptés : PDF, JPG, PNG.' });

    const fileBytes = Buffer.from(match[2], 'base64');
    if (fileBytes.length === 0 || fileBytes.length > MAX_FILE_BYTES) {
      return jsonResponse(400, { error: 'FILE_TOO_LARGE', message: 'Fichier trop volumineux (8 Mo maximum).' });
    }

    const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(payload.expires_at || '') ? payload.expires_at : null;
    const fileName = (typeof payload.file_name === 'string' ? payload.file_name : `${docType}.${ext}`).slice(0, 150);
    const storagePath = `${role}/${userId}/${docType}-${Date.now()}.${ext}`;

    try {
      await uploadObject(storagePath, fileBytes, mime);
    } catch (e) {
      console.error('[compliance-documents] Échec upload', e);
      return jsonResponse(500, { error: 'STORAGE_UPLOAD_FAILED' });
    }

    const insertResp = await supabaseAdminRequest('/rest/v1/compliance_documents', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: userId, role, doc_type: docType, storage_path: storagePath,
        file_name: fileName, expires_at: expiresAt,
      }),
    });
    if (!insertResp.ok) {
      const detail = await insertResp.text().catch(() => '');
      console.error('[compliance-documents] Échec écriture', insertResp.status, detail);
      return jsonResponse(500, { error: 'WRITE_FAILED' });
    }
    const inserted = await insertResp.json();
    const doc = Array.isArray(inserted) ? inserted[0] : null;

    await supabaseAdminRequest('/rest/v1/compliance_audit_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: userId, role, actor: `user:${userId}`, action: 'document_uploaded',
        details: { document_id: doc && doc.id, doc_type: docType },
      }),
    });

    await safeNotify(() => notifyAdmins({
      category: 'admin.compliance.document_uploaded',
      eventKey: `document:${doc && doc.id}`,
      ctx: { email, role, docType: DOC_TYPE_LABELS[docType] || docType },
    }));

    return jsonResponse(200, { ok: true, documentId: doc && doc.id });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};
