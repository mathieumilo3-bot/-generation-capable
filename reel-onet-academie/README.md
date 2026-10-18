# Vidéo de présentation « O NET ACADÉMIE »

Vidéo de 32,5 s qui présente l'académie et la formation « Les bases essentielles de la plomberie et du dépannage » (Tahere Iliès), le samedi 21 novembre 2026. Elle existe en deux formats, rendus à partir du même montage :

- `ONET-Academie-16x9.mp4` : 1920×1080, pour la projection en salle ou YouTube ;
- `ONET-Academie-9x16.mp4` : 1080×1920, pour Instagram, TikTok, WhatsApp et les stories.

Le montage est rendu image par image dans Chromium (Playwright), encodé en H.264 par ffmpeg, puis mixé avec une musique originale à 120 bpm et normalisé à −14 LUFS. Toutes les coupes tombent sur un temps.

- `assets/` : photos de l'atelier, slides du support de cours, logo détouré depuis la couverture, et les deux rushs (coupe du cuivre, filasse). Le bon de commande client n'est pas utilisé, car il contient des données personnelles.
- `reel.json` : tempo, temps de début de chaque scène (`T`), impacts, coups de tuyau, gouttes, whooshs, montées et fondu final. L'image et le son lisent tous les deux ce fichier.
- `extract.py` : extrait les deux rushs en images à 30 i/s, redressées (`shots/`).
- `comp.html` : compositeur canvas. Il gère les deux mises en page : plein cadre en 9:16, carte verticale sur fond flouté en 16:9.
- `sfx.py` : musique originale générée avec numpy (house/pop en la mineur, Am–F–C–G), avec un kick, un clap, des charleys, une basse en contretemps, un piano, un pluck et des nappes. S'y ajoutent les bruitages : coups métalliques de tuyau sur les gestes, gouttes d'eau sur le logo, impacts, whooshs et montées.
- `render.js` : rendu des images, de l'audio et du mixage final.

## Rendu

```bash
cd reel-onet-academie
mkdir -p fonts && cd fonts && npm pack @fontsource/anton @fontsource/open-sans \
  && for f in *.tgz; do tar xzf "$f" && mv package "${f%.tgz}"; done && rm *.tgz && cd ..
python3 -I extract.py .
node render.js stills 16x9 --stills 0.5,6.4,10.8,19.5,27.5,31   # images de contrôle dans stills/
node render.js ONET-Academie-16x9.mp4 16x9
node render.js ONET-Academie-9x16.mp4 9x16
```

## Structure (120 bpm, 1 mesure = 2 s)

| Temps | Musique | Image et texte |
|---|---|---|
| 0 – 4 s | Tic-tac de charleys, arpège, coups sourds | Rushs et photos : « Une fuite ? », « Plus de pression ? », « Un chauffe-eau qui goutte ? » |
| 4 – 6 s | Piano, roulement, montée | « Le dépannage, ça s'apprend. » Une goutte tombe |
| 6 – 8 s | Drop | La goutte ouvre le crème du support : logo O NET, « ACADÉMIE » |
| 8 – 10 s | Drop | « Les bases essentielles de la plomberie et du dépannage », une ligne par temps |
| 10 – 16 s | Drop, coup de tuyau à chaque geste | Approche terrain : 01 Couper, 02 Sertir, 03 Raccorder, 04 Étancher, 05 Monter |
| 16 – 18 s | La batterie se retire | La salle : « Support théorique, comprendre avant d'intervenir. » |
| 18 – 20 s | Retour du groove | Méthode : « Diagnostiquer », sur la slide « Problème de débit d'eau ? » |
| 20 – 22 s | Groove | « Comprendre l'essentiel pour mieux passer à la pratique. » |
| 22 – 24 s | Relance | « Une formation conçue par Tahere Iliès » |
| 24 – 26 s | Montée, kick à la croche | « L'académie. La formation. Le programme. Présentés le… » |
| 26 – 29 s | Impact, drop final | « 21 novembre », samedi 2026, présentation officielle |
| 29 – 32,5 s | Accord tenu, fondu | Carte de fin : logo, titre, « Samedi 21 novembre 2026 », crédits |

En 9:16, les textes restent entre 200 px et 1 640 px de hauteur, pour ne pas passer sous l'interface des réseaux.
