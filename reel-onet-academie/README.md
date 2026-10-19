# Vidéo de présentation « O NET ACADÉMIE »

Vidéo de 50 s qui présente l'académie et la formation « Les bases essentielles de la plomberie et du dépannage », le samedi 21 novembre 2026. Elle s'adresse aux futurs plombiers, c'est-à-dire aux personnes qui veulent apprendre le métier. Elle existe en deux formats, rendus à partir du même montage :

- `ONET-Academie-16x9.mp4` : 1920×1080, pour la projection en salle ou YouTube ;
- `ONET-Academie-9x16.mp4` : 1080×1920, pour Instagram, TikTok, WhatsApp et les stories ;
- `*-envoi.mp4` : copies légères des deux formats, pour l'envoi.

Le montage est rendu image par image dans Chromium (Playwright), encodé en H.264 par ffmpeg, puis mixé avec une musique de bande-annonce originale (grille à 140 bpm) et normalisé à −12 LUFS. Toutes les coupes tombent sur un temps.

- `assets/` : photos de l'atelier, slides du support de cours, logo détouré depuis la couverture, et les deux rushs (coupe du cuivre, filasse). Le bon de commande client n'est pas utilisé, car il contient des données personnelles.
- `reel.json` : tempo, temps de début de chaque scène (`T`), impacts, apparitions de texte (`texthits`), tics de lettres, nappes de tension, coups de tuyau, gouttes, chasses d'eau (`wipes`), cymbales inversées, remplissage du « 21 », montées et fondu final. L'image et le son lisent tous les deux ce fichier.
- `extract.py` : extrait les deux rushs en images à 30 i/s, redressées (`shots/`).
- `comp.html` : compositeur canvas. Il gère les deux mises en page : plein cadre en 9:16, carte verticale sur fond flouté en 16:9.
- `sfx.py` : bande-son générée avec numpy, en trois couches :
  - **Musique de bande-annonce cinématique** en fa mineur, construite en actes et sans boucle. Chaque mesure a son accord, et la basse monte d'un ton par mesure dans l'acte III. L'ostinato de cordes entre au loin et monte en registre, en brillance et en densité. Les taikos et la caisse claire militaire changent de motif d'une section à l'autre, et la mélodie de cuivres grimpe à chaque geste. Elle utilise aussi des BRAAAM, des chœurs, un piano en notes isolées, une horloge, un battement de cœur et un son de Shepard (montée sans fin). Le final résout en fa majeur.
  - **Habillage sonore de cinéma** : impacts, souffle et impact sourd sur chaque texte, tics sur les lettres, nappes graves de tension, cymbales inversées.
  - **Sons de plomberie** : coups de tuyau, gouttes, chasses d'eau, bulles.

  Un égaliseur en pente sur le master allège le sub et remonte le médium, pour que ça passe aussi sur un téléphone.
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

Chaque texte reste à l'écran au moins une mesure (1,7 s), et les messages clés deux mesures (3,4 s). Aucun plan n'est utilisé deux fois.

| Mesures | Temps | Musique | Image et texte |
|---|---|---|---|
| 0–1 | 0 – 3,4 s | Silence tendu : horloge, cœur, nappe grave, piano, montée de Shepard | « Rendez-vous le… » |
| 2–3 | 3,4 – 6,9 s | Premier impact : BRAAAM, chœur, cordes | « 21 » qui se remplit d'eau, « Novembre », samedi 2026, présentation de la formation |
| 4–9 | 6,9 – 17,1 s | Acte I : l'ostinato de cordes entre au loin et se rapproche, piano descendant, taikos, caisse claire qui serre | « Tu veux devenir plombier ? », « Un métier qui recrute. », « On commence par les bases. », « La plomberie, ça s'apprend. » |
| 10–16 | 17,1 – 29,1 s | Acte II : BRAAAM, taikos pleins, cuivres qui montent à chaque geste, coups de tuyau | Titre dans le tuyau de cuivre, puis Couper, Sertir, Raccorder, Étancher, Monter |
| 17–18 | 29,1 – 32,6 s | Respiration : cordes tenues, chœur, piano, cœur | La salle : « Support théorique » |
| 19–22 | 32,6 – 39,4 s | Acte III : la basse monte d'un ton par mesure, tout se resserre, Shepard, silence | « Diagnostiquer », puis « Comprendre l'essentiel… » |
| 23–25 | 39,4 – 44,6 s | Les trois coups : BRAAAM, chœur et crash, chacun plus haut | « Ton métier. », « Ta formation. », « Ton académie. » |
| 26+ | 44,6 – 50,2 s | Résolution en fa majeur, cordes aiguës, dernières notes de piano | La goutte ouvre la carte : logo, titre, « Samedi 21 novembre 2026 » |

En 9:16, les textes restent entre 200 px et 1 640 px de hauteur, pour ne pas passer sous l'interface des réseaux.
