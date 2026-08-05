// netlify/functions/ambassador-data.js
//
// Pont entre GC Ambassadors OS (ambassadors.html) et la base Supabase.
//
// AUTH (2026-07-27) : ambassadors.html envoie un vrai token de session
// Supabase (Authorization: Bearer <access_token>, obtenu via le magic link),
// jamais un email en clair. Cette fonction vérifie ce token auprès de
// Supabase Auth et utilise l'email qu'il contient comme identité.
//
// FIX (audit production) : cette fonction appelait ensuite l'API REST
// Supabase avec la clé ANON (publique, visible dans ambassadors.html). Pour
// que ça fonctionne, la RLS de la table "ambassadors" devait forcément
// autoriser le rôle "anon" à lire/écrire — ce qui voulait dire que N'IMPORTE
// QUI pouvait appeler l'API Supabase directement avec cette même clé et
// lire/écrire les données de n'importe quel ambassadeur en devinant son
// email, en contournant complètement la vérification de token ci-dessous.
// Fix : la fonction utilise maintenant SUPABASE_SERVICE_ROLE_KEY (qui
// contourne la RLS) pour l'accès aux données, après avoir vérifié le token
// elle-même. La RLS sur "ambassadors" n'accorde plus aucun accès à
// anon/authenticated (voir supabase/migrations/0001_subscribers_roles_and_rls.sql) :
// cette fonction redevient la seule porte d'entrée possible.
//
// ROUTES
//   GET  /.netlify/functions/ambassador-data
//        (Authorization: Bearer <session_token> requis)
//        → renvoie l'état de l'ambassadeur authentifié (le crée avec l'état
//          par défaut si c'est sa première connexion)
//   POST /.netlify/functions/ambassador-data  { state }
//        (Authorization: Bearer <session_token> requis)
//        → écrit l'état de l'ambassadeur authentifié

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { notifyAdmins, safeNotify } = require('./_lib/notifications/send');

const MAX_STATE_BYTES = 200_000; // large marge au-dessus d'un usage normal, évite l'abus

// État "métier" de l'ambassadeur : uniquement ce qui lui appartient et qu'il
// modifie lui-même (missions cochées, progression de formation, historique de
// chat). Les revenus et le lien de parrainage n'y figurent PLUS : ils sont
// calculés en base à partir des paiements Stripe (voir buildReferral). Les
// anciens champs "revenue" et "code" — un bloc de zéros et un identifiant
// tiré au hasard, que rien n'alimentait — ont été retirés pour qu'aucune
// interface ne puisse à nouveau afficher des chiffres inventés.
function defaultState(){
  return {
    active: true,
    name: 'Ambassadeur',
    missionDone: [false, false],
    training: [
      { title: 'Comprendre l\'offre Génération Capable', done: true },
      { title: 'Créer ton premier contenu TikTok', done: false },
      { title: 'Traiter les objections courantes', done: false },
      { title: 'Convertir un prospect en abonné', done: false }
    ],
    chatHistory: []
  };
}

// Domaine public sur lequel les liens de parrainage sont partagés. Codé ici
// (et non déduit de l'Origin de la requête) pour qu'un ambassadeur consultant
// son espace depuis une prévisualisation Netlify copie malgré tout le lien de
// production, et jamais une URL de test.
const PUBLIC_SITE = 'https://generationcapable.fr';

