# CIELO OS

**THE OPERATING SYSTEM BEHIND EVERY CIELO EXPERIENCE.**

Prototype cliquable d'une *concept product experience* pour CIELO — une
infrastructure qui transforme chaque événement en actif nourrissant le suivant.

> ⚠️ **Toutes les données affichées sont fictives.** Elles servent uniquement à
> faire fonctionner le prototype. Aucune ne provient de l'activité réelle de
> Cielo, et aucun nom de membre ne correspond à une personne réelle. Cielo
> Access et le Referral Engine sont des fonctionnalités **proposées**, pas des
> fonctionnalités existantes.

---

## Ouvrir le prototype

| Contexte | Adresse |
| --- | --- |
| En ligne | `https://<domaine>/cielo-os/` |
| En local (serveur) | `python3 -m http.server 8000` puis `http://localhost:8000/cielo-os/` |
| En local (sans serveur) | double-clic sur `cielo-os/index.html` |

Aucune installation, aucun build, aucune dépendance réseau : les scripts sont
chargés en `<script>` classiques et les polices sont celles du système. Le
prototype fonctionne donc aussi en `file://` et hors connexion — utile si le
Wi-Fi lâche pendant la visio.

## Parcours conseillé en présentation

1. **Écran d'ouverture** — « CIELO OS ». Cliquer sur `ENTER CONTROL CENTER`.
   (Le bouton `REPLAY INTRO` en bas de la barre latérale le rejoue à tout moment.)
2. **Overview** — les KPI, le revenu par événement, puis le bloc `NEXT EVENT`.
3. **Audience** — le chiffre qui porte la démonstration : 1 284 membres possédés.
4. **Cielo Access** — le passeport membre et la progression de statut.
5. **Referrals** — la boucle d'acquisition, et `COPY LINK` qui copie vraiment.
6. **Partners** — `GENERATE PARTNER REPORT` produit un rapport à l'écran.
7. **The Cielo Loop** — la page manifeste, à laisser respirer.
8. **NEXT EVENT SIMULATION** (barre du haut, depuis n'importe quelle page) —
   la séquence plein écran qui montre CIELO 002 se remplir tout seul.

`Échap` ferme n'importe quelle surcouche. Les liens sont des ancres
(`#/audience`) : on peut ouvrir directement une page précise.

## Ce qui est réellement interactif

- Navigation complète entre les huit vues
- Sélection d'événement et fiche détaillée (`VIEW EVENT`)
- Filtres d'audience (All / VIP / Returning / New / High Value)
- Campagne early access : choix des canaux, aperçu du message, lancement simulé
- Génération du rapport partenaire
- Copie du lien de parrainage (vrai accès au presse-papier)
- Simulation plein écran du lancement de CIELO 002

Aucun message n'est envoyé, aucun fichier n'est généré, aucune API n'est
appelée. Tout se joue en local, dans le navigateur.

## Structure

```
cielo-os/
├── index.html              Point d'entrée
├── styles/
│   ├── tokens.css          Palette, typographie, espacements, courbes d'animation
│   ├── base.css            Reset, ambiance, shell, responsive
│   └── components.css      Cartes, KPI, tableaux, graphiques, surcouches
└── app/
    ├── data.js             Toutes les données de démonstration (source unique)
    ├── ui.js               Composants réutilisables + compteurs animés
    ├── charts.js           Graphiques SVG écrits à la main (aire, donut, colonnes)
    ├── blocks.js           Blocs partagés entre plusieurs vues
    ├── overlays.js         Modales, campagne, rapport, simulation plein écran
    ├── views/              Une vue par module
    └── app.js              Navigation, routeur, délégation d'événements
```

Pour changer un chiffre, il n'y a qu'un seul endroit : `app/data.js`.

## Cohérence des chiffres

Les données fictives sont construites pour tomber juste si quelqu'un vérifie :

- La billetterie détaillée totalise exactement **184 250 €**
  (26 100 + 83 600 + 8 800 + 29 640 + 36 110).
- Les trois axes de segmentation de l'audience totalisent chacun **1 284** membres.
- Le découpage de la waitlist (312 + 684 + 1 851) totalise **2 847**.
- Les 624 conversions de parrainage à 50 € de panier produisent les **31 200 €**
  de revenu de parrainage.

CIELO 001 est la seule valeur « réalisée ». CIELO 002 à 004 sont des
projections, identifiées comme telles dans le graphique et dans la légende.

## Direction artistique

Noir profond (`#050505` → `#111111`), typographie très large en graisse fine,
bordures d'un pixel, cartes légèrement translucides, grain à 3 %, et un seul
accent — `#D6A85F`, un coucher de soleil méditerranéen — réservé aux chiffres
importants, aux états actifs et aux actions principales.
