// netlify/functions/_lib/notifications/templates.js
//
// Banque de messages du système de notifications. Chaque catégorie possède
// plusieurs variantes (choisies aléatoirement par send.js, qui évite de
// répéter la même variante deux fois de suite pour un même utilisateur —
// voir pickVariant() dans send.js) afin qu'aucun utilisateur ne reçoive
// jamais deux fois d'affilée exactement le même texte.
//
// Chaque variante est une fonction (ctx) => { title, body } plutôt qu'une
// simple chaîne à trous : certaines variantes omettent volontairement le
// prénom, changent de ton, ou n'affichent un chiffre que s'il est
// pertinent — un simple remplacement de {placeholder} ne permettrait pas
// cette variation.
//
// ctx courant (rempli au mieux selon la catégorie, jamais garanti complet) :
//   prenom, montant (déjà formaté "1 234 €"), n (nombre), jours, produit,
//   record (déjà formaté), objectif (déjà formaté), latence (ms)

function firstName(prenom) {
  return prenom && String(prenom).trim().length > 0 ? String(prenom).trim() : null;
}

// ── Vendeur — coach commercial quotidien ────────────────────────────────
const sellerCoachMorning = [
  ctx => ({
    title: `Bonjour ${firstName(ctx.prenom) || ''}`.trim(),
    body: `Aujourd'hui est une nouvelle opportunité. Objectif : dépasser ton score d'hier. Chaque porte frappée peut changer ton mois.`
  }),
  ctx => ({
    title: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', ' : ''}c'est reparti 💪`,
    body: `Une nouvelle journée commence. Les meilleurs ne sont pas ceux qui n'ont jamais raté, mais ceux qui reprennent chaque matin.`
  }),
  ctx => ({
    title: `Bonjour ${firstName(ctx.prenom) || 'champion'}`,
    body: `Ta prochaine vente n'attend qu'une chose : que tu commences à prospecter. Vas-y.`
  }),
  ctx => ({
    title: `Nouvelle journée, nouveau départ`,
    body: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', chaque' : 'Chaque'} jour est une chance de progresser. Fixe-toi un cap avant de commencer.`
  }),
  ctx => ({
    title: `${firstName(ctx.prenom) || 'Salut'}, prêt(e) ?`,
    body: `Le meilleur moment pour prospecter, c'est maintenant. Le deuxième meilleur moment, c'est dans 5 minutes.`
  }),
  ctx => ({
    title: `Bonjour`,
    body: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', ta' : 'Ta'} régularité fait ta réussite, pas un coup de chance isolé. On commence ?`
  })
];

// Variantes utilisées quand la segmentation comportementale (segmentation.js)
// classe le vendeur en "top" (performant, actif) — ton plus ambitieux,
// défis plus élevés, comme demandé ("vendeur performant → défis plus élevés").
const sellerCoachMorningTop = [
  ctx => ({ title: `${firstName(ctx.prenom) || 'Champion'}, encore un cran au-dessus ?`, body: `Ta régularité paie. Aujourd'hui, vise plus haut que ta moyenne des 30 derniers jours.` }),
  ctx => ({ title: `Tu es sur une excellente lancée`, body: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', ' : ''}les meilleurs vendeurs ne ralentissent jamais après un bon mois. Nouveau défi aujourd'hui ?` }),
  ctx => ({ title: `Niveau supérieur`, body: `Tes derniers résultats sont excellents. Et si aujourd'hui devenait ton meilleur jour du mois ?` }),
];

// Variantes utilisées pour un vendeur récemment arrivé (profil "new") —
// accompagnement quotidien renforcé, ton plus pédagogique.
const sellerCoachMorningNew = [
  ctx => ({ title: `Bienvenue dans ta routine, ${firstName(ctx.prenom) || 'toi'}`, body: `Les débuts comptent plus que le résultat du premier jour. Une action aujourd'hui, c'est déjà une victoire.` }),
  ctx => ({ title: `Un pas après l'autre`, body: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', ' : ''}personne ne maîtrise la prospection en un jour. Avance à ton rythme, mais avance.` }),
  ctx => ({ title: `Bonjour`, body: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', ' : ''}chaque vendeur qui réussit a commencé exactement où tu es aujourd'hui.` }),
];

