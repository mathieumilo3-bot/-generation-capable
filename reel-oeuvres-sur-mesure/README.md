# Reel « Œuvres sur-mesure »

Montage vertical 1080×1920 pour Instagram, rendu image par image dans Chromium (Playwright) puis encodé en H.264 par ffmpeg.
Aucune vidéo n'est versionnée ici : les rushs restent hors du dépôt.

- `edl.json` : liste des plans (source, point d'entrée, durée, ralenti, zoom), transitions (nuage, flash), voile, vignette, tremblement et textes.
- `extract.py` : découpe chaque plan des rushs en images 1080×1920 étalonnées (`shots/<id>/`).
- `comp.html` : compositeur (canevas + textes animés) ; `render.js` l'exécute et envoie les images à ffmpeg.

## Rendu

```bash
# polices (registre npm)
mkdir -p fonts && cd fonts && npm pack @fontsource-variable/bodoni-moda @fontsource/jost \
  && for f in *.tgz; do tar xzf "$f" && mv package "${f%.tgz}"; done && cd ..
# rushs attendus dans /tmp/claude-0/dl/<numéro>.mp4 (numéros utilisés par edl.json)
python3 -I extract.py . /tmp/claude-0/dl
node render.js . stills --stills 0.5,3.5,7.05   # images de contrôle dans stills/
node render.js . Reel.mp4                        # vidéo complète
```

`render.js` lance le Chromium de `/opt/pw-browsers/chromium` (environnement cloud Claude Code) ; adapter `executablePath` ailleurs.

Structure actuelle (16,8 s) : accroche 0–3 s sur le geste à la bombe, tension 3–7 s en coupes accélérées,
révélation de la fresque à 7 s (flash, ralenti), fin en nuage sur l'atelier puis le porte-clés « love ».
