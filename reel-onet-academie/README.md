# Vidéo de présentation « O NET ACADÉMIE »

Vidéo de 43 s qui présente l'académie et la formation « Les bases essentielles de la plomberie et du dépannage », le samedi 21 novembre 2026. Elle s'adresse aux futurs plombiers, c'est-à-dire aux personnes qui veulent apprendre le métier. Elle existe en deux formats, rendus à partir du même montage :

- `ONET-Academie-16x9.mp4` : 1920×1080, pour la projection en salle ou YouTube ;
- `ONET-Academie-9x16.mp4` : 1080×1920, pour Instagram, TikTok, WhatsApp et les stories ;
- `*-envoi.mp4` : copies légères des deux formats, pour l'envoi.

Le montage est rendu image par image dans Chromium (Playwright), encodé en H.264 par ffmpeg, puis mixé avec une bande-son originale (bruitages et musique de bande-annonce, grille à 140 bpm), normalisée vers −12 LUFS puis limitée pour que les crêtes restent sous −1,5 dBFS après l'encodage AAC (environ −13 LUFS au final). Toutes les coupes tombent sur un temps.

- `assets/` : photos de l'atelier, slides du support de cours, logo détouré depuis la couverture, et les deux rushs (coupe du cuivre, filasse). Le bon de commande client n'est pas utilisé, car il contient des données personnelles.
- `reel.json` : tempo, temps de début de chaque scène (`T`), impacts visuels (`hits`), chasses d'eau (`wipes`), remplissage du « 21 », et repères sonores (`cues`) : un par apparition de texte, avec son type de bruitage. On y trouve aussi les nappes, les montées, les cymbales inversées, les coups de tuyau et le fondu final. L'image et le son lisent tous les deux ce fichier.
- `extract.py` : extrait les deux rushs en images à 30 i/s, redressées (`shots/`).
- `comp.html` : compositeur canvas. Il gère les deux mises en page : plein cadre en 9:16, carte verticale sur fond flouté en 16:9.
- `sfx.py` : bande-son générée avec numpy, calée sur le texte :
  - **Bruitages percutants**, un par apparition de texte, au premier plan du mix :
    - un coup de sabre laser sur chaque mot qui claque ;
    - des demi-explosions (craquement, souffle, sub, débris) avec flash photo sur les grands moments : le 21 novembre, le titre, les trois coups, la fin ;
    - un avion de chasse qui traverse l'écran, avec effet Doppler, sur les chasses d'eau ;
    - un sifflement de bombe sur les gouttes qui tombent ;
    - un allumage de sabre et des zaps électriques sur les lettres qui tombent ;
    - des souffles qui montent sur les textes qui glissent ;
    - un raclement de métal quand le tuyau se pose ;
    - un « shing » sur le reflet du logo.
  - **Musique de bande-annonce** en fa mineur, en actes et sans boucle. Elle frappe en même temps que chaque mot (stab de cuivres et cordes sur l'accord de la mesure) et s'efface un instant sous chaque gros bruitage.
  - **Sons de plomberie** : coups de tuyau sur les gestes, eau, bulles.
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

- **Ouverture** : « Rendez-vous le » arrive lettre par lettre sur le fond d'eau, avec l'horloge et le battement de cœur, puis le « 21 » se remplit d'eau sur le premier impact.
- **Chasse d'eau** : une vague bleue, avec mousse, rayons de lumière et bulles, monte, couvre l'écran sur la coupe puis repart vers le haut, aux passages 6,9 s, 20,6 s et 29,1 s.
- **Tuyau de cuivre** : il se pose autour du titre, avec ses manchons de raccord, puis une impulsion d'eau lumineuse circule dedans.
- **Lettres qui tombent** : une par une, avec rebond, sur « Rendez-vous le », « La plomberie, ça s'apprend. » et « Novembre ».
- **Impacts** : aberration chromatique, tremblement et flash.
- **Fin** : une goutte tombe, touche le centre et ouvre la carte de l'académie (logo, titre, date).

## Structure (grille à 140 bpm, 1 mesure = 1,71 s)

Le rythme ne retombe jamais : il y a toujours un texte qui arrive ou une image qui change, au moins tous les deux temps (0,86 s). Chaque texte reste pourtant à l'écran assez longtemps pour être lu.
- Dans l'accroche, les mots arrivent un par un, et un nouveau gros plan apparaît dessous tous les deux temps.
- Chaque geste a une deuxième ligne qui arrive à mi-mesure.
- La caméra pousse en continu sur chaque photo.

Aucun plan n'est utilisé deux fois à l'identique.

| Mesures | Temps | Son | Image et texte |
|---|---|---|---|
| 0–1 | 0 – 3,4 s | Horloge, cœur, nappe, allumage de sabre, zaps | « Rendez-vous le… » lettre par lettre |
| 2–3 | 3,4 – 6,9 s | Explosion, flash, BRAAAM, chœur, bulles | « 21 » qui se remplit d'eau, « Novembre », samedi 2026, présentation de la formation |
| 4–5 | 6,9 – 10,3 s | Avion de chasse, sabre et flash sur chaque mot, explosion sur « plombier » | « Tu veux » / « devenir » / « plombier ? », un gros plan tous les deux temps |
| 6–7 | 10,3 – 13,7 s | Sabre, coup de poing, flashs | « Un métier qui recrute. », « On commence par les bases. » |
| 8 | 13,7 – 15,4 s | Zaps, roulement, sifflement de bombe | « La plomberie, ça s'apprend. » La goutte tombe |
| 9–10 | 15,4 – 18,9 s | Explosion d'eau, raclement de métal, sabres | Titre de la formation dans un tuyau de cuivre |
| 11–15 | 18,9 – 27,4 s | Avion, puis flash, sabre et coup de tuyau à chaque geste | « Tu apprends à » : Couper, Sertir, Raccorder, Étancher, Monter, chacun avec sa deuxième ligne |
| 16 | 27,4 – 29,1 s | Avion, respiration | La salle : « Support théorique » |
| 17–18 | 29,1 – 32,6 s | Acte III qui monte, pops sur les pastilles | « Tu apprends à diagnostiquer » |
| 19 | 32,6 – 34,3 s | Montée | « Comprendre l'essentiel pour mieux passer à la pratique. » |
| 20–21 | 34,3 – 37,7 s | Trois explosions, une tous les deux temps, puis sifflement de bombe | « Ton métier. », « Ta formation. », « Ton académie. » |
| 22+ | 37,7 – 43,4 s | Explosion d'eau, résolution en fa majeur, « shing » | La goutte ouvre la carte : logo, titre, « Samedi 21 novembre 2026 » |

En 9:16, les textes restent entre 200 px et 1 640 px de hauteur, pour ne pas passer sous l'interface des réseaux.
