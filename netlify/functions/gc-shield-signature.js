const crypto = require('crypto');
const { json, methodNotAllowed, parseJsonBody } = require('./_shared/http');
const { getVerifiedUser, supabaseFetch } = require('./_shared/supabase');
const { resolveRole, hasPermission } = require('./_shared/roles');
const { writeAudit, detectBasicAnomalies } = require('./_shared/audit');

function newSignatureId() {
  return `GC-${new Date().getUTCFullYear()}-${crypto.randomUUID()}`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    const params = new URLSearchParams(event.rawQuery || '');
    const signatureId = params.get('id');
    if (!signatureId) return json(400, { error: 'MISSING_SIGNATURE_ID' });
    const result = await supabaseFetch(`gc_site_signatures?signature_id=eq.${encodeURIComponent(signatureId)}&select=signature_id,site_url,status,owner_email,created_at,verified_at,metadata&limit=1`, { serviceRole: true });
    if (!result.ok) return json(502, { error: 'SIGNATURE_READ_FAILED', detail: result.data });
    const record = Array.isArray(result.data) ? result.data[0] : null;
    await writeAudit(event, { action: 'site_signature.verify', resource_type: 'site_signature', resource_id: signatureId, metadata: { found: !!record, status: record?.status } });
    return json(200, { valid: !!record && record.status === 'active', signature: record || null });
  }

  if (event.httpMethod !== 'POST') return methodNotAllowed(['GET', 'POST']);

  const auth = await getVerifiedUser(event);
  if (auth.error) return json(401, { error: auth.error });
  const role = await resolveRole(auth.user, supabaseFetch);
  if (!hasPermission(role, 'site:create')) return json(403, { error: 'FORBIDDEN', role });

  const parsed = parseJsonBody(event);
  if (parsed.error) return json(400, parsed);
  const { site_url, metadata = {} } = parsed.data;
  const signature_id = newSignatureId();

  await detectBasicAnomalies(event, { email: auth.user.email });
  const insert = await supabaseFetch('gc_site_signatures', {
    method: 'POST',
    body: { signature_id, site_url, owner_email: auth.user.email, owner_user_id: auth.user.id, metadata },
    prefer: 'return=representation',
    serviceRole: true
  });
  if (!insert.ok) return json(502, { error: 'SIGNATURE_CREATE_FAILED', detail: insert.data });

  await writeAudit(event, { actor_user_id: auth.user.id, actor_email: auth.user.email, actor_role: role, action: 'site_signature.create', resource_type: 'site_signature', resource_id: signature_id, metadata: { site_url } });
  return json(201, { signature: insert.data?.[0] || { signature_id } });
};
