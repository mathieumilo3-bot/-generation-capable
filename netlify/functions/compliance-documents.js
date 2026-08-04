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
//
// PATCH /.netlify/functions/compliance-documents   (remplacer un document existant)
//   { documentId, fileDataUrl, file_name? }
//   → { ok: true }  — remet admin_status à 'pending' (le remplaçant doit être revalidé)
//
// DELETE /.netlify/functions/compliance-documents  { documentId }
//   → { ok: true }

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { uploadObject, deleteObject, signedUrl } = require('./_lib/compliance/storage');
const { notifyAdmins, safeNotify } = require('./_lib/notifications/send');
const { isUuid } = require('./_lib/compliance/validate');

const ROLES = new Set(['vendeur', 'ambassadeur']);
const DOC_TYPES = new Set(['identity', 'rib', 'siret_proof', 'urssaf', 'vat_cert', 'other']);
const DOC_TYPE_LABELS = {
  identity: "Pièce d'identité", rib: 'RIB', siret_proof: "Justificatif SIRET (extrait INPI)",
  urssaf: 'Attestation URSSAF', vat_cert: 'Certificat de TVA', other: 'Autre document',
};
// Taille maximale par fichier.
//
// Était fixée à 8 Mo, une valeur inatteignable en pratique : Netlify refuse
// toute requête dont le corps dépasse 6 Mo, et ce refus intervient AVANT
// l'exécution de cette fonction. Comme le fichier arrive en base64 (~+33 %),
// tout envoi au-delà d'environ 4,4 Mo échouait donc sur une erreur réseau
// opaque, sans jamais atteindre le message « fichier trop volumineux » prévu
// ici — le contrôle ne servait à rien au-dessus de cette limite.
//
// 4 Mo laisse une marge sûre pour l'encodage et le reste du JSON. Même valeur
// que MAX_UPLOAD_BYTES dans compliance-client.js : le navigateur prévient
// l'utilisateur avant l'envoi, ce contrôle-ci reste l'autorité.
const MAX_FILE_BYTES = 4 * 1024 * 1024;
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
      return jsonResponse(400, { error: 'FILE_TOO_LARGE', message: 'Fichier trop volumineux (4 Mo maximum par fichier).' });
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

  if (event.httpMethod === 'PATCH') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return jsonResponse(400, { error: 'INVALID_JSON' });
    }
    const documentId = payload.documentId;
    if (!isUuid(documentId)) return jsonResponse(400, { error: 'MISSING_DOCUMENT_ID' });

    const existingResp = await supabaseAdminRequest(`/rest/v1/compliance_documents?id=eq.${documentId}&select=*`);
    const existingRows = existingResp.ok ? await existingResp.json() : [];
    const existing = existingRows && existingRows[0];
    if (!existing || existing.user_id !== userId) return jsonResponse(404, { error: 'DOCUMENT_NOT_FOUND' });

    const match = typeof payload.fileDataUrl === 'string' && payload.fileDataUrl.match(/^data:([\w/+.-]+);base64,(.+)$/);
    if (!match) return jsonResponse(400, { error: 'INVALID_FILE' });
    const ext = ALLOWED_MIME[match[1]];
    if (!ext) return jsonResponse(400, { error: 'UNSUPPORTED_FILE_TYPE', message: 'Formats acceptés : PDF, JPG, PNG.' });
    const fileBytes = Buffer.from(match[2], 'base64');
    if (fileBytes.length === 0 || fileBytes.length > MAX_FILE_BYTES) {
      return jsonResponse(400, { error: 'FILE_TOO_LARGE', message: 'Fichier trop volumineux (4 Mo maximum par fichier).' });
    }

    const newPath = `${existing.role}/${userId}/${existing.doc_type}-${Date.now()}.${ext}`;
    try {
      await uploadObject(newPath, fileBytes, match[1]);
    } catch (e) {
      console.error('[compliance-documents] Échec upload (remplacement)', e);
      return jsonResponse(500, { error: 'STORAGE_UPLOAD_FAILED' });
    }

    const fileName = (typeof payload.file_name === 'string' ? payload.file_name : existing.file_name).slice(0, 150);
    const updateResp = await supabaseAdminRequest(`/rest/v1/compliance_documents?id=eq.${documentId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        storage_path: newPath, file_name: fileName, uploaded_at: new Date().toISOString(),
        admin_status: 'pending', admin_reviewed_by: null, admin_reviewed_at: null, admin_notes: null,
      }),
    });
    if (!updateResp.ok) {
      const detail = await updateResp.text().catch(() => '');
      console.error('[compliance-documents] Échec mise à jour (remplacement)', updateResp.status, detail);
      return jsonResponse(500, { error: 'WRITE_FAILED' });
    }

    // L'ancien fichier n'est plus référencé par aucune ligne — best-effort,
    // ne bloque jamais la réponse si le nettoyage échoue.
    await deleteObject(existing.storage_path).catch(() => {});

    await supabaseAdminRequest('/rest/v1/compliance_audit_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: userId, role: existing.role, actor: `user:${userId}`, action: 'document_replaced',
        details: { document_id: documentId, doc_type: existing.doc_type },
      }),
    });

    await safeNotify(() => notifyAdmins({
      category: 'admin.compliance.document_uploaded',
      eventKey: `document_replaced:${documentId}:${Date.now()}`,
      ctx: { email, role: existing.role, docType: DOC_TYPE_LABELS[existing.doc_type] || existing.doc_type },
    }));

    return jsonResponse(200, { ok: true });
  }

  if (event.httpMethod === 'DELETE') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch (e) {
      return jsonResponse(400, { error: 'INVALID_JSON' });
    }
    const documentId = payload.documentId;
    if (!isUuid(documentId)) return jsonResponse(400, { error: 'MISSING_DOCUMENT_ID' });

    const existingResp = await supabaseAdminRequest(`/rest/v1/compliance_documents?id=eq.${documentId}&select=*`);
    const existingRows = existingResp.ok ? await existingResp.json() : [];
    const existing = existingRows && existingRows[0];
    if (!existing || existing.user_id !== userId) return jsonResponse(404, { error: 'DOCUMENT_NOT_FOUND' });

    await supabaseAdminRequest('/rest/v1/compliance_audit_log', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        user_id: userId, role: existing.role, actor: `user:${userId}`, action: 'document_deleted',
        details: { document_id: documentId, doc_type: existing.doc_type, file_name: existing.file_name },
      }),
    });

    const deleteResp = await supabaseAdminRequest(`/rest/v1/compliance_documents?id=eq.${documentId}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    if (!deleteResp.ok) {
      const detail = await deleteResp.text().catch(() => '');
      console.error('[compliance-documents] Échec suppression', deleteResp.status, detail);
      return jsonResponse(500, { error: 'DELETE_FAILED' });
    }
    await deleteObject(existing.storage_path).catch(() => {});

    return jsonResponse(200, { ok: true });
  }

  return jsonResponse(405, { error: 'Method not allowed' });
};
