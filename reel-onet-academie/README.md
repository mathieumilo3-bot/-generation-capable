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
- `sfx.py` : bande-son épurée générée avec numpy.
  - **Musique minimale** en fa mineur, sans boucle :
    - une pulsation de synthé en croches qui respire avec le kick ;
    - un kick doux sur chaque coupe ;
    - un sub, une nappe de cordes et du piano en notes isolées ;
    - une mélodie au pluck qui change de phrase à chaque section.

    Elle respire sur la salle, se resserre dans la montée et résout en fa majeur sur la carte finale.
  - **Peu de bruitages, mais variés et musicaux** :
    - un souffle doux sur les textes, d'une hauteur différente à chaque fois ;
    - un « tink » de tuyau accordé sur chaque geste, une note plus haute à chaque fois ;
    - des clics accordés sur le diagnostic ;
    - de l'eau sur les transitions et une goutte ;
    - un boom grave et propre, réservé aux moments clés (21 novembre, titre, carte finale, plus trois coups plus légers sur « Ton métier / Ta formation / Ton académie »).
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
| 0–1 | 0 – 3,4 s | Piano en notes isolées, nappe grave, cordes aiguës qui s'ouvrent | « Rendez-vous le… » lettre par lettre |
| 2–3 | 3,4 – 6,9 s | Boom, nappe, bulles, la pulsation entre | « 21 » qui se remplit d'eau, « Novembre », samedi 2026, présentation de la formation |
| 4–5 | 6,9 – 10,3 s | Eau, puis kick sur chaque coupe et souffle sur chaque mot, le pluck chante | « Tu veux » / « devenir » / « plombier ? », un gros plan tous les deux temps |
| 6–7 | 10,3 – 13,7 s | Les charleys entrent, souffles | « Un métier qui recrute. », « On commence par les bases. » |
| 8 | 13,7 – 15,4 s | La pulsation s'ouvre, montée douce, goutte | « La plomberie, ça s'apprend. » La goutte tombe |
| 9–10 | 15,4 – 18,9 s | Boom, tout le groove, souffle sur chaque ligne | Titre de la formation dans un tuyau de cuivre |
| 11–15 | 18,9 – 27,4 s | Eau, puis « tink » accordé sur chaque geste (une note plus haute à chaque fois) | « Tu apprends à » : Couper, Sertir, Raccorder, Étancher, Monter, chacun avec sa deuxième ligne |
| 16 | 27,4 – 29,1 s | Eau, respiration : nappe et piano, sans batterie | La salle : « Support théorique » |
| 17–18 | 29,1 – 32,6 s | Le kick revient, clics accordés sur les pastilles | « Tu apprends à diagnostiquer » |
| 19 | 32,6 – 34,3 s | Montée, charleys qui se resserrent | « Comprendre l'essentiel pour mieux passer à la pratique. » |
| 20–21 | 34,3 – 37,7 s | Trois coups graves et un accord de piano sous chaque mot, puis une goutte | « Ton métier. », « Ta formation. », « Ton académie. » |
| 22+ | 37,7 – 43,4 s | Boom, fa majeur, piano en arpège, reflet discret | La goutte ouvre la carte : logo, titre, « Samedi 21 novembre 2026 » |

En 9:16, les textes restent entre 200 px et 1 640 px de hauteur, pour ne pas passer sous l'interface des réseaux.
