// netlify/functions/notify-cron-compliance-expiry.js
//
// Relance automatique avant l'expiration d'un justificatif (ex: attestation
// URSSAF) — "Des relances automatiques si un document manque ou expire" /
// "une date d'expiration... avec demande de renouvellement". Tourne une
// fois par jour (voir netlify.toml).
//
// Alerte à 30, 14 et 7 jours avant expiration (une seule fois par palier,
// déduplication via notification_log sur l'event_key), jamais en boucle
// quotidienne une fois le palier franchi.

const { supabaseAdminRequest, jsonResponse } = require('./_lib/supabase-admin');
const { sendToUser, safeNotify } = require('./_lib/notifications/send');

const THRESHOLDS_DAYS = [30, 14, 7];
const DOC_TYPE_LABELS = {
  identity: "Pièce d'identité", rib: 'RIB', siret_proof: 'Justificatif SIRET',
  urssaf: 'Attestation URSSAF', vat_cert: 'Certificat de TVA', other: 'Document',
};

exports.handler = async () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  let processed = 0;

  for (const days of THRESHOLDS_DAYS) {
    const target = new Date(today.getTime() + days * 24 * 3600 * 1000);
    const targetDate = target.toISOString().slice(0, 10);

    const r = await supabaseAdminRequest(
      `/rest/v1/compliance_documents?expires_at=eq.${targetDate}&admin_status=eq.validated&select=id,user_id,role,doc_type,expires_at`
    );
    const rows = r.ok ? await r.json() : [];

    for (const doc of rows || []) {
      processed++;
      await safeNotify(() => sendToUser({
        userId: doc.user_id,
        category: 'seller.compliance.document_expiring',
        eventKey: `doc_expiring:${doc.id}:${days}d`,
        ctx: { docLabel: `${DOC_TYPE_LABELS[doc.doc_type] || 'Ton document'} (expire le ${new Date(doc.expires_at).toLocaleDateString('fr-FR')})` },
      }));
    }
  }

  return jsonResponse(200, { processed });
};
