# Reel « YOKOFURI »

Bande-annonce verticale 1080×1920 (30 i/s, 24,5 s) pour Instagram, montée sur une musique originale à 140 bpm : chaque coupe tombe sur un temps. Le montage est rendu image par image dans Chromium (Playwright), encodé en H.264 par ffmpeg, puis mixé avec la musique et normalisé à −14 LUFS.
Les visuels viennent de `../yokofuri/assets/`. Le rush de gravure laser reste hors du dépôt.

- `reel.json` : tempo, temps de début de chaque séquence (`T`, alignés sur les mesures), impacts (flashs, tremblements, flares, taikos), whooshs, montées, scintillements, plage laser et fondu final. L'image et le son lisent tous les deux ce fichier.
- `extract.py` : extrait les étincelles du rush de gravure (20 s → 22,5 s), recadrées et étalonnées en 1080×1920 (`shots/laser/`).
- `comp.html` : compositeur. Il gère les kanji brodés au point satin, les cartes produit en 3D avec zoom macro et reflet satiné, la poussière d'or, les flares anamorphiques et les textes.
- `sfx.py` : musique originale générée avec numpy, une trap japonaise en ré (gamme hirajoshi). Elle contient une 808, un kick, un clap, des charleys en roulements, un koto en mélodie, un shamisen, des nappes compressées par le kick, des taikos et un gong. S'y ajoutent les bruitages : montées, whooshs, scintillements et laser. Le script affiche le niveau de chaque piste pendant le drop.
- `render.js` : rendu des images, de l'audio et du mixage final.

## Rendu

```bash
cd reel-yokofuri
mkdir -p fonts && cd fonts && npm pack @fontsource/cinzel @fontsource/cormorant-garamond @fontsource/shippori-mincho-b1 \
  && for f in *.tgz; do tar xzf "$f" && mv package "${f%.tgz}"; done && rm *.tgz && cd ..
python3 -I extract.py . "<rush gravure pendentif>.mp4"
node render.js stills --stills 2.6,4.2,9,15.9,22.5     # images de contrôle dans stills/
node render.js YOKOFURI-Reel-V2.mp4                    # vidéo complète avec la musique
```

## Structure (140 bpm, 1 mesure = 1,71 s)

| Mesures | Temps | Musique | Image et texte |
|---|---|---|---|
| 1–2 | 0 – 3,4 s | Arpège de koto, roulement de caisse claire | Le fil d'or traverse l'écran : « Avant le motif, il y a le fil. » |
| 3 | 3,4 – 5,1 s | Drop A | Le kanji 横 brodé claque : « 横振り l'aiguille qui danse », puis se déchire |
| 4 | 5,1 – 6,9 s | Drop A | Le tigre en 3D, puis YOKOFURI en or |
| 5 | 6,9 – 8,6 s | Respiration, puis roulement | « Avant le fil, il y a la main. » |
| 6–8 | 8,6 – 13,7 s | Drop B | « Chaque point raconte une histoire. » : Tora, Raijin, Kitsune, Okinawa (2 temps chacune), Ryūko (1 mesure) |
| 9 | 13,7 – 15,4 s | Drop B | « Un seul signe. Cinq fils. » : 5 couleurs en croches, puis le hoodie noir fil d'or |
| 10 | 15,4 – 17,1 s | Drop B | 鬼 « Ce que tu portes parle avant toi. » |
| 11 | 17,1 – 18,9 s | Drop B + laser | « Gravé pour durer. » : étincelles, puis le pendentif 加流呂 |
| 12 | 18,9 – 20,6 s | Montée (kick sur chaque temps) | La Signature, une coupe par temps |
| 13+ | 20,6 – 24,5 s | Impact, gong, 808 tenue | Tigre, YOKOFURI, « Porte la tienne. », @yokofuriofficial |

Les textes importants restent entre 200 px et 1 560 px de hauteur, pour ne pas passer sous l'interface d'Instagram.
