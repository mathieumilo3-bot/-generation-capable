/* ===========================================================================
   Avis clients affichés sur le site.
   ---------------------------------------------------------------------------
   ⚠️ CONTENU DE DÉMONSTRATION — À REMPLACER AVANT LA MISE EN LIGNE.

   Les trois avis ci-dessous sont des exemples de mise en page, pas de vrais
   avis : ils décrivent le type de témoignage recherché (prestation précise,
   ville, bénéfice concret). Publier des avis inventés sous le nom de Net &
   Care serait à la fois une pratique commerciale trompeuse (art. L121-2 du
   code de la consommation) et un risque direct pour la fiche Google.

   MARCHE À SUIVRE
   1. Collecter les avis Google réels (voir README, section « Stratégie
      d'avis »), puis recopier ici le texte, le prénom et la ville.
   2. Renseigner preuve.noteGoogle / preuve.nombreAvis dans site.config.json
      et passer afficherNoteDansSchema à true : la note apparaît alors dans
      les données structurées et peut remonter en étoiles dans Google.
   =========================================================================== */

module.exports = [
  {
    nom: 'Exemple — à remplacer',
    initiales: 'AR',
    ville: 'Cannes',
    prestation: 'Canapé 3 places',
    note: 5,
    texte: 'Remplacer par un avis Google réel. Le meilleur format : la prestation, le problème de départ, le résultat. Trois lignes suffisent.'
  },
  {
    nom: 'Exemple — à remplacer',
    initiales: 'AR',
    ville: 'Antibes',
    prestation: 'Matelas 140×190',
    note: 5,
    texte: 'Remplacer par un avis Google réel. Les avis qui convertissent le mieux mentionnent un détail vérifiable : le délai tenu, une tache précise, le passage à domicile.'
  },
  {
    nom: 'Exemple — à remplacer',
    initiales: 'AR',
    ville: 'Grasse',
    prestation: 'Tapis et moquette',
    note: 5,
    texte: 'Remplacer par un avis Google réel. Conserver la ville : c\'est elle qui rend le témoignage crédible pour un prospect de la même commune.'
  }
];
