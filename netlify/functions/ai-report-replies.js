const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');

exports.handler = async (event) => {
  if (!['GET', 'PATCH'].includes(event.httpMethod)) return jsonResponse(405, { error: 'Method not allowed' });
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  const identity = await verifySessionToken(event, anonKey);
  if (identity.error) return jsonResponse(401, { error: identity.error });

  if (event.httpMethod === 'GET') {
    const r = await supabaseAdminRequest(`/rest/v1/ai_coaching_replies?user_id=eq.${identity.id}&select=id,report_id,admin_email,message,created_at,read_at&order=created_at.desc&limit=30`);
    if (!r.ok) return jsonResponse(500, { error: 'READ_FAILED' });
    return jsonResponse(200, { replies: await r.json() });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return jsonResponse(400, { error: 'INVALID_JSON' }); }
  const id = typeof payload.id === 'string' ? payload.id : '';
  if (!id) return jsonResponse(400, { error: 'ID_REQUIRED' });
  const r = await supabaseAdminRequest(`/rest/v1/ai_coaching_replies?id=eq.${encodeURIComponent(id)}&user_id=eq.${identity.id}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ read_at: new Date().toISOString() })
  });
  if (!r.ok) return jsonResponse(500, { error: 'UPDATE_FAILED' });
  return jsonResponse(200, { ok: true });
};