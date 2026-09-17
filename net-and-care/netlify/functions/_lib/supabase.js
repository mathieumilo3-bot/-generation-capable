// net-and-care/netlify/functions/_lib/supabase.js
//
// Appel REST Supabase en service_role, pour le site Net & Care.
//
// POURQUOI CE FICHIER N'EST PAS CELUI DE netlify/functions/_lib/
//   Le site Net & Care est déployé comme un site Netlify distinct, avec
//   « net-and-care/ » pour répertoire de base : rien au-dessus de ce dossier
//   n'entre dans le paquet de la fonction. Le site client est ainsi
//   indépendant de generationcapable.fr — il peut être déplacé, confié à un
//   tiers ou hébergé ailleurs sans rien casser, et les tâches planifiées de
//   Génération Capable ne se dupliquent pas sur ce déploiement.
//
// La clé service_role contourne la RLS. Elle ne quitte jamais le serveur :
// elle n'existe que dans les variables d'environnement Netlify.

const SUPABASE_URL = process.env.SUPABASE_URL || '';

// Incidents passagers : coupure réseau, limite de débit, indisponibilité
// momentanée. Rien à voir avec une requête invalide (4xx), qui échouerait
// identiquement au deuxième essai.
const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function supabaseAdminRequest(path, options = {}) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY absente');
  if (!SUPABASE_URL) throw new Error('SUPABASE_URL absente');

  const init = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(options.headers || {})
    }
  };

  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const r = await fetch(`${SUPABASE_URL}${path}`, init);
      if (RETRY_STATUSES.has(r.status) && attempt < MAX_ATTEMPTS) {
        await sleep(250 * attempt);
        continue;
      }
      return r;
    } catch (e) {
      // La requête n'a pas abouti : réessayer ne peut pas créer de doublon.
      lastError = e;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(250 * attempt);
        continue;
      }
    }
  }
  throw lastError || new Error(`Appel Supabase impossible : ${path}`);
}

module.exports = { supabaseAdminRequest };
