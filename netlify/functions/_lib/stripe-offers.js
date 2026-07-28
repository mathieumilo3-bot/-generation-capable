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
// STRIPE_PRICE_GC_67 est un Price ID Stripe (ex: "price_1AbCDeFgHiJ...") à
// créer dans le Dashboard Stripe → Produits, puis à coller dans les
// variables d'environnement Netlify. Rien de secret ici : un Price ID n'a
// pas besoin d'être caché, mais il doit rester configurable sans toucher au
// code (changement de prix, migration vers un autre produit, etc.).

const OFFERS = {
  gc_67: {
    label: 'Génération Capable — 67€/mois',
    mode: 'subscription',
    priceEnvVar: 'STRIPE_PRICE_GC_67',
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