const sellerCoachGoalPrompt = [
  ctx => ({ title: `As-tu défini ton objectif aujourd'hui ?`, body: `Un objectif clair transforme une journée de travail en une journée de progrès mesurable.` }),
  ctx => ({ title: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', un' : 'Un'} objectif pour aujourd'hui ?`, body: `Combien de personnes veux-tu contacter aujourd'hui ? Note-le, ça change tout.` }),
  ctx => ({ title: `Cap du jour`, body: `Avant de te lancer : quel est ton objectif pour aujourd'hui ?` })
];

const sellerCoachMidday = [
  ctx => ({ title: `Où en es-tu ?`, body: `Tu as déjà parlé à combien de prospects aujourd'hui ?` }),
  ctx => ({ title: `Point de mi-journée`, body: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', la' : 'La'} matinée est passée — où en es-tu de ton objectif du jour ?` }),
  ctx => ({ title: `Petit check`, body: `Il reste encore la moitié de la journée pour avancer. Un prospect de plus ?` }),
  ctx => ({ title: `Milieu de journée`, body: `Rien de grave si ça n'avance pas encore — mais il est temps de t'y mettre si ce n'est pas fait.` })
];

const sellerCoachEvening = [
  ctx => ({ title: `Pense à enregistrer tes résultats`, body: `Chaque journée analysée te fait progresser.` }),
  ctx => ({ title: `Fin de journée`, body: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', prends' : 'Prends'} deux minutes pour noter ce qui a marché aujourd'hui — et ce qui peut être amélioré demain.` }),
  ctx => ({ title: `Bilan du jour`, body: `Une journée sans bilan est une journée qui n'apprend rien. Note tes résultats.` }),
  ctx => ({ title: `Avant de fermer la journée`, body: `Tes chiffres d'aujourd'hui construisent ta progression de demain. Enregistre-les.` })
];

const sellerCoachNoActivityToday = [
  ctx => ({ title: `Tu n'as encore rien enregistré aujourd'hui`, body: `Va chercher ta première opportunité — il n'est pas trop tard.` }),
  ctx => ({ title: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', aucune' : 'Aucune'} prospection aujourd'hui`, body: `Une seule conversation peut relancer ta journée. Lance-toi.` }),
  ctx => ({ title: `La journée n'est pas finie`, body: `Tu n'as encore parlé à personne aujourd'hui. Le premier pas est toujours le plus dur.` })
];

const sellerCoachInactivity2d = [
  ctx => ({ title: `Tu nous manques`, body: `Chaque jour sans prospection est une opportunité perdue. Reprends aujourd'hui.` }),
  ctx => ({ title: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', on' : 'On'} ne t'a pas vu récemment`, body: `Deux jours sans activité — rien de grave, mais chaque jour compte. On reprend ?` }),
];

const sellerCoachInactivity4d = [
  ctx => ({ title: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', ça' : 'Ça'} fait plusieurs jours`, body: `Ta progression s'est mise en pause. Une seule action aujourd'hui peut relancer ta dynamique.` }),
  ctx => ({ title: `On t'attend`, body: `4 jours sans prospection. Tes objectifs n'ont pas bougé, eux — reviens quand tu veux, mais reviens.` })
];

const sellerCoachInactivity7d = [
  ctx => ({ title: `${firstName(ctx.prenom) || 'Bonjour'}, tout va bien ?`, body: `Une semaine sans activité. Si quelque chose te bloque, c'est le moment de reprendre — même petit pas compte.` }),
  ctx => ({ title: `Une semaine sans nouvelles de toi`, body: `Ta place t'attend. Reprends aujourd'hui, même 10 minutes suffisent pour relancer la machine.` })
];

const sellerMilestoneSale = [
  ctx => ({ title: `Félicitations !`, body: `Une nouvelle vente vient d'être enregistrée. Continue.` }),
  ctx => ({ title: `Bravo ${firstName(ctx.prenom) || ''}`.trim(), body: `Vente confirmée${ctx.montant ? ' (' + ctx.montant + ')' : ''}. Sur ta lancée, une autre t'attend.` }),
  ctx => ({ title: `Nouvelle vente ✅`, body: `Bien joué. Chaque vente est la preuve que ta méthode fonctionne — répète-la.` }),
  ctx => ({ title: `Ça, c'est fait`, body: `Une vente de plus au compteur. La prochaine commence maintenant.` })
];

const sellerMilestoneFirstSale = [
  ctx => ({ title: `Ta toute première vente ! 🎉`, body: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', tu' : 'Tu'} viens de passer un cap décisif. La suite ne fait que commencer.` }),
  ctx => ({ title: `Premier closing réussi`, body: `Le plus dur est fait : tu sais que ça marche. Maintenant, reproduis-le.` })
];

const sellerMilestoneRecord = [
  ctx => ({ title: `Nouveau record personnel !`, body: `Continue sur cette lancée.` }),
  ctx => ({ title: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', record' : 'Record'} battu 🔥`, body: `Ta meilleure performance à ce jour. Vois jusqu'où tu peux aller.` })
];

// ── Admin — Business ─────────────────────────────────────────────────────
const adminNewSeller = [
  ctx => ({ title: `Nouveau vendeur inscrit`, body: `${ctx.email || 'Un nouveau membre'} vient de rejoindre Génération Capable.` }),
];
const adminNewAmbassador = [
  ctx => ({ title: `Nouvel ambassadeur inscrit`, body: `${ctx.email || 'Un nouvel ambassadeur'} vient de rejoindre le programme.` }),
];
const adminFirstSale = [
  ctx => ({ title: `Première vente d'un vendeur 🎉`, body: `${ctx.email || 'Un vendeur'} vient de réaliser sa première vente${ctx.montant ? ' (' + ctx.montant + ')' : ''}.` }),
];
const adminSale = [
  ctx => ({ title: `Vente réalisée`, body: `${ctx.montant ? ctx.montant + ' — ' : ''}${ctx.produit || 'Prestation'}${ctx.email ? ' par ' + ctx.email : ''}.` }),
];
const adminBigSale = [
  ctx => ({ title: `Grosse vente réalisée 💰`, body: `${ctx.montant || 'Montant important'}${ctx.email ? ' — ' + ctx.email : ''}.` }),
];
const adminStripePaymentReceived = [
  ctx => ({ title: `Paiement Stripe reçu`, body: `${ctx.montant ? ctx.montant + ' encaissés' : 'Paiement confirmé'}.` }),
];
const adminPaymentFailed = [
  ctx => ({ title: `Paiement échoué`, body: `Un paiement a échoué${ctx.email ? ' pour ' + ctx.email : ''}. Stripe retentera automatiquement.` }),
];
const adminRefundRequested = [
  ctx => ({ title: `Demande de remboursement`, body: `Un litige Stripe vient d'être ouvert${ctx.montant ? ' (' + ctx.montant + ')' : ''} — action requise.` }),
];
const adminRefundProcessed = [
  ctx => ({ title: `Remboursement effectué`, body: `${ctx.montant ? ctx.montant + ' remboursés' : 'Un remboursement a été traité'}.` }),
];
const adminDailyGoalReached = [
  ctx => ({ title: `Objectif journalier atteint 🎯`, body: `Le CA du jour a dépassé l'objectif fixé (${ctx.objectif}).` }),
];
const adminSalesRecord = [
  ctx => ({ title: `Record de ventes battu 🏆`, body: `${ctx.record || 'Un nouveau record'} vient d'être établi.` }),
];

// ── Admin — Commercial ────────────────────────────────────────────────────
const adminQualifiedProspect = [
  ctx => ({ title: `Nouveau prospect qualifié`, body: `${ctx.email || 'Un vendeur'} a qualifié un nouveau prospect.` }),
];
const adminAppointmentBooked = [
  ctx => ({ title: `Nouveau rendez-vous pris`, body: `Un rendez-vous vient d'être planifié dans le pipeline.` }),
];
const adminPendingSale = [
  ctx => ({ title: `Vente en attente`, body: `Une commande est en attente de paiement depuis un moment.` }),
];
const adminQuoteSent = [
  ctx => ({ title: `Devis envoyé`, body: `Un devis vient d'être envoyé à un prospect.` }),
];
const adminHotProspectStale = [
  ctx => ({ title: `Prospect chaud sans suivi`, body: `Un prospect n'a pas été relancé depuis plus de ${ctx.jours || 'plusieurs'} heures — risque de refroidissement.` }),
];

// ── Admin — Conformité (contrats, documents, RIB) ──────────────────────────
const adminNewSignature = [
  ctx => ({ title: `Contrat signé — à valider`, body: `${ctx.email || 'Un utilisateur'} (${ctx.role || ''}) vient de signer son contrat électroniquement.` }),
];
const adminDocumentUploaded = [
  ctx => ({ title: `Nouveau document déposé`, body: `${ctx.email || 'Un utilisateur'} a déposé un document (${ctx.docType || ''}) à valider.` }),
];
const adminPaymentInfoChanged = [
  ctx => ({ title: `RIB modifié`, body: `${ctx.email || 'Un utilisateur'} a mis à jour ses coordonnées bancaires — validation requise avant tout versement.` }),
];
const adminDossierComplete = [
  ctx => ({ title: `Dossier conforme ✅`, body: `Le dossier de ${ctx.email || 'un utilisateur'} est désormais complet à 100%.` }),
];
const sellerDocumentExpiring = [
  ctx => ({ title: `Un document arrive à expiration`, body: `${ctx.docLabel || 'Un justificatif'} de ton dossier administratif expire bientôt — pense à le renouveler.` }),
];

// ── Admin — Technique ──────────────────────────────────────────────────────
const adminServerError = [
  ctx => ({ title: `Erreur serveur`, body: `${ctx.contexte || 'Une fonction a échoué'}${ctx.message ? ' : ' + ctx.message : ''}` }),
];
const adminSiteDown = [
  ctx => ({ title: `Site indisponible`, body: `Le site ne répond plus (ou renvoie une erreur) depuis la dernière vérification.` }),
];
const adminSiteRecovered = [
  ctx => ({ title: `Site rétabli`, body: `Le site répond de nouveau normalement.` }),
];
const adminSlowResponse = [
  ctx => ({ title: `Temps de réponse anormal`, body: `Le site répond en ${ctx.latence || '?'} ms, nettement plus lent que d'habitude.` }),
];

// ── Prospects (email, funnel d'inscription abandonné) ─────────────────────
const leadStep1 = [
  ctx => ({
    subject: `${firstName(ctx.prenom) ? firstName(ctx.prenom) + ', tu' : 'Tu'} es à une décision de changer de trajectoire`,
    html: `<p>${firstName(ctx.prenom) ? firstName(ctx.prenom) + ',' : 'Bonjour,'}</p><p>Tu es à une décision de changer de trajectoire.</p><p>Ton inscription t'attend.</p>`
  }),
];
const leadStep2 = [
  ctx => ({
    subject: `Nous avons gardé ta place`,
    html: `<p>${firstName(ctx.prenom) ? firstName(ctx.prenom) + ',' : 'Bonjour,'}</p><p>Nous avons gardé ta place.</p><p>Rejoins Génération Capable.</p>`
  }),
];
const leadStep3 = [
  ctx => ({
    subject: `Des centaines de personnes avancent déjà`,
    html: `<p>${firstName(ctx.prenom) ? firstName(ctx.prenom) + ',' : 'Bonjour,'}</p><p>Des centaines de personnes avancent déjà.</p><p>Ne reste pas sur le quai.</p>`
  }),
];
const leadStep4 = [
  ctx => ({
    subject: `Dernier rappel`,
    html: `<p>${firstName(ctx.prenom) ? firstName(ctx.prenom) + ',' : 'Bonjour,'}</p><p>Dernier rappel.</p><p>Si tu veux réellement évoluer, c'est maintenant.</p>`
  }),
];

// Sélection de la banque de variantes adaptée au profil comportemental
// (voir segmentation.js) — c'est le point d'entrée de l'adaptation "IA" :
// send.js appelle TEMPLATES[category](ctx) quand la valeur est une
// fonction, ou l'utilise telle quelle si c'est un tableau.
function morningPoolForProfile(ctx) {
  if (ctx.profile === 'top') return sellerCoachMorningTop;
  if (ctx.profile === 'new') return sellerCoachMorningNew;
  return sellerCoachMorning;
}

const TEMPLATES = {
  'seller.coach.morning': morningPoolForProfile,
  'seller.coach.goal_prompt': sellerCoachGoalPrompt,
  'seller.coach.midday_checkin': sellerCoachMidday,
  'seller.coach.evening_recap': sellerCoachEvening,
  'seller.coach.no_activity_today': sellerCoachNoActivityToday,
  'seller.coach.inactivity_2d': sellerCoachInactivity2d,
  'seller.coach.inactivity_4d': sellerCoachInactivity4d,
  'seller.coach.inactivity_7d': sellerCoachInactivity7d,
  'seller.milestone.sale': sellerMilestoneSale,
  'seller.milestone.first_sale': sellerMilestoneFirstSale,
  'seller.milestone.record': sellerMilestoneRecord,

  'admin.business.new_seller': adminNewSeller,
  'admin.business.new_ambassador': adminNewAmbassador,
  'admin.business.first_sale': adminFirstSale,
  'admin.business.sale': adminSale,
  'admin.business.big_sale': adminBigSale,
  'admin.business.stripe_payment_received': adminStripePaymentReceived,
  'admin.business.payment_failed': adminPaymentFailed,
  'admin.business.refund_requested': adminRefundRequested,
  'admin.business.refund_processed': adminRefundProcessed,
  'admin.business.daily_goal_reached': adminDailyGoalReached,
  'admin.business.sales_record': adminSalesRecord,

  'admin.commercial.qualified_prospect': adminQualifiedProspect,
  'admin.commercial.appointment_booked': adminAppointmentBooked,
  'admin.commercial.pending_sale': adminPendingSale,
  'admin.commercial.quote_sent': adminQuoteSent,
  'admin.commercial.hot_prospect_stale': adminHotProspectStale,

  'admin.technical.server_error': adminServerError,
  'admin.technical.site_down': adminSiteDown,
  'admin.technical.site_recovered': adminSiteRecovered,
  'admin.technical.slow_response': adminSlowResponse,

  'admin.compliance.new_signature': adminNewSignature,
  'admin.compliance.document_uploaded': adminDocumentUploaded,
  'admin.compliance.payment_info_changed': adminPaymentInfoChanged,
  'admin.compliance.dossier_complete': adminDossierComplete,
  'seller.compliance.document_expiring': sellerDocumentExpiring,
};

const LEAD_EMAIL_TEMPLATES = {
  1: leadStep1,
  2: leadStep2,
  3: leadStep3,
  4: leadStep4,
};

// Libellés lisibles utilisés par notification-preferences.js pour construire
// la liste des catégories proposées à l'utilisateur (settings UI).
const CATEGORY_LABELS = {
  'seller.coach.morning': 'Message du matin',
  'seller.coach.goal_prompt': 'Objectif du jour',
  'seller.coach.midday_checkin': 'Point de mi-journée',
  'seller.coach.evening_recap': 'Bilan du soir',
  'seller.coach.no_activity_today': 'Relance si aucune activité',
  'seller.coach.inactivity_2d': 'Relance après quelques jours d\'absence',
  'seller.coach.inactivity_4d': 'Relance après plusieurs jours d\'absence',
  'seller.coach.inactivity_7d': 'Relance après une semaine d\'absence',
  'seller.milestone.sale': 'Vente confirmée',
  'seller.milestone.first_sale': 'Première vente',
  'seller.milestone.record': 'Record personnel',

  'admin.business.new_seller': 'Nouveau vendeur inscrit',
  'admin.business.new_ambassador': 'Nouvel ambassadeur inscrit',
  'admin.business.first_sale': 'Première vente d\'un vendeur',
  'admin.business.sale': 'Vente réalisée',
  'admin.business.big_sale': 'Grosse vente réalisée',
  'admin.business.stripe_payment_received': 'Paiement Stripe reçu',
  'admin.business.payment_failed': 'Paiement échoué',
  'admin.business.refund_requested': 'Demande de remboursement',
  'admin.business.refund_processed': 'Remboursement effectué',
  'admin.business.daily_goal_reached': 'Objectif journalier atteint',
  'admin.business.sales_record': 'Record de ventes',

  'admin.commercial.qualified_prospect': 'Nouveau prospect qualifié',
  'admin.commercial.appointment_booked': 'Nouveau rendez-vous pris',
  'admin.commercial.pending_sale': 'Vente en attente',
  'admin.commercial.quote_sent': 'Devis envoyé',
  'admin.commercial.hot_prospect_stale': 'Prospect chaud sans suivi',

  'admin.technical.server_error': 'Erreur serveur',
  'admin.technical.site_down': 'Site indisponible',
  'admin.technical.site_recovered': 'Site rétabli',
  'admin.technical.slow_response': 'Temps de réponse anormal',

  'admin.compliance.new_signature': 'Contrat signé (à valider)',
  'admin.compliance.document_uploaded': 'Nouveau document déposé',
  'admin.compliance.payment_info_changed': 'RIB modifié',
  'admin.compliance.dossier_complete': 'Dossier devenu conforme',
  'seller.compliance.document_expiring': 'Document arrivant à expiration',
};

const SELLER_CATEGORIES = Object.keys(CATEGORY_LABELS).filter(k => k.startsWith('seller.'));
const ADMIN_CATEGORIES = Object.keys(CATEGORY_LABELS).filter(k => k.startsWith('admin.'));

// Catégories jamais désactivables même en fréquence "minimal" (jalons
// personnels/business critiques — voir send.js::isCategoryAllowedByFrequency).
const CRITICAL_CATEGORIES = new Set([
  'seller.milestone.sale',
  'seller.milestone.first_sale',
  'seller.milestone.record',
  'admin.business.payment_failed',
  'admin.business.refund_requested',
  'admin.technical.site_down',
  'admin.technical.server_error',
  'admin.compliance.new_signature',
  'admin.compliance.payment_info_changed',
]);

module.exports = {
  TEMPLATES,
  LEAD_EMAIL_TEMPLATES,
  CATEGORY_LABELS,
  SELLER_CATEGORIES,
  ADMIN_CATEGORIES,
  CRITICAL_CATEGORIES,
};
