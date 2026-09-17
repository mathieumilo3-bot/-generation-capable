# Prospect — Sabine Monnoyeur (naturopathe, Paris 3 & Lyon)

Dossier de qualification complet : l'audit à envoyer, la maquette du site refait,
et le kit de vente.

## Ce qu'il y a dedans

| Fichier | Rôle |
|---|---|
| `dossier.html` | **Le document à envoyer.** Audit de conversion + 5 fuites + démo + CTA appel. |
| `index.html` | Maquette — page d'accueil |
| `paris.html` / `lyon.html` | Maquette — les deux pages locales |
| `accompagnements.html` | Maquette — entrée par situation + tous les tarifs |
| `a-propos.html` / `avis.html` | Maquette — parcours et mur de preuves |
| `COPY-VENTE.md` | Email, WhatsApp, relances, script d'appel 20 min, objections |
| `assets/` | `sabine.css` (maquette), `dossier.css` (audit), `sabine.js` |

## Avant d'envoyer — trois choses à faire

1. **Brancher les boutons de réservation.** Les CTA pointent vers des ancres
   internes (`#rdv`, `#reserver`). Mettre le vrai lien d'agenda, ou les laisser
   tels quels si on assume que c'est une maquette (c'est annoncé par le bandeau
   noir en haut de chaque page).
2. **Brancher le bouton d'appel du dossier** : `<a class="b b--or" href="#" data-rdv>`
   dans `dossier.html`, section `#appel` → lien Calendly / agenda.
3. **Relire les chiffres.** Tarifs, horaires, nombre d'avis viennent de sources
   publiques (site, fiches d'annuaires, profil Instagram transmis) et peuvent
   avoir bougé. Ce sont les seuls points où une erreur coûterait cher en appel.

## Données de référence utilisées

- Cabinets : 18 rue Notre-Dame de Nazareth, 75003 Paris · 29 rue des Remparts
  d'Ainay, 69002 Lyon · 06 70 21 40 44
- Certifications : ISUPNAT (enseignement Alain Rousseaux), FÉNA, OMNES, École
  Française de Réflexologues, psychopraticienne EMDR, thérapie brève Palo Alto
- Spécialisations : micronutrition (D<sup>r</sup> Yves Bernard, Pr Denis Riche),
  stress / burn-out / sommeil (D<sup>r</sup> Franck Gigon)
- Tarifs affichés : bilan 80–100 €, suivi 65–75 €, forfait périnatalité 220 €
- Avis : 4,85/5 sur 350+ avis vérifiés (fiche publique)
- Instagram : 1 672 abonnés · 289 publications · 946 abonnements

## Parti pris

Le dossier ne dit **jamais** que son site est mauvais, et ne promet **aucun
chiffre**. L'angle est : « votre base est bonne, elle circule mal ». C'est ce qui
rend l'audit recevable par quelqu'un qui a construit son site elle-même.

Les pages sont en `noindex` : c'est une démonstration privée, elle ne doit pas
être indexée ni entrer en concurrence avec le vrai site de la prospecte.
