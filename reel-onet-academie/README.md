# Vidéo de présentation « O NET ACADÉMIE »

Vidéo de 43 s qui présente l'académie et la formation « Les bases essentielles de la plomberie et du dépannage », le samedi 21 novembre 2026. Elle s'adresse aux futurs plombiers, c'est-à-dire aux personnes qui veulent apprendre le métier. Elle existe en deux formats, rendus à partir du même montage :

- `ONET-Academie-16x9.mp4` : 1920×1080, pour la projection en salle ou YouTube ;
- `ONET-Academie-9x16.mp4` : 1080×1920, pour Instagram, TikTok, WhatsApp et les stories ;
- `*-envoi.mp4` : copies légères des deux formats, pour l'envoi.


Direction artistique : classe, dynamique, épuré (voir `../CLAUDE.md`, valable pour toutes les vidéos du dépôt).

Le montage est rendu image par image dans Chromium (Playwright), encodé en H.264 par ffmpeg, puis mixé avec une bande-son originale (bruitages et musique de bande-annonce, grille à 140 bpm), normalisée vers −12 LUFS puis limitée pour que les crêtes restent sous −1,5 dBFS après l'encodage AAC (environ −13,6 LUFS au final). Toutes les coupes tombent sur un temps.

- `assets/` : photos de l'atelier, slides du support de cours, logo détouré depuis la couverture, et les deux rushs (coupe du cuivre, filasse). Le bon de commande client n'est pas utilisé, car il contient des données personnelles.
- `reel.json` : tempo, temps de début de chaque scène (`T`), impacts visuels réservés aux moments clés (`hits`), chasses d'eau (`wipes`), remplissage du « 21 », repères sonores (`cues`), souffles inversés avant les booms (`swells`), montées et fondu final. L'image et le son lisent tous les deux ce fichier.
- `extract.py` : extrait les deux rushs en images à 30 i/s, redressées (`shots/`).
- `comp.html` : compositeur canvas. Il gère les deux mises en page : plein cadre en 9:16, carte verticale sur fond flouté en 16:9.
- `sfx.py` : bande-son en version tension et graves, générée avec numpy. Règle : un seul son à la fois par-dessus un lit grave.
  - **Lit de tension** :
    - une nappe grave qui change d'accord à chaque scène, et qui s'efface sur la salle au profit de cordes aiguës ;
    - un « dum » grave sur chaque coupe ;
    - une horloge à l'ouverture ;
    - des montées coupées net avant chaque impact, avec un son de Shepard dans la dernière ;
    - des cuivres graves (BRAAAM) sur le 21 novembre, le titre et les trois mots ;
    - un fa majeur au final.
  - **Bruitages propres et espacés** :
    - un souffle de sabre sur les mots ;
    - un avion qui passe sur les trois transitions d'eau, seul, sans rien par-dessus ;
    - un coup de tuyau grave et accordé sur chaque geste, une note plus haute à chaque fois ;
    - un impact grave et propre sur les moments clés ;
    - une goutte avant le titre et avant la carte finale.
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
# copies légères pour l'envoi
for f in 16x9 9x16; do ffmpeg -i ONET-Academie-$f.mp4 -c:v libx264 -crf 25 -maxrate 3.5M -bufsize 7M -c:a aac -b:a 192k -movflags +faststart ONET-Academie-$f-envoi.mp4; done
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
| 0–1 | 0 – 3,4 s | Nappe grave qui monte, horloge, montée coupée net | « Rendez-vous le… » lettre par lettre |
| 2–3 | 3,4 – 6,9 s | Impact grave, cuivres graves, deux « dum » comme un cœur, bulles | « 21 » qui se remplit d'eau, « Novembre », samedi 2026, présentation de la formation |
| 4–5 | 6,9 – 10,3 s | Avion qui passe, puis « dum » sur chaque coupe et sabre sur chaque mot | « Tu veux » / « devenir » / « plombier ? », un gros plan tous les deux temps |
| 6–7 | 10,3 – 13,7 s | La nappe change d'accord, sabres | « Un métier qui recrute. », « On commence par les bases. » |
| 8 | 13,7 – 15,4 s | Nappe qui s'ouvre, horloge qui accélère, silence, goutte | « La plomberie, ça s'apprend. » La goutte tombe |
| 9–10 | 15,4 – 18,9 s | Impact, cuivres graves, sabre sur chaque ligne | Titre de la formation dans un tuyau de cuivre |
| 11–15 | 18,9 – 27,4 s | Avion, puis coup de tuyau grave sur chaque geste (une note plus haute à chaque fois) et sabre sur la deuxième ligne | « Tu apprends à » : Couper, Sertir, Raccorder, Étancher, Monter, chacun avec sa deuxième ligne |
| 16 | 27,4 – 29,1 s | Avion, puis respiration : la nappe grave s'efface, cordes aiguës | La salle : « Support théorique » |
| 17–18 | 29,1 – 32,6 s | Montée : « dum » qui s'accélèrent, son de Shepard, petits coups de métal sur les pastilles | « Tu apprends à diagnostiquer » |
| 19 | 32,6 – 34,3 s | « Dum » en croches, silence avant les trois mots | « Comprendre l'essentiel pour mieux passer à la pratique. » |
| 20–21 | 34,3 – 37,7 s | Trois impacts graves avec cuivres et sabre, de plus en plus forts, puis une goutte | « Ton métier. », « Ta formation. », « Ton académie. » |
| 22+ | 37,7 – 43,4 s | Impact, fa majeur aux cuivres graves, cordes aiguës, longue traîne | La goutte ouvre la carte : logo, titre, « Samedi 21 novembre 2026 » |

En 9:16, les textes restent entre 200 px et 1 640 px de hauteur, pour ne pas passer sous l'interface des réseaux.
