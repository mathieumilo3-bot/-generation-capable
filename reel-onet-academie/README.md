# Vidéo de présentation « O NET ACADÉMIE »

Vidéo de 45 s qui présente l'académie et la formation « Les bases essentielles de la plomberie et du dépannage », le samedi 21 novembre 2026. Elle s'adresse aux futurs plombiers, c'est-à-dire aux personnes qui veulent apprendre le métier. Elle existe en deux formats, rendus à partir du même montage :

- `ONET-Academie-16x9.mp4` : 1920×1080, pour la projection en salle ou YouTube ;
- `ONET-Academie-9x16.mp4` : 1080×1920, pour Instagram, TikTok, WhatsApp et les stories ;
- `*-envoi.mp4` : copies légères des deux formats, pour l'envoi.

Le montage est rendu image par image dans Chromium (Playwright), encodé en H.264 par ffmpeg, puis mixé avec une bande-son originale à 140 bpm et normalisé à −12 LUFS. Toutes les coupes tombent sur un temps.

- `assets/` : photos de l'atelier, slides du support de cours, logo détouré depuis la couverture, et les deux rushs (coupe du cuivre, filasse). Le bon de commande client n'est pas utilisé, car il contient des données personnelles.
- `reel.json` : tempo, temps de début de chaque scène (`T`), impacts, apparitions de texte (`texthits`), tics de lettres, nappes de tension, coups de tuyau, gouttes, chasses d'eau (`wipes`), cymbales inversées, remplissage du « 21 », montées et fondu final. L'image et le son lisent tous les deux ce fichier.
- `extract.py` : extrait les deux rushs en images à 30 i/s, redressées (`shots/`).
- `comp.html` : compositeur canvas. Il gère les deux mises en page : plein cadre en 9:16, carte verticale sur fond flouté en 16:9.
- `sfx.py` : bande-son générée avec numpy, en deux couches :
  - **Musique** : une trap/phonk épique en fa mineur (Fm–Ab–Bbm–C), avec une 808 saturée avec glissés, une cloche phonk en mélodie, une caisse claire lourde, des charleys en roulements, des « BRAAAM » de bande-annonce, des stabs de cuivres et des chœurs.
  - **Habillage sonore de cinéma** : chaque apparition de texte a son souffle et son impact sourd. Les gros impacts superposent un sub qui plonge, un craquement et une résonance métallique, avec une longue réverbération. S'y ajoutent des tics sur les lettres qui tombent, des nappes graves de tension avant les drops, des cymbales inversées, et les sons de plomberie : coups de tuyau, gouttes, chasses d'eau, bulles.
- `render.js` : rendu des images, de l'audio et du mixage final.

## Rendu

```bash
cd reel-onet-academie
mkdir -p fonts && cd fonts && npm pack @fontsource/anton @fontsource/open-sans \
  && for f in *.tgz; do tar xzf "$f" && mv package "${f%.tgz}"; done && rm *.tgz && cd ..
python3 -I extract.py .
node render.js stills 16x9 --stills 0.6,4.5,13.9,23,41   # images de contrôle dans stills/
node render.js ONET-Academie-16x9.mp4 16x9
node render.js ONET-Academie-9x16.mp4 9x16
```

## Effets

- **Ouverture** : une goutte tombe, touche le centre et ouvre la carte de l'académie (logo, titre, date). C'est l'ancienne carte de fin, placée en tête pour accrocher.
- **Chasse d'eau** : une vague bleue, avec mousse, rayons de lumière et bulles, monte, couvre l'écran sur la coupe puis repart vers le haut, aux passages 3,4 s, 17,1 s, 25,7 s et 36 s.
- **Tuyau de cuivre** : il se pose autour du titre, avec ses manchons de raccord, puis une impulsion d'eau lumineuse circule dedans.
- **« 21 » rempli d'eau** : l'eau monte dans les chiffres, avec des vagues, des bulles et un reflet quand c'est plein.
- **Lettres qui tombent** : une par une, avec rebond, sur « La plomberie, ça s'apprend. » et « Novembre ».
- **Impacts** : aberration chromatique, tremblement et flash.
- **Coupes** : flou de zoom à chaque coupe, halos de lumière sur les photos, et reflet qui balaie le logo.

## Structure (140 bpm, 1 mesure = 1,71 s)

Chaque texte reste à l'écran au moins une mesure (1,7 s), et les messages clés deux mesures (3,4 s). Aucun plan n'est utilisé deux fois. Le rush de filasse n'apparaît que sur « Étancher », quand la filasse est presque posée, et l'accroche utilise la fin du rush de coupe.

| Mesures | Temps | Son | Image et texte |
|---|---|---|---|
| 0–1 | 0 – 3,4 s | Nappe grave, goutte, BRAAAM, chœur, 808 tenue | Ouverture : la goutte ouvre la carte O NET ACADÉMIE, avec le titre et « Samedi 21 novembre 2026 » |
| 2–5 | 3,4 – 10,3 s | Chasse d'eau, puis le beat tombe | « Tu veux devenir plombier ? » (2 mesures), « Un métier qui recrute. », « On commence par les bases. » |
| 6–7 | 10,3 – 13,7 s | Nappe de tension, chœur, roulement, cymbale inversée | « La plomberie, ça s'apprend. » Une goutte tombe |
| 8–9 | 13,7 – 17,1 s | Drop : BRAAAM, sub drop | La goutte ouvre le titre de la formation dans un tuyau de cuivre |
| 10–14 | 17,1 – 25,7 s | Drop, coup de tuyau à chaque geste | « Tu apprends à » : Couper, Sertir, Raccorder, Étancher, Monter (1 mesure chacun) |
| 15–16 | 25,7 – 29,1 s | Coupure : nappe, chœur, 808 tenue | Chasse d'eau, puis la salle : « Support théorique » |
| 17–20 | 29,1 – 36 s | Groove | « Tu apprends à diagnostiquer », puis « Comprendre l'essentiel… » |
| 21–22 | 36 – 39,4 s | Montée : kick aux temps puis à la croche, roulement serré | Chasse d'eau, puis « Ton métier. Ta formation. Ton académie. Rendez-vous le… » |
| 23–24 | 39,4 – 42,9 s | Drop final : BRAAAM, chœur, crash, bulles | « 21 » qui se remplit d'eau, « Novembre », samedi 2026 |
| 25 | 42,9 – 45 s | BRAAAM final, chœur, dernière phrase de cloche | « O NET ACADÉMIE », puis fondu |

En 9:16, les textes restent entre 200 px et 1 640 px de hauteur, pour ne pas passer sous l'interface des réseaux.
