// net-and-care/netlify/functions/_lib/rate-limit.js
//
// Limitation de débit du formulaire de devis.
//
// PRINCIPE
//   Le compteur vit en base (fonction SQL rate_limit_check, migration 0024) :
//   les fonctions Netlify sont éphémères et multipliées à la demande, un
//   compteur en mémoire ne verrait qu'une fraction du trafic.
//
// RÈGLE DE CONCEPTION : NE JAMAIS BLOQUER UN PROSPECT LÉGITIME.
//   Si le contrôle lui-même échoue — base indisponible, fonction SQL absente
//   parce que le projet Supabase n'a pas encore reçu la migration — on LAISSE
//   PASSER. Une demande de devis perdue coûte un client ; quelques envois
//   parasites pendant une panne ne coûtent que des emails.

const { supabaseAdminRequest } = require('./supabase.js');

// Identifiant d'appelant : l'IP telle que vue par Netlify. Jamais conservée
// ailleurs que dans ce compteur, purgé automatiquement.
function callerKey(event, prefix) {
  const ip =
    (event.headers['x-nf-client-connection-ip'] ||
     (event.headers['x-forwarded-for'] || '').split(',')[0] ||
     '').trim();
  return ip ? `${prefix}:${ip}` : null;
}

// true = appel autorisé, false = au-delà de la limite.
async function allow(event, prefix, maxHits = 30, windowSeconds = 60) {
  const key = callerKey(event, prefix);
  if (!key) return true;                                 // IP indéterminable
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return true; // pas de compteur disponible

  try {
    const r = await supabaseAdminRequest('/rest/v1/rpc/rate_limit_check', {
      method: 'POST',
      body: JSON.stringify({
        p_key: key,
        p_max_hits: maxHits,
        p_window_seconds: windowSeconds
      })
    });
    if (!r.ok) return true;
    const allowed = await r.json();
    return allowed !== false;
  } catch (e) {
    console.warn('[rate-limit] contrôle indisponible, appel laissé passer');
    return true;
  }
}

module.exports = { allow };
