// netlify/functions/notify-cron-coach-background.js
//
// "Coach commercial automatique" — tourne toutes les 30 minutes (voir
// netlify.toml). Suffixe "-background" : Netlify accorde 15 minutes
// d'exécution au lieu de 10s, nécessaire pour parcourir l'ensemble des
// vendeurs actifs. Chaque vendeur n'est démarché qu'à un moment de son
// choix (préférences horaires) — voir isWithinActiveHours dans send.js.
//
// À CHAQUE PASSAGE, pour chaque vendeur actif dont les notifications sont
// activées :
//   - message du matin / objectif du jour / point de mi-journée / bilan du
//     soir, chacun envoyé une seule fois par jour (déduplication par date
//     locale — voir notification_log), au moment choisi dans SA fenêtre
//     horaire ("active_hours_start/end" des préférences) ;
//   - relance "aucune prospection aujourd'hui" si la fenêtre touche à sa
//     fin sans qu'aucun prospect/étape n'ait été créé aujourd'hui ;
//   - relance "tu nous manques" (2j / 4j / 7j+, une fois par semaine max)
//     si le vendeur n'a plus d'activité depuis plusieurs jours.
//
// Le ton (générique / "nouveau" / "performant") est choisi par
// segmentation.js — c'est le point d'adaptation "IA" du système.
//
// LIMITE DE PASSAGE À L'ÉCHELLE (documentée, pas cachée) : ce cron traite
// au plus MAX_SELLERS_PER_TICK vendeurs par passage, avec une concurrence
// bornée (voir concurrency.js). Confortable jusqu'à quelques milliers de
// vendeurs actifs ; au-delà, la bonne évolution est de pousser la sélection
// "qui est dû maintenant" côté SQL (fonction dédiée) plutôt que de la
// recalculer ici pour chacun — voir docs/notifications-system.md.

const { supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { sendToUser, getPreferences, localHour, localDateKey, startOfLocalDayUTC } = require('./_lib/notifications/send');
const { computeSellerProfile } = require('./_lib/notifications/segmentation');
const { mapWithConcurrency } = require('./_lib/notifications/concurrency');
const { isoWeekKey } = require('./_lib/notifications/time');

const MAX_SELLERS_PER_TICK = Number(process.env.MAX_SELLERS_PER_TICK || 2000);
const CONCURRENCY = 15;

async function fetchActiveSellers() {
  const r = await supabaseAdminRequest(
    `/rest/v1/subscribers?is_active=eq.true&select=user_id&limit=${MAX_SELLERS_PER_TICK}`
  );
  if (!r.ok) return [];
  const rows = await r.json();
  return Array.isArray(rows) ? rows.map(row => row.user_id) : [];
}

async function fetchFirstName(userId) {
  const r = await supabaseAdminRequest(`/rest/v1/profiles?user_id=eq.${userId}&select=display_name`);
  if (!r.ok) return null;
  const rows = await r.json();
  const displayName = rows && rows[0] && rows[0].display_name;
  if (!displayName) return null;
  return String(displayName).trim().split(/\s+/)[0] || null;
}

async function hadActivityToday(userId, timezone) {
  const startUTC = startOfLocalDayUTC(timezone).toISOString();
  const [prospects, stages] = await Promise.all([
    supabaseAdminRequest(`/rest/v1/prospects?seller_user_id=eq.${userId}&created_at=gte.${startUTC}&select=id&limit=1`),
    supabaseAdminRequest(`/rest/v1/prospect_stage_history?seller_user_id=eq.${userId}&created_at=gte.${startUTC}&select=id&limit=1`),
  ]);
  const p = prospects.ok ? await prospects.json() : [];
  const s = stages.ok ? await stages.json() : [];
  return (Array.isArray(p) && p.length > 0) || (Array.isArray(s) && s.length > 0);
}

async function processSeller(userId) {
  const prefs = await getPreferences(userId);
  if (prefs.enabled === false) return;

  const hour = localHour(prefs.timezone);
  const today = localDateKey(prefs.timezone);
  let start = prefs.active_hours_start;
  let end = prefs.active_hours_end;
  if (start === end) { start = 8; end = 20; }
  const span = (end - start + 24) % 24 || 24;

  const morningHour = start % 24;
  const goalHour = (start + 1) % 24;
  const middayHour = (start + Math.round(span / 2)) % 24;
  const eveningHour = (start + Math.max(span - 1, 1)) % 24;
  const noActivityCheckHour = (start + Math.max(span - 2, 1)) % 24;

  const prenom = await fetchFirstName(userId);
  const ctx = { prenom };

  if (hour === morningHour) {
    const segmentation = await computeSellerProfile(userId);
    await sendToUser({ userId, category: 'seller.coach.morning', eventKey: `morning:${today}`, ctx: { ...ctx, profile: segmentation.profile } });
  }
  if (hour === goalHour && goalHour !== morningHour) {
    await sendToUser({ userId, category: 'seller.coach.goal_prompt', eventKey: `goal_prompt:${today}`, ctx });
  }
  if (hour === middayHour) {
    await sendToUser({ userId, category: 'seller.coach.midday_checkin', eventKey: `midday:${today}`, ctx });
  }
  if (hour === eveningHour) {
    await sendToUser({ userId, category: 'seller.coach.evening_recap', eventKey: `evening:${today}`, ctx });
  }
  if (hour === noActivityCheckHour) {
    const active = await hadActivityToday(userId, prefs.timezone);
    if (!active) {
      await sendToUser({ userId, category: 'seller.coach.no_activity_today', eventKey: `no_activity:${today}`, ctx });
    }
    // La relance de plusieurs jours d'inactivité est évaluée au même
    // passage (une seule requête de segmentation par jour et par vendeur).
    const segmentation = await computeSellerProfile(userId);
    const days = segmentation.daysSinceLastActivity;
    const week = isoWeekKey(new Date());
    if (days !== null && days >= 7) {
      await sendToUser({ userId, category: 'seller.coach.inactivity_7d', eventKey: `inactivity7:${week}`, ctx });
    } else if (days !== null && days >= 4) {
      await sendToUser({ userId, category: 'seller.coach.inactivity_4d', eventKey: `inactivity4:${week}`, ctx });
    } else if (days !== null && days >= 2) {
      await sendToUser({ userId, category: 'seller.coach.inactivity_2d', eventKey: `inactivity2:${week}`, ctx });
    }
  }
}

exports.handler = async () => {
  const sellerIds = await fetchActiveSellers();
  await mapWithConcurrency(sellerIds, CONCURRENCY, processSeller);
  return jsonResponse(200, { processed: sellerIds.length });
};
