# Reel « YOKOFURI »

Bande-annonce verticale 1080×1920 (30 i/s, 37 s) pour Instagram. Le montage est rendu image par image dans Chromium (Playwright), encodé en H.264 par ffmpeg, puis mixé avec une bande-son synthétisée et normalisée à −14 LUFS.
Les visuels viennent de `../yokofuri/assets/`. Le rush de gravure laser reste hors du dépôt.

- `reel.json` : durée, impacts (taikos, flashs, tremblements, flares), whooshs, montées, scintillements, phrases de koto, plage laser, rythme à 120 bpm et fondu final. L'image et le son lisent tous les deux ce fichier.
- `extract.py` : extrait les étincelles du rush de gravure (20 s → 22,5 s), recadrées et étalonnées en 1080×1920 (`shots/laser/`).
- `comp.html` : compositeur. Il gère les kanji brodés au point satin, les cartes produit en 3D avec zoom macro et reflet satiné, la poussière d'or, les flares anamorphiques et les textes.
- `sfx.py` : bande-son générée avec numpy. Elle contient des ō-daiko et shime-daiko, un gong, un koto en gamme hirajoshi, une nappe grave, des montées, des whooshs et le crépitement du laser.
- `render.js` : rendu des images, de l'audio et du mixage final.

## Rendu

```bash
cd reel-yokofuri
mkdir -p fonts && cd fonts && npm pack @fontsource/cinzel @fontsource/cormorant-garamond @fontsource/shippori-mincho-b1 \
  && for f in *.tgz; do tar xzf "$f" && mv package "${f%.tgz}"; done && rm *.tgz && cd ..
python3 -I extract.py . "<rush gravure pendentif>.mp4"
node render.js stills --stills 3.45,8.2,12.1,24,32.4   # images de contrôle dans stills/
node render.js YOKOFURI-Reel.mp4                       # vidéo complète avec le son
```

## Structure

| Temps | Séquence |
|---|---|
| 0 – 3,2 s | Un fil d'or traverse l'écran, avec « 横振り刺繍 » |
| 3,2 – 6 s | Le kanji 横 brodé claque, reçoit un reflet, puis se déchire le long du fil |
| 6 – 9,6 s | Le tigre apparaît en 3D, puis le logotype YOKOFURI en or |
| 9,6 – 11,6 s | « Chaque fil a une histoire. » |
| 11,6 – 19,1 s | Sukajan : Tora, Raijin, Kitsune, Okinawa, Ryūko (zoom macro sur la broderie, puis recul) |
| 19,1 – 23,1 s | « Un kanji · cinq fils » : 朱 金 瑠 白 墨, puis le hoodie noir fil d'or |
| 23,1 – 25,6 s | 鬼 Le Samouraï Oni |
| 25,6 – 29,6 s | Gravure laser, puis le pendentif 加流呂 (ka · ru · ro) |
| 29,6 – 31,6 s | La Signature en coupes sèches |
| 31,6 – 37 s | Fin : tigre, YOKOFURI, Japan Inspired, @yokofuriofficial, lien en bio |

Les textes importants restent entre 230 px et 1 600 px de hauteur, pour ne pas passer sous l'interface d'Instagram.
