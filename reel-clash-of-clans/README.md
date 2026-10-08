# Reels Clash of Clans → Discord

Gabarit de montage vertical 1080×1920 (30 i/s) dans le style « Top 3 astuces » : accroche mot à mot, silhouettes « ? », cartes #1/#2/#3 sur damier vert, explications avec calcul choc, fin sur l'invitation Discord. Chaque vidéo est un fichier JSON dans `videos/`. Les bruitages et la boucle rythmique sont générés automatiquement à partir des timings.

- `PLAN-CONTENU.md` : analyse de la référence, stratégie Discord, banque d'idées, 10 vidéos et liste des captures à filmer.
- `DEMO-01-gemmes-gratuites.mp4` : vidéo 01 rendue en motion design, sans capture de jeu.
- `comp.html` : compositeur (scènes `hook`, `teaser`, `card`, `explain`, `cta`).
- `render.js` : rendu image par image dans Chromium (Playwright), puis encodage avec ffmpeg.
- `sfx.py` : pops, whooshs, dings et beat à 128 bpm (numpy).

## Rendu

```bash
cd reel-clash-of-clans
mkdir -p fonts && cd fonts && npm pack @fontsource/lilita-one @fontsource/luckiest-guy @fontsource/nunito \
  && for f in *.tgz; do tar xzf "$f" && mv package "${f%.tgz}"; done && rm *.tgz && cd ..
node render.js videos/01-gemmes-gratuites.json stills --stills 1,5,9,30   # images de contrôle
node render.js videos/01-gemmes-gratuites.json sortie.mp4                # vidéo complète
```

## Écrire une nouvelle vidéo

Copier `videos/01-gemmes-gratuites.json` et modifier les textes et durées.
- Balises de texte : `*jaune*`, `!rouge!`, `~violet~`, `|` pour un retour à la ligne, `{gem}` pour une gemme.
- Icônes disponibles : `gem`, `tree`, `mine`, `star`, `box`.
- `discord.name` / `discord.line` : nom et sous-titre du serveur sur la carte d'invitation. `online` et `members` restent à `null` tant qu'on n'a pas les vrais chiffres.
- **Ajouter une capture du jeu** : dans une scène `hook` ou `explain`, mettre `"clip": "clips/potion.mp4"` (chemin relatif à ce dossier). On peut ajouter en option `"clipIn"` (seconde de départ), `"zoom"`, `"panX"` et `"panY"`. La capture remplace le panneau illustré et s'affiche avec un fond flouté et un zoom lent, comme dans la référence. Les sous-titres restent par-dessus.

Le son de la vidéo finale contient seulement les bruitages et le beat. La voix off (texte dans `voiceover`) et une musique tendance s'ajoutent ensuite dans CapCut.
