const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { isAdminEmail } = require('./_lib/admin-check');

exports.handler = async (event) => {
  if (!['GET', 'PATCH'].includes(event.httpMethod)) return jsonResponse(405, { error: 'Method not allowed' });
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });

  const identity = await verifySessionToken(event, anonKey);
  if (identity.error) return jsonResponse(401, { error: identity.error });
  if (!(await isAdminEmail(identity.email))) return jsonResponse(403, { error: 'ADMIN_REQUIRED' });

  if (event.httpMethod === 'GET') {
    const url = new URL(event.rawUrl || 'https://generationcapable.fr/.netlify/functions/ai-reports-admin');
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);
    const r = await supabaseAdminRequest(`/rest/v1/ai_coaching_reports?select=*&order=created_at.desc&limit=${limit}`);
    if (!r.ok) return jsonResponse(500, { error: 'READ_FAILED' });
    return jsonResponse(200, { reports: await r.json() });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return jsonResponse(400, { error: 'INVALID_JSON' }); }
  const id = typeof payload.id === 'string' ? payload.id : '';
  if (!id) return jsonResponse(400, { error: 'ID_REQUIRED' });
  const r = await supabaseAdminRequest(`/rest/v1/ai_coaching_reports?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ read_at: new Date().toISOString() }),
  });
  if (!r.ok) return jsonResponse(500, { error: 'UPDATE_FAILED' });
  return jsonResponse(200, { ok: true });
};