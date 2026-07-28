// netlify/functions/_lib/stripe-offers.js
//
// Configuration centralisée des offres Stripe — un Price ID Stripe dédié par
// offre, jamais d'URL Stripe codée en dur ni de Price ID accepté tel quel
// depuis le client (le client n'envoie qu'une clé symbolique ci-dessous,
// jamais un price_id Stripe directement : ça évite qu'une requête trafiquée
// ne fasse payer/débloquer un autre produit que celui prévu).
//
// Chaque STRIPE_PRICE_* est un Price ID Stripe (ex: "price_1AbCDeFgHiJ...") à
// créer dans le Dashboard Stripe → Produits, puis à coller dans les
// variables d'environnement Netlify. Rien de secret ici : un Price ID n'a
// pas besoin d'être caché, mais il doit rester configurable sans toucher au
// code (changement de prix, nouvelle offre, etc.).

const OFFERS = {
  eco_monthly: {
    label: 'Écosystème — mensuel',
    mode: 'subscription',
    priceEnvVar: 'STRIPE_PRICE_ECO_MONTHLY',
  },
  eco_semester: {
    label: 'Écosystème — semestriel',
    mode: 'subscription',
    priceEnvVar: 'STRIPE_PRICE_ECO_SEMESTER',
  },
  academie_97: {
    label: 'Académie — 97€ (early bird)',
    mode: 'payment',
    priceEnvVar: 'STRIPE_PRICE_ACADEMIE_97',
  },
  academie_247: {
    label: 'Académie — 247€ (tarif plein)',
    mode: 'payment',
    priceEnvVar: 'STRIPE_PRICE_ACADEMIE_247',
  },
};

function getOffer(offerKey) {
  const offer = OFFERS[offerKey];
  if (!offer) return null;
  const priceId = process.env[offer.priceEnvVar];
  if (!priceId) return null;
  return { key: offerKey, ...offer, priceId };
}

module.exports = { OFFERS, getOffer };
