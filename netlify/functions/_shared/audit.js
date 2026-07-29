const crypto = require('crypto');
const { supabaseFetch } = require('./supabase');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clientIp(event) {
  return event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || event.headers['x-forwarded-for'] || '';
}

async function writeAudit(event, entry) {
  const previous = await supabaseFetch('gc_audit_log?select=event_hash&order=created_at.desc&limit=1', { serviceRole: true });
  const previousHash = Array.isArray(previous.data) && previous.data[0]?.event_hash ? previous.data[0].event_hash : null;
  const payload = {
    actor_user_id: entry.actor_user_id || null,
    actor_email: entry.actor_email || null,
    actor_role: entry.actor_role || null,
    action: entry.action,
    resource_type: entry.resource_type,
    resource_id: entry.resource_id || null,
    ip_hash: clientIp(event) ? sha256(clientIp(event)) : null,
    user_agent: event.headers['user-agent'] || event.headers['User-Agent'] || null,
    metadata: entry.metadata || {},
    previous_hash: previousHash
  };
  payload.event_hash = sha256(JSON.stringify({ ...payload, created_at_bucket: new Date().toISOString() }));
  return supabaseFetch('gc_audit_log', { method: 'POST', body: payload, prefer: 'return=minimal', serviceRole: true });
}

async function recordAnomaly(signal, severity, score, metadata = {}, actorEmail = null) {
  return supabaseFetch('gc_anomaly_events', {
    method: 'POST',
    body: { signal, severity, score, metadata, actor_email: actorEmail },
    prefer: 'return=minimal',
    serviceRole: true
  });
}

async function detectBasicAnomalies(event, context) {
  const anomalies = [];
  const ua = event.headers['user-agent'] || '';
  const bodySize = event.body ? Buffer.byteLength(event.body, 'utf8') : 0;
  if (!ua) anomalies.push({ signal: 'missing_user_agent', severity: 'low', score: 15 });
  if (bodySize > 100000) anomalies.push({ signal: 'large_payload', severity: 'medium', score: 45, metadata: { bodySize } });
  if (context?.email && /\+.*\+/.test(context.email)) anomalies.push({ signal: 'suspicious_email_alias', severity: 'low', score: 20 });
  for (const anomaly of anomalies) {
    await recordAnomaly(anomaly.signal, anomaly.severity, anomaly.score, anomaly.metadata || {}, context?.email || null);
  }
  return anomalies;
}

module.exports = { sha256, writeAudit, recordAnomaly, detectBasicAnomalies };
