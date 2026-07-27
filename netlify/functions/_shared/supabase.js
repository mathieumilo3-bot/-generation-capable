const SUPABASE_URL = process.env.SUPABASE_URL || 'https://fkhfahmzxsahrstxntjs.supabase.co';

function getAnonKey() {
  return process.env.SUPABASE_ANON_KEY;
}

function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
}

function restHeaders(key, prefer) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

async function getVerifiedUser(event) {
  const anonKey = getAnonKey();
  if (!anonKey) return { error: 'NO_SUPABASE_KEY' };

  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) return { error: 'MISSING_TOKEN' };
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: 'MISSING_TOKEN' };

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return { error: 'INVALID_TOKEN' };

  const user = await response.json();
  if (!user?.email) return { error: 'INVALID_TOKEN' };

  return {
    user: {
      id: user.id,
      email: user.email.toLowerCase(),
      raw: user
    },
    token
  };
}

async function supabaseFetch(path, options = {}) {
  const key = options.serviceRole ? getServiceKey() : getAnonKey();
  if (!key) return { ok: false, status: 500, data: { error: 'NO_SUPABASE_KEY' } };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: { ...restHeaders(key, options.prefer), ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (_) { data = text; }
  }
  return { ok: response.ok, status: response.status, data };
}

module.exports = { SUPABASE_URL, getAnonKey, getServiceKey, getVerifiedUser, supabaseFetch, restHeaders };