// Statistiques réelles de l'ambassadeur — clics, filleuls, abonnés actifs,
// gains — calculées en base par ambassador_dashboard(). Remplace l'ancien
// bloc "revenue" du JSON d'état, qui n'était alimenté par rien et affichait
// donc des zéros perpétuels.
async function buildReferral(ambassadorId, slug, identity) {
  const link = slug ? `${PUBLIC_SITE}/${slug}` : null;
  const ident = identity || {};
  const base = {
    slug,
    link,
    first_name: ident.first_name || null,
    last_name: ident.last_name || null,
    // Tant que c'est faux, l'espace ambassadeur demande le prénom et le nom
    // avant d'afficher quoi que ce soit d'autre : sans eux, le lien serait
    // dérivé de l'adresse email, ce qui donne des liens illisibles du type
    // generationcapable.fr/jsnko911.
    identity_set: !!(ident.first_name || ident.last_name),
    // Dernière écriture réelle de l'état de cet ambassadeur (colonne
    // updated_at, déjà présente sur la table). Ajouté pour GC Pilot v1
    // (voir docs/gc-ai-os/17-21) : détecter une inactivité de plusieurs
    // jours pour proposer une mission de réactivation plutôt que d'empiler
    // une nouvelle tâche par-dessus un retard déjà là. Simple lecture
    // d'une colonne existante — aucune migration, aucun nouveau droit.
    updated_at: ident.updated_at || null,
  };
  try {
    const r = await supabaseAdminRequest('/rest/v1/rpc/ambassador_dashboard', {
      method: 'POST',
      body: JSON.stringify({ p_ambassador_id: ambassadorId }),
    });
    if (!r.ok) {
      console.error('[ambassador-data] ambassador_dashboard a échoué', r.status);
      return { ...base, stats: null };
    }
    return { ...base, stats: await r.json() };
  } catch (e) {
    console.error('[ambassador-data] buildReferral', e);
    return { ...base, stats: null };
  }
}

