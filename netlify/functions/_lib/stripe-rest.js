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

// Version d'API Stripe.
//
// Sans en-tête Stripe-Version, chaque appel utilise la version PAR DÉFAUT DU
// COMPTE. Cette valeur n'est pas figée : le jour où quelqu'un clique
// « upgrade » dans le tableau de bord Stripe, la forme des réponses et des
// webhooks change d'un coup pour tout le code, sans qu'aucune ligne de ce
// dépôt n'ait bougé — le genre de panne qui survient des mois plus tard et
// qu'on ne relie à rien.
//
// Renseigner STRIPE_API_VERSION sur Netlify (ex: "2026-06-30.basil") fige le
// contrat, quel que soit le réglage du compte. Laissé vide, le comportement
// reste exactement celui d'aujourd'hui : on n'épingle pas une version au
// hasard, ce qui casserait le paiement immédiatement.
const STRIPE_API_VERSION = process.env.STRIPE_API_VERSION || null;

// Erreurs transitoires : coupure réseau, 429 (limite de débit) et 5xx côté
// Stripe. Un paiement ne doit pas échouer parce qu'un paquet s'est perdu.
const RETRY_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function stripeRequest(method, path, body) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY absente des variables d\'environnement Netlify');
  }
  const headers = {
    Authorization: `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  if (STRIPE_API_VERSION) headers['Stripe-Version'] = STRIPE_API_VERSION;

  const opts = { method, headers };
  if (body) opts.body = toFormParams(body).toString();

  // Clé d'idempotence : si une réponse se perd en route et qu'on réessaie,
  // Stripe reconnaît la requête déjà traitée au lieu de créer un second
  // paiement ou une seconde session. Indispensable dès qu'on réessaie une
  // écriture.
  if (method !== 'GET') {
    opts.headers['Idempotency-Key'] =
      `gc-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const r = await fetch(`${STRIPE_API}${path}`, opts);
      const data = await r.json();

      if (!r.ok && RETRY_STATUSES.has(r.status) && attempt < MAX_ATTEMPTS) {
        await sleep(300 * attempt);   // 300 ms, puis 600 ms
        continue;
      }
      return { ok: r.ok, status: r.status, data };

    } catch (e) {
      // Panne réseau : rien n'a été lu, on peut réessayer sans risque grâce
      // à la clé d'idempotence ci-dessus.
      lastError = e;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(300 * attempt);
        continue;
      }
    }
  }
  throw lastError || new Error('Appel Stripe impossible');
}

module.exports = { stripeRequest };
