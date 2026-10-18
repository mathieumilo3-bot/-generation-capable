# Vidéo de présentation « O NET ACADÉMIE »

Vidéo de 51 s qui présente l'académie et la formation « Les bases essentielles de la plomberie et du dépannage » (Tahere Iliès), le samedi 21 novembre 2026. Elle s'adresse aux futurs plombiers, c'est-à-dire aux personnes qui veulent apprendre le métier. Elle existe en deux formats, rendus à partir du même montage :

- `ONET-Academie-16x9.mp4` : 1920×1080, pour la projection en salle ou YouTube ;
- `ONET-Academie-9x16.mp4` : 1080×1920, pour Instagram, TikTok, WhatsApp et les stories.

Le montage est rendu image par image dans Chromium (Playwright), encodé en H.264 par ffmpeg, puis mixé avec une musique originale à 140 bpm et normalisé à −12 LUFS. Toutes les coupes tombent sur un temps.

- `assets/` : photos de l'atelier, slides du support de cours, logo détouré depuis la couverture, et les deux rushs (coupe du cuivre, filasse). Le bon de commande client n'est pas utilisé, car il contient des données personnelles.
- `reel.json` : tempo, temps de début de chaque scène (`T`), impacts, coups de tuyau, gouttes, chasses d'eau (`wipes`), cymbales inversées, remplissage du « 21 », whooshs, montées et fondu final. L'image et le son lisent tous les deux ce fichier.
- `extract.py` : extrait les deux rushs en images à 30 i/s, redressées (`shots/`).
- `comp.html` : compositeur canvas. Il gère les deux mises en page : plein cadre en 9:16, carte verticale sur fond flouté en 16:9.
- `sfx.py` : musique originale générée avec numpy, une trap/phonk épique en fa mineur (Fm–Ab–Bbm–C). Elle contient une 808 saturée avec glissés, une cloche phonk en mélodie avec écho, une caisse claire lourde au demi-temps, des charleys en roulements (triolets, triples croches), des « BRAAAM » de bande-annonce, des stabs de cuivres et des chœurs. S'y ajoutent les bruitages : coups de tuyau, gouttes, chasses d'eau, bulles, cymbales inversées, sub drops, whooshs et montées.
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

## Effets

- **Chasse d'eau** : une vague bleue, avec mousse, rayons de lumière et bulles, monte, couvre l'écran sur la coupe puis repart vers le haut, aux passages 17,1 s, 25,7 s et 36 s. On l'entend avec un souffle d'eau et des bulles.
- **Tuyau de cuivre** : il se pose autour du titre, avec ses manchons de raccord, puis une impulsion d'eau lumineuse circule dedans.
- **« 21 » rempli d'eau** : l'eau monte dans les chiffres, avec des vagues, des bulles et un reflet quand c'est plein. On entend des bulles pendant le remplissage.
- **Lettres qui tombent** : une par une, avec rebond, sur « La plomberie, ça s'apprend. », « Tahere Iliès » et « Novembre ».
- **Impacts** : aberration chromatique, tremblement et flash. Un sub drop et une cymbale inversée amènent les deux gros impacts.
- **Coupes** : flou de zoom à chaque coupe, halos de lumière orange et bleus sur les photos, et reflet qui balaie le logo.

## Structure (140 bpm, 1 mesure = 1,71 s)

Chaque texte reste à l'écran au moins une mesure (1,7 s), et les messages clés deux mesures (3,4 s), pour qu'on ait le temps de lire.

| Mesures | Temps | Musique | Image et texte |
|---|---|---|---|
| 0–3 | 0 – 6,9 s | BRAAAM d'entrée, 808, cloche ; la caisse claire arrive à la mesure 2 | « Tu veux devenir plombier ? » (2 mesures), « Un métier qui recrute. », « On commence par les bases. » |
| 4–5 | 6,9 – 10,3 s | Chœur, roulement, 808 qui monte, cymbale inversée | « La plomberie, ça s'apprend. » Une goutte tombe |
| 6–7 | 10,3 – 13,7 s | Drop : BRAAAM, sub drop | La goutte ouvre le crème du support : logo O NET, « ACADÉMIE » |
| 8–9 | 13,7 – 17,1 s | Drop | Titre de la formation dans un tuyau de cuivre, puis chasse d'eau |
| 10–14 | 17,1 – 25,7 s | Drop, coup de tuyau à chaque geste | « Tu apprends à » : Couper, Sertir, Raccorder, Étancher, Monter (1 mesure chacun) |
| 15–16 | 25,7 – 29,1 s | Coupure : chœur, 808 tenue | Chasse d'eau, puis la salle : « Support théorique » |
| 17–20 | 29,1 – 36 s | Groove | « Tu apprends à diagnostiquer », puis « Comprendre l'essentiel… » |
| 21–22 | 36 – 39,4 s | Groove, BRAAAM | Chasse d'eau, puis « Une formation conçue par Tahere Iliès » |
| 23–24 | 39,4 – 42,9 s | Montée : kick aux temps puis à la croche, roulement serré | « Ton métier. Ta formation. Ton académie. Rendez-vous le… » (2 temps chacun) |
| 25–26 | 42,9 – 46,3 s | Drop final : BRAAAM, chœur, crash | « 21 » qui se remplit d'eau, « Novembre », samedi 2026 |
| 27+ | 46,3 – 50,9 s | BRAAAM final, chœur, dernière phrase de cloche | Carte de fin : logo, titre, « Samedi 21 novembre 2026 », crédits |

En 9:16, les textes restent entre 200 px et 1 640 px de hauteur, pour ne pas passer sous l'interface des réseaux.
