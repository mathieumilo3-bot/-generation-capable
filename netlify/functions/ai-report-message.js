const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { sendToSubscription } = require('./_lib/notifications/webpush');

const MAX_MESSAGE = 12000;

async function notifyAdmins(memberEmail, reportId, message) {
  try {
    const adminsResp = await supabaseAdminRequest('/rest/v1/admins?select=email');
    if (!adminsResp.ok) return;
    const admins = await adminsResp.json();
    for (const admin of Array.isArray(admins) ? admins : []) {
      const email = (admin.email || '').toLowerCase(); if (!email) continue;
      const usersResp = await supabaseAdminRequest(`/auth/v1/admin/users?email=${encodeURIComponent(email)}`);
      if (!usersResp.ok) continue;
      const users = await usersResp.json();
      const user = Array.isArray(users?.users) ? users.users.find(u => (u.email || '').toLowerCase() === email) : null;
      if (!user?.id) continue;
      const subsResp = await supabaseAdminRequest(`/rest/v1/push_subscriptions?user_id=eq.${user.id}&revoked_at=is.null&select=id,endpoint,p256dh,auth_key`);
      if (!subsResp.ok) continue;
      const subs = await subsResp.json(); let sent = false;
      for (const sub of Array.isArray(subs) ? subs : []) {
        const r = await sendToSubscription(sub, { title:'💬 Nouveau message membre', body:`${memberEmail} a répondu à ton échange IA.`, tag:'gc-ai-member-'+reportId, url:'/.netlify/functions/admin-ai-reports-page' });
        if (r.ok) sent = true;
        if (r.expired) await supabaseAdminRequest(`/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method:'PATCH', headers:{Prefer:'return=minimal'}, body:JSON.stringify({revoked_at:new Date().toISOString()}) });
      }
      await supabaseAdminRequest('/rest/v1/notification_log',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({audience:'admin',user_id:user.id,category:'admin.ai.reply',event_key:`ai-member-message:${reportId}`,title:'Nouveau message membre',body:`${memberEmail} a répondu à son échange IA.`,status:sent?'sent':'skipped_no_subscription',metadata:{report_id:reportId}})});
    }
  } catch(e){ console.error('[ai-report-message] admin notification:',e); }
}

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
  await notifyAdmins(identity.email, reportId, message);
  return jsonResponse(200, { ok: true, message_id: Array.isArray(rows) ? rows[0]?.id || null : null });
};
