// netlify/functions/_lib/rate-limit.js
//
// Limitation de débit des points d'entrée publics (voir migration 0024).
//
// PRINCIPE
//   Le compteur vit en base, pas en mémoire : les fonctions Netlify sont
//   éphémères et multipliées à la demande, un compteur local ne verrait
//   qu'une fraction du trafic et n'arrêterait rien.
//
// RÈGLE DE CONCEPTION : ne jamais bloquer un utilisateur légitime.
//   Si le contrôle lui-même échoue (base indisponible, erreur inattendue),
//   on LAISSE PASSER. Un flood non filtré pendant une panne est un moindre
//   mal comparé à un site qui refuse tous ses visiteurs parce qu'une table
//   annexe ne répond pas.

const { supabaseAdminRequest } = require('./supabase-admin');

// Identifiant d'appelant : l'IP telle que vue par Netlify. Jamais stockée en
// clair ailleurs que dans ce compteur éphémère (purgé au bout d'une heure).
function callerKey(event, prefix) {
  const ip =
    (event.headers['x-nf-client-connection-ip'] ||
     (event.headers['x-forwarded-for'] || '').split(',')[0] ||
     '').trim();
  if (!ip) return null;
  return `${prefix}:${ip}`;
}

// Renvoie true si l'appel est autorisé, false s'il dépasse la limite.
async function allow(event, prefix, maxHits = 30, windowSeconds = 60) {
  const key = callerKey(event, prefix);
  if (!key) return true;   // IP indéterminable : on ne bloque pas

  try {
    const r = await supabaseAdminRequest('/rest/v1/rpc/rate_limit_check', {
      method: 'POST',
      body: JSON.stringify({
        p_key: key,
        p_max_hits: maxHits,
        p_window_seconds: windowSeconds,
      }),
    });
    if (!r.ok) return true;          // contrôle indisponible → on laisse passer
    const allowed = await r.json();
    return allowed !== false;
  } catch (e) {
    console.error('[rate-limit] Contrôle impossible (non bloquant)', e);
    return true;
  }
}

// Réponse standard en cas de dépassement.
function tooManyRequests(message) {
  return {
    statusCode: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    body: JSON.stringify({
      error: 'RATE_LIMITED',
      message: message || 'Trop de requêtes — réessaie dans une minute.',
    }),
  };
}

module.exports = { allow, tooManyRequests };
