// netlify/functions/compliance-export.js
//
// Export du dossier en un clic — utile pour répondre à un contrôle ou
// vérifier un dossier. Renvoie un JSON complet (profil, statut de chaque
// pièce, historique horodaté) accompagné de liens signés (10 minutes) vers
// chaque fichier réel (PDF du contrat, documents déposés) : PAS un unique
// fichier .zip fusionné (aucune librairie de compression dans ce projet,
// volontairement — voir docs/compliance-system.md) mais un export complet
// et exploitable en un seul appel, que l'admin comme l'utilisateur peuvent
// utiliser pour tout télécharger.
//
// GET /.netlify/functions/compliance-export?role=vendeur|ambassadeur[&userId=...]
//   userId : réservé admin (export du dossier d'un tiers) — sinon exporte
//   toujours le dossier de l'appelant.

const { verifySessionToken, supabaseAdminRequest, jsonResponse, SUPABASE_URL } = require('./_lib/supabase-admin');
const { signedUrl } = require('./_lib/compliance/storage');
const { isAdminEmail } = require('./_lib/admin-check');
const { isUuid } = require('./_lib/compliance/validate');

const ROLES = new Set(['vendeur', 'ambassadeur']);

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return jsonResponse(405, { error: 'Method not allowed' });

  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  const { id: callerId, email: callerEmail, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) return jsonResponse(401, { error: authError });

  const qs = event.queryStringParameters || {};
  const role = qs.role;
  if (!ROLES.has(role)) return jsonResponse(400, { error: 'INVALID_ROLE' });

  let targetUserId = callerId;
  if (qs.userId && qs.userId !== callerId) {
    if (!isUuid(qs.userId)) return jsonResponse(400, { error: 'INVALID_USER_ID' });
    if (!(await isAdminEmail(callerEmail))) return jsonResponse(403, { error: 'ADMIN_REQUIRED' });
    targetUserId = qs.userId;
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const rpcName = targetUserId === callerId ? 'get_my_compliance_dossier' : 'admin_get_compliance_dossier';
  const rpcParams = targetUserId === callerId ? { p_role: role } : { p_user_id: targetUserId, p_role: role };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpcName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: authHeader },
    body: JSON.stringify(rpcParams),
  });
  const dossier = await r.json();
  if (!r.ok) return jsonResponse(200, { error: 'READ_ERROR', detail: dossier });

  // get_my_compliance_dossier() ne renvoie pas les signatures/documents en
  // liste (seulement "latest_") — on les récupère ici pour un export complet.
  const [sigResp, docResp, auditResp] = await Promise.all([
    supabaseAdminRequest(`/rest/v1/contract_signatures?user_id=eq.${targetUserId}&role=eq.${role}&select=id,contract_version,signed_at,ip_address,admin_status,contract_pdf_path&order=signed_at.desc`),
    supabaseAdminRequest(`/rest/v1/compliance_documents?user_id=eq.${targetUserId}&role=eq.${role}&select=id,doc_type,file_name,uploaded_at,expires_at,admin_status,storage_path&order=uploaded_at.desc`),
    supabaseAdminRequest(`/rest/v1/compliance_audit_log?user_id=eq.${targetUserId}&role=eq.${role}&select=created_at,actor,action,details&order=created_at.desc&limit=500`),
  ]);
  const signatures = sigResp.ok ? await sigResp.json() : [];
  const documents = docResp.ok ? await docResp.json() : [];
  const auditLog = auditResp.ok ? await auditResp.json() : [];

  for (const s of signatures) { s.pdf_url = await signedUrl(s.contract_pdf_path, 600).catch(() => null); delete s.contract_pdf_path; }
  for (const d of documents) { d.url = await signedUrl(d.storage_path, 600).catch(() => null); delete d.storage_path; }

  return jsonResponse(200, {
    exported_at: new Date().toISOString(),
    role,
    profile: dossier.profile,
    score: dossier.score,
    status: dossier.status,
    signatures,
    documents,
    audit_log: auditLog,
  });
};
