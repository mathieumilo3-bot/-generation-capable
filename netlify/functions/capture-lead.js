// netlify/functions/capture-lead.js
//
// Capture un prospect anonyme qui a laissé ses coordonnées (formulaire
// d'inscription) sans avoir terminé son paiement — déclenche la séquence
// email de relance (30min / 24h / 3j / 7j, voir notify-cron-leads.js).
// Endpoint public par nature (appelé avant même la création d'un compte) :
// aucune donnée sensible n'est jamais renvoyée, et le body de réponse est
// volontairement identique quel que soit le cas pour ne rien révéler sur
// l'existence d'un lead préexistant.
//
// POST /.netlify/functions/capture-lead
//   { email, first_name?, phone?, source? }
//   → { ok: true }  (toujours, sauf entrée manifestement invalide)
//
// checkout.session.completed (stripe-webhook.js) marque converted=true par
// email dès qu'un paiement aboutit — plus aucun email de relance n'est
// alors envoyé (voir notify-cron-leads.js, filtre "converted = false").

const { supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { allow } = require('./_lib/rate-limit');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  // Sans limite, n'importe qui peut noyer la base de prospects de milliers de
  // fausses adresses — et déclencher autant de séquences d'emails, ce qui
  // abîme la réputation d'envoi du domaine. Une personne réelle ne soumet ce
  // formulaire qu'une ou deux fois.
  if (!(await allow(event, 'lead', 10, 60))) {
    // Réponse volontairement identique au succès : un script ne doit pas
    // apprendre qu'il a été filtré, sinon il ajuste sa cadence.
    return jsonResponse(200, { ok: true });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'INVALID_JSON' });
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase().slice(0, 200) : '';
  const firstName = typeof payload.first_name === 'string' ? payload.first_name.trim().slice(0, 60) : null;
  const phone = typeof payload.phone === 'string' ? payload.phone.trim().slice(0, 30) : null;
  const source = typeof payload.source === 'string' ? payload.source.trim().slice(0, 60) : 'unknown';

  if (!email || !EMAIL_RE.test(email)) {
    // Réponse neutre : ne pas donner d'indice exploitable à un script.
    return jsonResponse(200, { ok: true });
  }

  try {
    const r = await supabaseAdminRequest('/rest/v1/marketing_leads?on_conflict=email', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ email, first_name: firstName, phone, source }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[capture-lead] Erreur écriture', r.status, detail);
    }
  } catch (e) {
    console.error('[capture-lead] NETWORK_ERROR', e);
  }

  return jsonResponse(200, { ok: true });
};
