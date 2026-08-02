// netlify/functions/unsubscribe-lead.js
//
// Désinscription en un clic depuis le pied de page des emails de relance
// (voir _lib/notifications/email.js::unsubscribeFooter). Public par
// nécessité (cliqué depuis un client mail, jamais connecté) — protégé par
// un token signé (HMAC) plutôt qu'un id nu, pour qu'on ne puisse pas
// désinscrire le lead de quelqu'un d'autre en devinant un uuid.
//
// GET /.netlify/functions/unsubscribe-lead?token=<leadId>.<signature>

const { supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { verifyUnsubscribeToken } = require('./_lib/notifications/email');

function htmlPage(message) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: `<!doctype html><html lang="fr"><meta charset="utf-8"><title>Génération Capable</title>
<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#222">
<h1>Génération Capable</h1><p>${message}</p></body></html>`,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return jsonResponse(405, { error: 'Method not allowed' });
  const token = (event.queryStringParameters || {}).token;
  const leadId = verifyUnsubscribeToken(token);
  if (!leadId) return htmlPage('Lien invalide ou expiré.');

  await supabaseAdminRequest(`/rest/v1/marketing_leads?id=eq.${encodeURIComponent(leadId)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ stopped: true }),
  });

  return htmlPage('Tu ne recevras plus d\'emails de notre part concernant ton inscription. À bientôt peut-être 👋');
};
