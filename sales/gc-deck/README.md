# GC — deck commercial « Systèmes de revenus digitaux »

Le deck est un artifact Slides (1920×1080, HTML inline). Ce dossier en est la
source : une configuration centrale et un générateur, pour produire en
quelques secondes la version d'une offre ou d'un prospect.

| Fichier | Rôle |
| --- | --- |
| `config.mjs` | **Le seul fichier à modifier** : offre, prospect, diagnostic, preuves par mode, prix, CTA, assets. |
| `slides.mjs` | Les 21 gabarits de slides et le système visuel (grille de plan, papier / pierre / noir, un accent minéral). |
| `build.mjs` | Écrit `project/deck.json` et `project/slides/*.html`. |
| `examples/prospect.example.mjs` | Modèle de configuration prospect. |

## Modes

```bash
node sales/gc-deck/build.mjs --out=/tmp/deck                      # FULL DECK
node sales/gc-deck/build.mjs --offer=conversion --out=/tmp/deck   # CORE + GC Conversion + preuves adaptées + méthode + CTA
node sales/gc-deck/build.mjs --offer=acquisition --out=/tmp/deck
node sales/gc-deck/build.mjs --offer=growth --out=/tmp/deck
node sales/gc-deck/build.mjs --config=ma-config.mjs --out=/tmp/deck   # version prospect
```

`--offer` remplace le `?offer=` d'une page web : le format Slides n'exécute
aucun script, la variante est donc produite au build. Les slides hors mode
sont écrites `hidden` : elles restent dans l'éditeur, mais sont sautées en
présentation et à l'export.

Les deux slides « Pour [entreprise] » et « Système recommandé » n'apparaissent
que si `prospectCompany` est renseigné.

## Publier

Publier le dossier de sortie sur l'artifact du deck (`project/deck.json` puis
les slides). Les images sont des assets déjà téléversés sur l'artifact ; leurs
urls sont dans `config.assets`.

## Règles non négociables

- Aucun chiffre d'affaires, ROI, trafic, avis, client ou témoignage sans
  mesure ou recueil réel.
- Trois statuts, jamais confondus : Réalisation, Étude de cas interne,
  Démonstration GC. Clos & Cadre est une Démonstration GC.
- Kerné Couverture : captures avant/après et statut (`kerneStatus`) à fournir ;
  la slide affiche « Statut à confirmer » tant qu'il ne l'est pas.
- Pas d'or : l'accent est la pierre minérale `#CFC7B8`, partagé avec le site GC.
