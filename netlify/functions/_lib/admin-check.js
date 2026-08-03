// netlify/functions/_lib/admin-check.js
//
// Vérification "cet email est-il dans la table admins ?" — factorisée ici
// car dupliquée par copier-coller dans plusieurs fonctions (notification-
// preferences.js, compliance-export.js, admin-legal-info.js,
// admin-contract-templates.js...). Ne remplace pas les policies RLS
// (is_current_user_admin() côté base reste la vraie autorité pour tout ce
// qui passe par une RPC) — sert uniquement aux endpoints qui décident
// eux-mêmes d'un comportement (quelles données renvoyer, quel bucket
// écrire) avant même d'appeler la base en service_role.

const { supabaseAdminRequest } = require('./supabase-admin');

async function isAdminEmail(email) {
  if (!email) return false;
  const r = await supabaseAdminRequest(`/rest/v1/admins?email=eq.${encodeURIComponent(email)}&select=email`);
  if (!r.ok) return false;
  const rows = await r.json();
  return Array.isArray(rows) && rows.length > 0;
}

module.exports = { isAdminEmail };
