const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { isAdminEmail } = require('./_lib/admin-check');
const { sendToSubscription } = require('./_lib/notifications/webpush');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });

  const identity = await verifySessionToken(event, anonKey);
  if (identity.error) return jsonResponse(401, { error: identity.error });
  if (!(await isAdminEmail(identity.email))) return jsonResponse(403, { error: 'ADMIN_REQUIRED' });

  let payload;
  try { payload = JSON.parse(event.body || '{}'); } catch { return jsonResponse(400, { error: 'INVALID_JSON' }); }
  const reportId = typeof payload.report_id === 'string' ? payload.report_id : '';
  const message = typeof payload.message === 'string' ? payload.message.trim().slice(0, 12000) : '';
  if (!reportId || !message) return jsonResponse(400, { error: 'REPORT_AND_MESSAGE_REQUIRED' });

  const reportResp = await supabaseAdminRequest(`/rest/v1/ai_coaching_reports?id=eq.${encodeURIComponent(reportId)}&select=id,user_id,user_email&limit=1`);
  if (!reportResp.ok) return jsonResponse(500, { error: 'REPORT_READ_FAILED' });
  const reports = await reportResp.json();
  const report = Array.isArray(reports) ? reports[0] : null;
  if (!report) return jsonResponse(404, { error: 'REPORT_NOT_FOUND' });

  const replyResp = await supabaseAdminRequest('/rest/v1/ai_coaching_replies', {
    method: 'POST', headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ report_id: report.id, user_id: report.user_id, admin_email: identity.email, message })
  });
  if (!replyResp.ok) return jsonResponse(500, { error: 'REPLY_SAVE_FAILED' });
  const rows = await replyResp.json();
  const reply = Array.isArray(rows) ? rows[0] : null;

  let pushSent = false;
  const subsResp = await supabaseAdminRequest(`/rest/v1/push_subscriptions?user_id=eq.${report.user_id}&revoked_at=is.null&select=id,endpoint,p256dh,auth_key`);
  if (subsResp.ok) {
    const subs = await subsResp.json();
    for (const sub of Array.isArray(subs) ? subs : []) {
      const r = await sendToSubscription(sub, {
        title: '💬 Nouveau retour d’Enzo',
        body: message.length > 160 ? message.slice(0, 157) + '…' : message,
        tag: 'gc-ai-reply-' + (reply?.id || report.id),
        url: '/?gcAiReply=' + encodeURIComponent(reply?.id || '')
      });
      if (r.ok) pushSent = true;
      if (r.expired) await supabaseAdminRequest(`/rest/v1/push_subscriptions?id=eq.${sub.id}`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ revoked_at: new Date().toISOString() })
      });
    }
  }

  return jsonResponse(200, { ok: true, reply_id: reply?.id || null, push_sent: pushSent });
};