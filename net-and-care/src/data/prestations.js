/* ===========================================================================
   Cartes « Prestations » de la page d'accueil.
   Chaque carte a une fonction commerciale : nommer un besoin, donner un ordre
   de prix (lever l'objection « ça doit être cher »), et renvoyer vers la page
   locale correspondante (maillage interne pour le référencement).
   Les prix affichés doivent rester cohérents avec site.config.json → tarifs.
   =========================================================================== */

const ico = (d) =>
  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

module.exports = [
  {
    titre: 'Nettoyage de canapé',
    texte: 'Injection-extraction en profondeur sur tissu, microfibre, velours ou Alcantara. Taches, auréoles et odeurs traitées fibre par fibre.',
    prix: 'À partir de 79 €',
    prixNote: 'Canapé 2 places, déplacement inclus',
    lien: '/nettoyage-canape-cannes',
    lienTexte: 'Nettoyage canapé à Cannes',
    icone: ico('<path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3"/><path d="M2 12a2 2 0 0 1 4 0v3h12v-3a2 2 0 0 1 4 0v6H2z"/><path d="M6 18v2M18 18v2"/>')
  },
  {
    titre: 'Nettoyage de matelas',
    texte: 'Désincrustation, traitement anti-acariens et désodorisation. Indispensable après une location saisonnière ou en cas d\'allergies.',
    prix: 'À partir de 69 €',
    prixNote: 'Matelas 1 place, anti-acariens en option',
    lien: '/nettoyage-matelas-cannes',
    lienTexte: 'Nettoyage matelas à Cannes',
    icone: ico('<rect x="2" y="8" width="20" height="10" rx="3"/><path d="M2 12h20M6 8V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>')
  },
  {
    titre: 'Nettoyage de tapis',
    texte: 'Laine, coton, synthétique ou tapis d\'orient : méthode adaptée à la fibre, sans rétrécissement ni décoloration.',
    prix: 'À partir de 18 €/m²',
    prixNote: 'Minimum 60 € par intervention',
    lien: '/nettoyage-tapis-cannes',
    lienTexte: 'Nettoyage tapis à Cannes',
    icone: ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M3 15h18"/>')
  },
  {
    titre: 'Nettoyage de moquette',
    texte: 'Bureaux, hôtels, locations et parties communes. Séchage rapide pour rendre les lieux utilisables le jour même.',
    prix: 'À partir de 7 €/m²',
    prixNote: 'Devis immédiat au-delà de 100 m²',
    lien: '/nettoyage-moquette-cannes',
    lienTexte: 'Nettoyage moquette à Cannes',
    icone: ico('<path d="M3 20V7l9-4 9 4v13"/><path d="M3 12h18M9 20V9M15 20V9"/>')
  },
  {
    titre: 'Nettoyage fin de chantier',
    texte: 'Remise en état complète après travaux : poussières fines, traces de peinture, vitrerie, sols. Le bien est livrable immédiatement.',
    prix: 'À partir de 6 €/m²',
    prixNote: 'Minimum 250 € · intervention en équipe',
    lien: '/nettoyage-fin-de-chantier-cannes',
    lienTexte: 'Fin de chantier à Cannes',
    icone: ico('<path d="M3 21h18"/><path d="M5 21V8l7-5 7 5v13"/><path d="M10 21v-6h4v6"/>')
  },
  {
    titre: 'Locations & professionnels',
    texte: 'Airbnb, conciergeries, hôtels, cabinets : passages planifiés entre deux locataires, facturation mensuelle, interlocuteur unique.',
    prix: 'Tarif contractuel',
    prixNote: 'Sur volume et fréquence',
    lien: '/devis',
    lienTexte: 'Demander une grille tarifaire',
    icone: ico('<path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01"/>')
  }
];
