// netlify/functions/cron-ambassador-earnings.js
//
// Crédite les 15 €/mois dus à chaque ambassadeur pour chaque abonné qu'il a
// apporté et qui est TOUJOURS actif. Tourne une fois par jour (voir
// netlify.toml) — et non une fois par mois — volontairement :
//
//   • un abonné qui s'abonne le 20 du mois est crédité dès le lendemain,
//     sans attendre le 1er du mois suivant ;
//   • si une exécution échoue (panne réseau, redéploiement), la suivante
//     rattrape automatiquement.
//
// Repasser tous les jours n'entraîne AUCUN double-comptage : la fonction SQL
// run_ambassador_monthly_earnings() insère avec ON CONFLICT DO NOTHING sur
// l'index unique (ambassador_id, subscriber_user_id, period_month). Un même
// abonné ne peut donc générer qu'une seule ligne de 15 € par mois, quelle que
// soit le nombre de passages.
//
// La règle "tant que l'abonné reste abonné" est appliquée naturellement :
// seuls les abonnés avec is_active = true sont pris chaque mois. Un abonné
// qui se désabonne cesse simplement d'apparaître les mois suivants, sans
// qu'aucun gain déjà acquis ne soit repris.

const { supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');

exports.handler = async () => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[cron-ambassador-earnings] SUPABASE_SERVICE_ROLE_KEY absente sur Netlify.');
    return jsonResponse(200, { ok: false, error: 'NO_SERVICE_ROLE_KEY' });
  }

  try {
    const r = await supabaseAdminRequest('/rest/v1/rpc/run_ambassador_monthly_earnings', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error('[cron-ambassador-earnings] RPC échouée', r.status, JSON.stringify(data));
      return jsonResponse(200, { ok: false, detail: data });
    }

    // "created: 0" est le cas NORMAL et attendu la plupart des jours : cela
    // signifie que tous les gains du mois en cours ont déjà été posés.
    console.log('[cron-ambassador-earnings]', JSON.stringify(data));

    // Purge des clics de plus de 24 mois — greffée ici plutôt que dans un
    // cron dédié : c'est une opération rare et brève, et un job de plus
    // serait un job de plus à surveiller. Un échec de purge ne doit jamais
    // faire échouer le crédit des gains, qui est la mission principale.
    let purged = null;
    try {
      const purgeR = await supabaseAdminRequest('/rest/v1/rpc/purge_old_referral_clicks', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (purgeR.ok) {
        purged = await purgeR.json();
        if (purged) console.log('[cron-ambassador-earnings] clics purgés:', purged);
      }
    } catch (e) {
      console.error('[cron-ambassador-earnings] Purge des clics échouée (non bloquant)', e);
    }

    return jsonResponse(200, { ok: true, ...data, purged_clicks: purged });

  } catch (e) {
    console.error('[cron-ambassador-earnings] NETWORK_ERROR', e);
    return jsonResponse(200, { ok: false, error: String(e) });
  }
};
