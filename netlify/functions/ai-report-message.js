const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');

const MAX_MESSAGE = 12000;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  const identity = await verifySessionToken(event, anonKey);
  if (identity.error) return jsonResponse(401, { error: identity.error });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return jsonResponse(400, { error: 'INVALID_JSON' }); }
  const reportId = typeof payload.report_id === 'string' ? payload.report_id : '';
  const message = typeof payload.message === 'string' ? payload.message.trim().slice(0, MAX_MESSAGE) : '';
  if (!reportId || !message) return jsonResponse(400, { error: 'REPORT_AND_MESSAGE_REQUIRED' });

  const reportResp = await supabaseAdminRequest(`/rest/v1/ai_coaching_reports?id=eq.${encodeURIComponent(reportId)}&user_id=eq.${identity.id}&select=id,user_id&limit=1`);
  if (!reportResp.ok) return jsonResponse(500, { error: 'REPORT_READ_FAILED' });
  const reports = await reportResp.json();
  if (!Array.isArray(reports) || !reports[0]) return jsonResponse(404, { error: 'REPORT_NOT_FOUND' });

  const r = await supabaseAdminRequest('/rest/v1/ai_coaching_replies', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ report_id: reportId, user_id: identity.id, sender_type: 'member', admin_email: null, message, is_training_signal: false })
  });
  if (!r.ok) return jsonResponse(500, { error: 'MESSAGE_SAVE_FAILED' });
  const rows = await r.json();
  return jsonResponse(200, { ok: true, message_id: Array.isArray(rows) ? rows[0]?.id || null : null });
};
