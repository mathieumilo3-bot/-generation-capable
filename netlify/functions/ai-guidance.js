const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return jsonResponse(405, { error: 'Method not allowed' });
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  const identity = await verifySessionToken(event, anonKey);
  if (identity.error) return jsonResponse(401, { error: identity.error });
  const r = await supabaseAdminRequest('/rest/v1/ai_coaching_rules?active=eq.true&select=id,title,rule_text,category,priority&order=priority.asc,updated_at.desc&limit=80');
  if (!r.ok) return jsonResponse(500, { error: 'GUIDANCE_READ_FAILED' });
  const rules = await r.json();
  return jsonResponse(200, { rules: Array.isArray(rules) ? rules : [] });
};
