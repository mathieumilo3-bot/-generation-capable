// netlify/functions/_lib/stripe-rest.js
//
// Appels REST directs à l'API Stripe (pas de SDK npm) : ce dépôt n'a pas de
// package.json / étape d'installation de dépendances pour les Netlify
// Functions (ai-proxy.js et ambassador-data.js utilisent déjà fetch() nu).
// Ajouter le SDK Stripe demanderait de mettre en place tout un pipeline de
// build qui n'existe pas aujourd'hui — on reste cohérent avec l'existant.

const STRIPE_API = 'https://api.stripe.com/v1';

// Encode un objet JS (potentiellement imbriqué) au format
// application/x-www-form-urlencoded attendu par l'API Stripe, ex:
// { line_items: [{ price: 'x', quantity: 1 }] } →
// "line_items[0][price]=x&line_items[0][quantity]=1"
function toFormParams(obj, prefix, params) {
  params = params || new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    const paramKey = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (item !== null && typeof item === 'object') {
          toFormParams(item, `${paramKey}[${i}]`, params);
        } else {
          params.append(`${paramKey}[${i}]`, String(item));
        }
      });
    } else if (typeof value === 'object') {
      toFormParams(value, paramKey, params);
    } else {
      params.append(paramKey, String(value));
    }
  }
  return params;
}

async function stripeRequest(method, path, body) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY absente des variables d\'environnement Netlify');
  }
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };
  if (body) opts.body = toFormParams(body).toString();

  const r = await fetch(`${STRIPE_API}${path}`, opts);
  const data = await r.json();
  return { ok: r.ok, status: r.status, data };
}

module.exports = { stripeRequest };
