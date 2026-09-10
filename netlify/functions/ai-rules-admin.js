const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { isAdminEmail } = require('./_lib/admin-check');

exports.handler = async (event) => {
  if (!['GET','PATCH'].includes(event.httpMethod)) return jsonResponse(405, { error:'Method not allowed' });
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) return jsonResponse(500, { error:'SERVER_NOT_CONFIGURED' });
  const identity = await verifySessionToken(event, anonKey);
  if (identity.error) return jsonResponse(401, { error:identity.error });
  if (!(await isAdminEmail(identity.email))) return jsonResponse(403, { error:'ADMIN_REQUIRED' });

  if (event.httpMethod === 'GET') {
    const r = await supabaseAdminRequest('/rest/v1/ai_coaching_rules?select=*&order=active.desc,priority.asc,updated_at.desc&limit=200');
    if (!r.ok) return jsonResponse(500, { error:'READ_FAILED' });
    return jsonResponse(200, { rules: await r.json() });
  }

  let p; try { p = JSON.parse(event.body || '{}'); } catch { return jsonResponse(400,{error:'INVALID_JSON'}); }
  const id = typeof p.id === 'string' ? p.id : '';
  if (!id) return jsonResponse(400,{error:'ID_REQUIRED'});
  const patch = {};
  if (typeof p.active === 'boolean') patch.active = p.active;
  if (typeof p.priority === 'number') patch.priority = Math.max(1, Math.min(1000, Math.round(p.priority)));
  if (typeof p.rule_text === 'string' && p.rule_text.trim()) patch.rule_text = p.rule_text.trim().slice(0,12000);
  if (typeof p.title === 'string' && p.title.trim()) patch.title = p.title.trim().slice(0,160);
  if (!Object.keys(patch).length) return jsonResponse(400,{error:'NO_CHANGES'});
  patch.updated_at = new Date().toISOString();
  const r = await supabaseAdminRequest(`/rest/v1/ai_coaching_rules?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify(patch)});
  if (!r.ok) return jsonResponse(500,{error:'UPDATE_FAILED'});
  return jsonResponse(200,{ok:true,rules:await r.json()});
};
