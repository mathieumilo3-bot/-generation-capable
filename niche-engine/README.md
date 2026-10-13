# Moteur multi-niches

Pipeline : **niche + idée → script → liste de plans → recherche des images (sources autorisées) → registre de licences → montage dynamique → MP4 vertical 1080×1920 avec bruitages.**

```bash
node engine.js list                                   # les 30 niches
node engine.js new voyage mon-reel                    # crée plans/mon-reel.json (à remplir)
node engine.js check  plans/mon-reel.json             # cherche les images + vérifie les droits
node engine.js render plans/mon-reel.json sortie.mp4  # montage (test)
node engine.js render plans/mon-reel.json sortie.mp4 --final   # refuse toute image de test
```

## Les 30 niches (`niches/*.json`)
Chaque niche définit : public visé, ton, couleur d'accent, requêtes de recherche d'images, **sources autorisées dans l'ordre**, et l'angle d'appel vers le Discord. Clash of Clans est la niche prioritaire.

## Sources d'images
| Source | Usage | Droits |
|---|---|---|
| `local` (`clips/<niche>/`, `clips/_shared/`, `clips/official/`) | enregistrements d'écran du client, cinématiques officielles | `_license.json` obligatoire dans le dossier (owner, license, proof) |
| `pexels` | banque libre, usage commercial | licence Pexels, clé `PEXELS_API_KEY` |
| `pixabay` | idem | licence Pixabay, clé `PIXABAY_API_KEY` |
| `wikimedia` | CC0 / CC-BY / CC-BY-SA / domaine public uniquement | attribution notée dans le registre |

Le moteur **refuse** de rendre si un plan n'a pas de droits renseignés (owner + license + proof) ou si une image est marquée `placeholder` en mode `--final`. Chaque rendu écrit `plans/<nom>.ledger.json` : fichier, empreinte SHA-256, source, URL, auteur, licence.

## Statut honnête
- **Fonctionne et testé** : les 30 niches, le moteur de recherche locale, le registre, le refus sans droits, le montage multi-plans (zoom, ralenti, sous-titres, badge, texte géant, cartes numérotées, CTA Discord) avec des clips de test.
- **Écrit mais non testé en conditions réelles** : les connecteurs Pexels, Pixabay et Wikimedia (le sandbox de développement bloque ces sites). Il faut ajouter `PEXELS_API_KEY` / `PIXABAY_API_KEY` dans l'environnement où tourne le moteur.
- **À faire** : la génération automatique du script et de la liste de plans à partir d'une idée (aujourd'hui je les écris à la main dans un plan JSON ; il faudra brancher un appel à l'API Claude).
- **Clash of Clans** : les images actuelles de `clips/clash-of-clans/` sont des clips de TEST. Les vrais replays viennent des enregistrements d'écran du client.
