# Motion Portfolio — 3 pièces de 15 s

Trois vidéos de motion design (1920×1080, 60 i/s, son stéréo synchronisé), générées
entièrement par code : aucune banque d'images, aucun sample audio.

| # | Fichier | Style | Ce que ça montre |
|---|---------|-------|------------------|
| 01 | `renders/01-kinetic.mp4` | Typographie cinétique, « Motion is Emotion » | Rythme, police variable (chasse et graisse animées), transitions raccord, vrai motion blur |
| 02 | `renders/02-liquid.mp4` | Film produit 3D, parfum fictif « VIF—ARGENT » | Chrome liquide en raymarching GLSL, éclairage studio, bloom, flare anamorphique, grain |
| 03 | `renders/03-shapes.mp4` | Animation de marque 2D, marque fictive « forma » | Les 12 principes de l'animation : squash & stretch, anticipation, arcs, overlap, timing… |

Les marques « VIF—ARGENT » et « forma » sont fictives (projets concept).

## Mettre ton nom

Ouvre `config.js` et remplis `name` (et `handle` si tu veux) :

```js
window.PORTFOLIO = { name: 'Prénom Nom', role: 'Motion Designer', handle: '@toninsta', year: '2026' };
```

Le nom s'affiche sur la carte de fin des trois vidéos. Inutile de tout recalculer :
seules les 2,5 dernières secondes changent.

```bash
node engine/render.mjs 01-kinetic --from 12.5   # puis 02-liquid --sub 2 --workers 2, puis 03-shapes
```

Le rendu partiel réutilise les images déjà présentes dans `build/<scène>/frames`, puis réencode la vidéo.

## Prévisualiser dans le navigateur

```bash
npm install          # une seule fois (GSAP, polices, playwright-core)
node engine/server.mjs
```

Puis ouvre http://127.0.0.1:5173/scenes/01-kinetic/ (ou `02-liquid`, `03-shapes`).
Espace : lecture/pause · ← → : image par image · clic sur la barre : aller à un instant.

## Recalculer une vidéo

```bash
node engine/render.mjs 01-kinetic                        # ~6 min  (DOM + SVG, motion blur 8 sous-images)
node engine/render.mjs 02-liquid --sub 2 --workers 2     # ~45 min (WebGL logiciel, anticrénelage 2×)
node engine/render.mjs 03-shapes                         # ~6 min
node engine/render.mjs 01-kinetic --stills 1,4.5,9       # images fixes de contrôle → build/01-kinetic/stills
node engine/render.mjs 01-kinetic --audio-only           # régénère seulement le son
```

Prérequis : Node 18+, Python 3 avec `numpy` et `scipy`, FFmpeg, Chromium
(`npx playwright-core install chromium`).

## Comment c'est fait

- `scenes/<nom>/scene.js` : une timeline GSAP **en pause**, positionnée image par image
  (`MP.seek(t)`), donc le rendu est parfaitement déterministe. Tout est calé sur une grille
  musicale (128 ou 96 BPM) : chaque coupe tombe sur un temps.
- `engine/render.mjs` : Chromium sans écran capture chaque sous-image. FFmpeg fait la moyenne
  de N sous-images réparties sur un obturateur à 180° (vrai flou de mouvement), puis encode
  en H.264 (BT.709).
- `scenes/02-liquid/gl.js` : rendu 3D maison en WebGL2. Champs de distance (gouttes, tore,
  flacon), studio d'éclairage procédural, sol réfléchissant, bloom, traînée anamorphique,
  tonemapping ACES.
- `audio/synth.py` + `audio/score.py` : synthétiseur numpy (kick, clap, basses, nappes,
  cloches FM, marimba, risers, impacts…). Les bruitages sont placés sur les repères
  (`MP.cue`) exportés par l'animation, puis le mix est masterisé à -14 LUFS.

## Changer les textes ou les couleurs

- Textes : directement dans `scenes/<nom>/scene.js` (ex. `'MOTION'`, `'VIF—ARGENT'`, `'forma'`).
- Couleurs : variables CSS en haut de `scenes/<nom>/style.css` (et constante `C` dans `scene.js`).
