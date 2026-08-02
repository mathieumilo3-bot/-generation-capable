// netlify/functions/_lib/notifications/segmentation.js
//
// "IA" d'adaptation du coaching commercial : pas de modèle externe, un
// scoring comportemental transparent calculé à partir des données réelles
// du vendeur (prospection + ventes), qui classe chaque vendeur dans un
// profil. Ce profil pilote ensuite (dans notify-cron-coach.js) le ton des
// messages et l'agressivité de la relance — vendeur très actif → messages
// plus ambitieux, vendeur inactif → relance, nouveau vendeur → accompagnement
// quotidien renforcé, vendeur performant → défis plus élevés.
//
// Volontairement lisible et déterministe (pas de boîte noire) : un modèle de
// scoring qu'on ne peut pas expliquer à l'admin qui l'a demandé n'a pas sa
// place dans un système censé "augmenter l'engagement sans devenir intrusif".

const { supabaseAdminRequest } = require('../supabase-admin');

const PROFILES = {
  NEW: 'new',
  ACTIVE: 'active',
  TOP: 'top',
  INACTIVE: 'inactive',
};

async function fetchJson(path) {
  const r = await supabaseAdminRequest(path);
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

// Renvoie le profil comportemental d'un vendeur + les métriques qui l'ont
// produit (utile pour le contexte des messages : "3 jours sans activité").
async function computeSellerProfile(sellerUserId) {
  const since30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const since14d = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

  const [salesLast30d, allSales, recentProspectActivity, recentStageActivity] = await Promise.all([
    fetchJson(`/rest/v1/sales?seller_user_id=eq.${sellerUserId}&status=eq.completed&created_at=gte.${since30d}&select=id,amount,created_at`),
    fetchJson(`/rest/v1/sales?seller_user_id=eq.${sellerUserId}&status=eq.completed&select=id,created_at&order=created_at.asc&limit=1`),
    fetchJson(`/rest/v1/prospects?seller_user_id=eq.${sellerUserId}&select=created_at&order=created_at.desc&limit=1`),
    fetchJson(`/rest/v1/prospect_stage_history?seller_user_id=eq.${sellerUserId}&select=created_at&order=created_at.desc&limit=1`),
  ]);

  const firstSaleAt = allSales[0]?.created_at ? new Date(allSales[0].created_at) : null;
  const totalSalesCount = allSales.length; // limité à 1 par la requête ci-dessus, seulement utilisé pour "a déjà vendu"

  const lastProspectAt = recentProspectActivity[0]?.created_at ? new Date(recentProspectActivity[0].created_at) : null;
  const lastStageAt = recentStageActivity[0]?.created_at ? new Date(recentStageActivity[0].created_at) : null;
  const lastActivityAt = [lastProspectAt, lastStageAt].filter(Boolean).sort((a, b) => b - a)[0] || null;

  const daysSinceLastActivity = lastActivityAt
    ? Math.floor((Date.now() - lastActivityAt.getTime()) / (24 * 3600 * 1000))
    : null;

  const salesCount30d = salesLast30d.length;
  const revenue30dCents = salesLast30d.reduce((sum, s) => sum + (s.amount || 0), 0);

  // Compte réel de ventes totales pour distinguer "aucune vente" de "au
  // moins une" — on ne veut pas d'un COUNT(*) coûteux ici, un HEAD suffit.
  const countResp = await supabaseAdminRequest(
    `/rest/v1/sales?seller_user_id=eq.${sellerUserId}&status=eq.completed&select=id`,
    { headers: { Prefer: 'count=exact', Range: '0-0' } }
  );
  const contentRange = countResp.headers.get('content-range') || '';
  const totalSalesEver = Number(contentRange.split('/')[1]) || totalSalesCount;

  let profile = PROFILES.ACTIVE;
  const isNewSeller = !firstSaleAt || firstSaleAt.toISOString() >= since14d;

  if (daysSinceLastActivity !== null && daysSinceLastActivity >= 2 && totalSalesEver === 0 && isNewSeller) {
    // Nouveau et déjà en train de décrocher : traité comme "nouveau", pas
    // "inactif" — l'accompagnement doit rester encourageant, pas alarmiste.
    profile = PROFILES.NEW;
  } else if (daysSinceLastActivity === null || daysSinceLastActivity >= 2) {
    profile = PROFILES.INACTIVE;
  } else if (salesCount30d >= 3 || revenue30dCents >= 150000) {
    profile = PROFILES.TOP;
  } else if (isNewSeller) {
    profile = PROFILES.NEW;
  } else {
    profile = PROFILES.ACTIVE;
  }

  return {
    profile,
    daysSinceLastActivity,
    salesCount30d,
    revenue30dCents,
    totalSalesEver,
    isNewSeller,
  };
}

module.exports = { PROFILES, computeSellerProfile };
