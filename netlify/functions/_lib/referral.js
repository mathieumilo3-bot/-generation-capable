// netlify/functions/_lib/referral.js
//
// Résolution du parrainage ambassadeur, partagée par les deux points d'entrée
// qui traitent un paiement abouti :
//   • verify-checkout-session.js — retour immédiat du navigateur après Stripe
//   • stripe-webhook.js          — événement serveur signé par Stripe
//
// POURQUOI LES DEUX
//   Le webhook est la source de vérité, mais il peut arriver en retard, être
//   rejoué, ou ne jamais partir (secret mal configuré, indisponibilité). Si
//   l'attribution n'existait qu'au niveau du webhook, une vente encaissée
//   pourrait rester définitivement sans ambassadeur — exactement le cas à
//   éviter. Les deux chemins écrivent donc l'attribution, et l'écriture est
//   conçue pour qu'ils ne se marchent jamais dessus :
//
//   1. On n'écrit QUE si l'abonné n'a pas déjà un parrain (premier arrivé,
//      premier servi) — un abonné ne change jamais d'ambassadeur.
//   2. L'upsert ne mentionne referred_by_ambassador_id que lorsqu'on a
//      réellement quelque chose à écrire, donc un chemin ne peut pas effacer
//      l'attribution posée par l'autre.

const { supabaseAdminRequest } = require('./supabase-admin');

// Même format que la contrainte SQL ambassadors_slug_format (migration 0020).
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/;

// Traduit le slug de parrainage (transporté dans les metadata Stripe depuis
// create-checkout-session.js) en identifiant d'ambassadeur.
//
// Renvoie null si le slug est absent, mal formé, inconnu, ou si l'ambassadeur
// est désactivé. Dans tous ces cas l'abonné est enregistré sans parrain —
// jamais rejeté : un problème d'attribution ne doit jamais bloquer un accès
// que le client a payé.
async function resolveAmbassadorIdBySlug(rawSlug) {
  const slug = String(rawSlug || '').toLowerCase().trim();
  if (!slug || !SLUG_RE.test(slug)) return null;

  try {
    const r = await supabaseAdminRequest(
      `/rest/v1/ambassadors?slug=eq.${encodeURIComponent(slug)}&select=id,is_active&limit=1`
    );
    if (!r.ok) {
      console.error('[referral] Résolution du slug échouée', r.status);
      return null;
    }
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    if (rows[0].is_active === false) return null;
    return rows[0].id;
  } catch (e) {
    console.error('[referral] resolveAmbassadorIdBySlug', e);
    return null;
  }
}

// Renvoie les champs d'attribution à fusionner dans l'upsert de "subscribers",
// ou un objet vide s'il n'y a rien à écrire.
//
// Lit l'état actuel de l'abonné avant de décider : c'est ce qui garantit
// qu'un abonné déjà attribué ne bascule jamais vers un autre ambassadeur,
// même s'il repasse plus tard par un lien différent.
async function referralFieldsForSubscriber(userId, rawSlug) {
  if (!rawSlug) return {};

  try {
    const r = await supabaseAdminRequest(
      `/rest/v1/subscribers?user_id=eq.${encodeURIComponent(userId)}&select=referred_by_ambassador_id`
    );
    if (r.ok) {
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0] && rows[0].referred_by_ambassador_id) {
        return {}; // déjà attribué → on n'y touche plus
      }
    }
  } catch (e) {
    console.error('[referral] Lecture de l\'attribution existante', e);
    return {}; // en cas de doute, ne rien écraser
  }

  const ambassadorId = await resolveAmbassadorIdBySlug(rawSlug);
  return ambassadorId ? { referred_by_ambassador_id: ambassadorId } : {};
}

module.exports = { resolveAmbassadorIdBySlug, referralFieldsForSubscriber };
