// netlify/functions/compliance-contract-preview.js
//
// Renvoie le texte du contrat déjà rempli avec les informations actuelles
// du dossier (avant signature) — utilisé par l'écran de signature pour
// afficher exactement ce qui sera signé. Le rendu final au moment de la
// signature (compliance-sign-contract.js) refait le même calcul à partir
// des données réellement en base à cet instant précis : cet aperçu n'est
// qu'un affichage, jamais la source de vérité.
//
// GET /.netlify/functions/compliance-contract-preview?role=vendeur|ambassadeur
//   Authorization: Bearer <session_token>
//   → { text, version, missingFields }

const { verifySessionToken, supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { renderContract } = require('./_lib/compliance/contracts');

const ROLES = new Set(['vendeur', 'ambassadeur']);
const REQUIRED_PROFILE_FIELDS = ['first_name', 'last_name', 'birth_date', 'birth_place', 'address', 'nationality', 'legal_status'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return jsonResponse(405, { error: 'Method not allowed' });

  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!anonKey || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(500, { error: 'SERVER_NOT_CONFIGURED' });
  }

  const { id: userId, email, error: authError } = await verifySessionToken(event, anonKey);
  if (authError) return jsonResponse(401, { error: authError });

  const role = (event.queryStringParameters || {}).role;
  if (!ROLES.has(role)) return jsonResponse(400, { error: 'INVALID_ROLE' });

  const profileResp = await supabaseAdminRequest(`/rest/v1/compliance_profiles?user_id=eq.${userId}&role=eq.${role}&select=*`);
  const profileRows = profileResp.ok ? await profileResp.json() : [];
  const profile = (profileRows && profileRows[0]) || {};
  const missingFields = REQUIRED_PROFILE_FIELDS.filter(f => !profile[f] || String(profile[f]).trim().length === 0);

  const { text, version } = await renderContract(role, profile, email, new Date());

  return jsonResponse(200, { text, version, missingFields });
};
