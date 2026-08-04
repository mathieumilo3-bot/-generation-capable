// netlify/functions/referral-track.js
//
// Premier maillon de la chaîne d'attribution des ventes aux ambassadeurs.
//
// Quand un visiteur arrive sur generationcapable.fr/<slug>, le site appelle
// cette fonction. Elle a deux rôles :
//   1. VALIDER le slug côté serveur (le navigateur ne doit jamais décider
//      seul qu'un code de parrainage est valable) ;
//   2. ENREGISTRER le clic, pour que l'ambassadeur voie son trafic même
//      quand le visiteur n'achète pas.
//
// Elle ne renvoie QUE le prénom/nom d'affichage et le slug canonique — jamais
// l'email de l'ambassadeur ni son identifiant interne. Le front stocke le
// slug ; c'est le serveur qui le retraduira en ambassador_id au moment du
// paiement (voir create-checkout-session.js → stripe-webhook.js).
//
// POST /.netlify/functions/referral-track   { slug }
//   → { valid: true, slug, name }   |   { valid: false }

const crypto = require('crypto');
const { supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');

// Même format que la contrainte SQL ambassadors_slug_format (migration 0020).
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;

// Fenêtre pendant laquelle un même visiteur ne recompte pas comme un clic.
// Évite qu'un rafraîchissement de page gonfle artificiellement les chiffres
// d'un ambassadeur.
const CLICK_DEDUP_MINUTES = 30;

// On ne conserve jamais l'IP brute. Le sel rend le hachage non réversible
// par force brute sur l'espace des IPv4 (qui est petit). À défaut de sel
// configuré, on retombe sur la clé de service, déjà secrète et présente.
function visitorHash(event) {
  const ip =
    (event.headers['x-nf-client-connection-ip'] ||
     (event.headers['x-forwarded-for'] || '').split(',')[0] ||
     '').trim();
  const ua = event.headers['user-agent'] || '';
  if (!ip && !ua) return null;
  const salt = process.env.REFERRAL_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return crypto.createHash('sha256').update(salt + '|' + ip + '|' + ua).digest('hex').slice(0, 32);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[referral-track] SUPABASE_SERVICE_ROLE_KEY absente sur Netlify.');
    return jsonResponse(200, { valid: false, error: 'NO_SERVICE_ROLE_KEY' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const slug = String(payload.slug || '').toLowerCase().trim();
  if (!slug || !SLUG_RE.test(slug)) {
    // Slug mal formé : ce n'est pas une erreur, juste une URL qui ne
    // correspond à aucun ambassadeur (faute de frappe, lien inventé…).
    return jsonResponse(200, { valid: false });
  }

  try {
    const r = await supabaseAdminRequest(
      `/rest/v1/ambassadors?slug=eq.${encodeURIComponent(slug)}` +
      `&select=id,slug,first_name,last_name,is_active,state`
    );
    const rows = await r.json();
    if (!r.ok) {
      console.error('[referral-track] Lecture ambassadeur échouée', r.status, JSON.stringify(rows));
      return jsonResponse(200, { valid: false });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return jsonResponse(200, { valid: false });
    }

    const amb = rows[0];
    // Un ambassadeur désactivé garde son lien fonctionnel comme page d'accueil
    // normale, mais ne reçoit plus d'attribution.
    if (amb.is_active === false) {
      return jsonResponse(200, { valid: false });
    }

    const displayName =
      [amb.first_name, amb.last_name].filter(Boolean).join(' ').trim() ||
      (amb.state && amb.state.name && amb.state.name !== 'Ambassadeur' ? amb.state.name : '') ||
      '';

    // Enregistrement du clic — jamais bloquant pour la réponse : si le log
    // échoue, le visiteur doit quand même être attribué correctement.
    const hash = visitorHash(event);
    try {
      let alreadySeen = false;
      if (hash) {
        const since = new Date(Date.now() - CLICK_DEDUP_MINUTES * 60_000).toISOString();
        const dedupR = await supabaseAdminRequest(
          `/rest/v1/referral_clicks?ambassador_id=eq.${amb.id}` +
          `&visitor_hash=eq.${encodeURIComponent(hash)}` +
          `&occurred_at=gt.${encodeURIComponent(since)}&select=id&limit=1`
        );
        if (dedupR.ok) {
          const seen = await dedupR.json();
          alreadySeen = Array.isArray(seen) && seen.length > 0;
        }
      }

      if (!alreadySeen) {
        await supabaseAdminRequest('/rest/v1/referral_clicks', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({
            ambassador_id: amb.id,
            slug: amb.slug,
            visitor_hash: hash,
            referrer: (event.headers.referer || '').slice(0, 500) || null,
            user_agent: (event.headers['user-agent'] || '').slice(0, 300) || null,
          }),
        });
      }
    } catch (e) {
      console.error('[referral-track] Enregistrement du clic échoué (non bloquant)', e);
    }

    return jsonResponse(200, { valid: true, slug: amb.slug, name: displayName });

  } catch (e) {
    console.error('[referral-track] NETWORK_ERROR', e);
    return jsonResponse(200, { valid: false });
  }
};
