// Collecte les résultats des outils IA pour que l'équipe Génération Capable
// puisse les relire et faire un retour humain au vendeur.
const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { sendToSubscription } = require('./_lib/notifications/webpush');

const MAX_RESULT = 30000;
const MAX_PROMPT = 4000;
function clean(v, max) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }

async function notifyAdmins(report) {
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
        const r = await sendToSubscription(sub, { title: `🤖 Nouveau résultat IA — ${report.tool}`, body: `${report.user_email} vient d'utiliser ${report.tool}. Ouvre la boîte IA pour faire ton retour.`, tag: 'ai-report-' + report.id, url: '/.netlify/functions/admin-ai-reports-page' });
        if (r.ok) sent = true;
        if (r.expired) await supabaseAdminRequest(`/rest/v1/push_subscriptions?id=eq.${sub.id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ revoked_at: new Date().toISOString() }) });
      }
      await supabaseAdminRequest('/rest/v1/notification_log', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ audience:'admin', user_id:user.id, category:'admin.ai.report', event_key:`ai-report:${report.id}`, title:`Nouveau résultat IA — ${report.tool}`, body:`${report.user_email} a généré un résultat IA.`, status:sent?'sent':'skipped_no_subscription', metadata:{report_id:report.id,tool:report.tool} }) });
    }
  } catch (e) { console.error('[ai-report-submit] notification admin:', e); }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  const identity = await verifySessionToken(event, anonKey);
  if (identity.error) return jsonResponse(401, { error: identity.error });
  let payload; try { payload = JSON.parse(event.body || '{}'); } catch { return jsonResponse(400, { error: 'INVALID_JSON' }); }
  const resultText = clean(payload.result_text, MAX_RESULT);
  if (!resultText) return jsonResponse(400, { error: 'RESULT_REQUIRED' });
  const report = { user_id:identity.id,user_email:identity.email,user_name:clean(payload.user_name,160)||null,tool:clean(payload.tool,100)||'Outil IA',prompt_excerpt:clean(payload.prompt_excerpt,MAX_PROMPT)||null,result_text:resultText,source:payload.source==='manual_share'?'manual_share':'ai_tool',shared_with_admin:true,shared_at:new Date().toISOString(),metadata:payload.metadata&&typeof payload.metadata==='object'?payload.metadata:{} };
  const r = await supabaseAdminRequest('/rest/v1/ai_coaching_reports',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(report)});
  if (!r.ok) { console.error('[ai-report-submit] Supabase:',r.status,await r.text().catch(()=>'')); return jsonResponse(500,{error:'SAVE_FAILED'}); }
  const rows=await r.json(); const saved=Array.isArray(rows)?rows[0]:null; if(saved) await notifyAdmins(saved);
  return jsonResponse(200,{ok:true,report_id:saved?.id||null});
};