// Nom d'une personne : lettres (accents compris), espaces, apostrophes et
// traits d'union. Volontairement permissif sur la forme, strict sur ce qui
// n'a rien à faire dans un nom (chiffres, balises, symboles).
const NAME_RE = /^[\p{L}][\p{L}\s'’-]{0,59}$/u;

function cleanName(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

// Enregistre prénom + nom et en dérive le lien de parrainage.
async function setIdentity(email, rawFirst, rawLast) {
  const firstName = cleanName(rawFirst);
  const lastName  = cleanName(rawLast);

  if (!NAME_RE.test(firstName) || !NAME_RE.test(lastName)) {
    return jsonResponse(200, {
      error: 'INVALID_NAME',
      message: 'Renseigne un prénom et un nom valides (lettres, tirets et apostrophes uniquement).',
    });
  }

  const r = await supabaseAdminRequest(
    `/rest/v1/ambassadors?email=eq.${encodeURIComponent(email)}&select=id,slug,first_name,last_name`
  );
  const rows = r.ok ? await r.json() : [];
  const amb = Array.isArray(rows) ? rows[0] : null;
  if (!amb) return jsonResponse(404, { error: 'AMBASSADOR_NOT_FOUND' });

  // Le lien n'est (re)calculé que tant qu'aucun vrai nom n'a été enregistré.
  // Passé ce point, le lien est considéré comme diffusé : on n'y touche plus.
  const identityAlreadySet = !!(amb.first_name || amb.last_name);

  const fields = {
    first_name: firstName,
    last_name: lastName,
    updated_at: new Date().toISOString(),
  };

  let slug = amb.slug;
  if (!identityAlreadySet) {
    try {
      const genR = await supabaseAdminRequest('/rest/v1/rpc/generate_ambassador_slug', {
        method: 'POST',
        body: JSON.stringify({ p_base: `${firstName} ${lastName}`, p_exclude_id: amb.id }),
      });
      if (genR.ok) {
        const generated = await genR.json();
        if (generated) { slug = generated; fields.slug = generated; }
      } else {
        console.error('[ambassador-data] generate_ambassador_slug a échoué', genR.status);
      }
    } catch (e) {
      console.error('[ambassador-data] setIdentity / slug', e);
    }
  }

  const upR = await supabaseAdminRequest(`/rest/v1/ambassadors?id=eq.${amb.id}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(fields),
  });
  if (!upR.ok) {
    const detail = await upR.text();
    console.error('[ambassador-data] Écriture identité échouée', upR.status, detail);
    return jsonResponse(200, { error: 'WRITE_ERROR', message: 'Enregistrement impossible, réessaie.' });
  }

  return jsonResponse(200, { ok: true, referral: await buildReferral(amb.id, slug) });
}

exports.handler = async (event) => {
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('[ambassador-data] SUPABASE_ANON_KEY absente sur Netlify.');
    return jsonResponse(200, { error: 'NO_SUPABASE_KEY', message: "Clé Supabase non configurée sur Netlify (SUPABASE_ANON_KEY)." });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[ambassador-data] SUPABASE_SERVICE_ROLE_KEY absente sur Netlify.');
    return jsonResponse(200, { error: 'NO_SERVICE_ROLE_KEY', message: "Clé Supabase privilégiée non configurée sur Netlify (SUPABASE_SERVICE_ROLE_KEY)." });
  }

  const { email, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) {
    console.error('[ambassador-data] Auth échouée:', authError);
    return jsonResponse(401, { error: authError, message: 'Session invalide ou expirée — reconnecte-toi.' });
  }

  try {
    if (event.httpMethod === 'GET') {
      const r = await supabaseAdminRequest(
        `/rest/v1/ambassadors?email=eq.${encodeURIComponent(email)}&select=id,state,slug,first_name,last_name,updated_at`
      );
      const rows = await r.json();
      if (!r.ok) {
        console.error('[ambassador-data] Erreur lecture Supabase', r.status, JSON.stringify(rows));
        return jsonResponse(200, { error: 'SUPABASE_READ_ERROR', detail: rows });
      }

      if (rows.length > 0) {
        const amb = rows[0];
        // Aucun slug n'est fabriqué à partir de l'email : l'ambassadeur
        // saisit son prénom et son nom (voir setIdentity), et c'est de là que
        // vient son lien. Un slug dérivé d'une adresse donnerait
        // generationcapable.fr/jsnko911 — impossible à mettre dans une bio.
        return jsonResponse(200, {
          state: amb.state,
          referral: await buildReferral(amb.id, amb.slug, amb),
        });
      }

      // Ambassadeur inconnu → première connexion, on le crée avec l'état par défaut.
      const initial = defaultState();
      const createR = await supabaseAdminRequest('/rest/v1/ambassadors', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ email, state: initial })
      });
      const created = await createR.json();
      if (!createR.ok) {
        console.error('[ambassador-data] Erreur création Supabase', createR.status, JSON.stringify(created));
        return jsonResponse(200, { error: 'SUPABASE_CREATE_ERROR', detail: created });
      }
      await safeNotify(() => notifyAdmins({
        category: 'admin.business.new_ambassador',
        eventKey: `new_ambassador:${email}`,
        ctx: { email },
      }));

      // Nouvel ambassadeur : pas encore de lien. L'espace lui demandera son
      // prénom et son nom, et le lien sera créé à ce moment-là.
      const newRow = Array.isArray(created) ? created[0] : created;
      return jsonResponse(200, {
        state: initial,
        referral: newRow && newRow.id ? await buildReferral(newRow.id, null, newRow) : null,
      });
    }

    if (event.httpMethod === 'POST') {
      let payload;
      try {
        payload = JSON.parse(event.body || '{}');
      } catch (e) {
        return jsonResponse(400, { error: 'Invalid JSON body' });
      }
      // Enregistrement de l'identité — c'est CE moment qui fabrique le lien
      // personnel. L'ambassadeur saisit son prénom et son nom, le slug en est
      // dérivé, et generationcapable.fr/prenom-nom existe aussitôt.
      //
      // Le slug n'est calculé que si l'ambassadeur n'en avait pas encore un
      // choisi à partir de son vrai nom : une fois qu'il a diffusé son lien
      // (bio TikTok, messages, flyers), le changer casserait tout ce qui
      // pointe dessus. Une correction reste possible côté administration.
      if (payload.action === 'set_identity') {
        return await setIdentity(email, payload.first_name, payload.last_name);
      }

      const { state } = payload;
      if (!state) return jsonResponse(400, { error: 'Missing state' });
      if (JSON.stringify(state).length > MAX_STATE_BYTES) {
        return jsonResponse(413, { error: 'STATE_TOO_LARGE' });
      }

      const r = await supabaseAdminRequest(
        `/rest/v1/ambassadors?email=eq.${encodeURIComponent(email)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ state, updated_at: new Date().toISOString() })
        }
      );
      if (!r.ok) {
        const detail = await r.text();
        console.error('[ambassador-data] Erreur écriture Supabase', r.status, detail);
        return jsonResponse(200, { error: 'SUPABASE_WRITE_ERROR', detail });
      }
      return jsonResponse(200, { ok: true });
    }

    return jsonResponse(405, { error: 'Method not allowed' });

  } catch (e) {
    console.error('[ambassador-data] NETWORK_ERROR', e);
    return jsonResponse(200, { error: 'NETWORK_ERROR', message: String(e) });
  }
};
