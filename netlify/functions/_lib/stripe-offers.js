// netlify/functions/_lib/stripe-offers.js
//
// Configuration centralisée de l'offre Stripe. Génération Capable ne vend
// qu'un seul abonnement (67 €/mois) — un seul produit, un seul Price ID.
//
// Le client n'envoie qu'une clé symbolique ('gc_67'), jamais un Price ID ou
// un montant : le mapping vers le vrai Price ID Stripe se fait exclusivement
// ici, côté serveur, pour qu'une requête modifiée ne puisse jamais obtenir un
// produit/prix différent de celui prévu.
//
// STRIPE_PRICE_ID est un Price ID Stripe (ex: "price_1AbCDeFgHiJ...") à
// créer dans le Dashboard Stripe → Produits, puis à coller dans les
// variables d'environnement Netlify. Rien de secret ici : un Price ID n'a
// pas besoin d'être caché, mais il doit rester configurable sans toucher au
// code (changement de prix, migration vers un autre produit, etc.).

// BUG CORRIGÉ (2026-08-03, panne le jour du lancement) : ce code lisait
// STRIPE_PRICE_GC_67, une variable qui n'a jamais existé sur Netlify — la
// variable réellement configurée (avec un vrai Price ID en production
// depuis le 29/07) s'appelle STRIPE_PRICE_ID. getOffer() renvoyait donc
// systématiquement null → "Offre inconnue ou pas encore configurée côté
// serveur." pour TOUT paiement, en prod comme en preview. On accepte les
// deux noms (STRIPE_PRICE_ID en priorité, ancien nom en repli) pour ne pas
// dépendre d'un renommage manuel sur Netlify et éviter une régression
// silencieuse si quelqu'un recrée un jour STRIPE_PRICE_GC_67 par erreur.
const OFFERS = {
  gc_67: {
    label: 'Génération Capable — 67€/mois',
    mode: 'subscription',
    priceEnvVars: ['STRIPE_PRICE_ID', 'STRIPE_PRICE_GC_67'],
  },
};

function getOffer(offerKey) {
  const offer = OFFERS[offerKey];
  if (!offer) return null;

  const priceId = offer.priceEnvVars.map(name => process.env[name]).find(Boolean);
  if (!priceId) return null;

  return { key: offerKey, label: offer.label, mode: offer.mode, priceId };
}

module.exports = { OFFERS, getOffer };
