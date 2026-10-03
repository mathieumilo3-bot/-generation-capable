# MISSION — Rendre le monteur vidéo commercialisable à grande échelle

Tu es l'ingénieur principal du dépôt `mathieumilo3-bot/video-editor` (app Fly `gc-video-editor-e92f28a6`).
Ta mission : transformer l'app actuelle en une usine de montage fiable, rapide, précise, peu coûteuse,
parallélisable et sécurisée, vendable dès maintenant. Tu travailles en autonomie complète, phase par phase,
et tu ne déclares rien « fait » sans preuve mesurée en production.

## 1. État mesuré en production (12 derniers montages, 2026-10-03)

- Temps total : 6 à 45 min par vidéo. Le rendu final (`final_render`) prend en médiane 825 s, au maximum 2294 s,
  alors que le rendu d'aperçu (`proxy_render`) du même montage prend 18 à 60 s. Toutes les autres étapes réunies
  prennent environ 2 min.
- Le dernier projet (`proj_d02bf623…`) a fait 3 rendus finaux successifs : 26 min au total.
- Durée non respectée dans 4 cas sur 12 : 40–55 s demandés → 29,6 s ; 40–55 s → 36,9 s ; 30 s → 50,1 s ;
  « garde la durée complète » sur 156 s de rush → 59 s.
- `production-digest.json` porte les drapeaux `fallback` / `degraded` / `blocking` sur 11 projets sur 12.
- Erreurs : 2 × « Stale edit blueprint cannot complete a final render », 1 × « Vision réelle impossible »,
  une transcription à 225 s (normalement 3 s), une `story_blueprint` à 223 s.
- Les effets (zooms, transitions) disparaissent quand le rendu Remotion échoue et que FFmpeg prend le relais
  (`manifest.skipped`).
- `VIDEO_EDITOR_MAX_CONCURRENT_JOBS=1` sur une performance-4x de 16 Go : une seule vidéo à la fois.
- Coût : 0,11 à 0,30 $ et 22 à 60 appels d'API par vidéo.
- Code : 83 000 lignes, 143 modules dans agents/ et pipeline/, dont 11 « brains », 10 « directors »,
  3 « quality gates » qui se superposent et se contredisent. Le brief libre est réinterprété par plusieurs
  couches : certains mots (« cinéma », « film », « carré », « à 12 s ») déclenchent des modes cachés
  (source-timeline-lock, letterbox) qui cassent le montage.

## 2. Objectifs chiffrés (critères d'acceptation, tous obligatoires)

| Critère | Cible |
|---|---|
| Temps total, rush ≤ 3 min → short de 60 s | p50 ≤ 2 min, p95 ≤ 4 min |
| Rendu final | ≤ 1,5 × la durée de la vidéo produite, un seul rendu final par montage |
| Durée livrée | 100 % dans la fourchette demandée (± 1 s si une seule valeur) ; « durée complète » = durée complète |
| Effets demandés (zoom, transition, titre, sous-titres, musique, fondu) | 100 % présents dans le MP4, vérifiés sur le fichier ; jamais supprimés en silence |
| Coupes | 0 coupe au milieu d'un mot, 0 mot dupliqué, 0 « euh » restant |
| Sous-titres | décalage ≤ 80 ms par rapport à la voix |
| Audio | −14 LUFS ± 1, crête ≤ −1 dBTP, musique sous la voix |
| Stabilité | même brief + même rush → même montage (sortie IA en cache, température 0) |
| Parallélisme | ≥ 4 montages simultanés par machine sans dépasser les cibles de temps ; montée horizontale en ajoutant des machines |
| Coût | ≤ 0,10 $ d'API par vidéo, mesuré dans `cost_ledger` |
| Taux de réussite | ≥ 99 % des projets livrés sans intervention humaine |
| Échec | jamais de vidéo dégradée livrée en silence : si une exigence ne peut pas être tenue, le projet s'arrête avec un message clair pour l'utilisateur |

## 3. Règles non négociables

1. **Mesurer avant de toucher.** Chaque changement part d'un chiffre mesuré et se termine par le même chiffre
   remesuré. Pas d'optimisation à l'aveugle.
2. **Une seule source de vérité par décision.** Une seule couche décide du montage. Supprime les couches
   redondantes au lieu d'en ajouter une nouvelle par-dessus.
3. **Un seul chemin de rendu.** Pas de « rendu de secours » qui retire des effets. Si un effet ne peut pas être
   rendu, c'est une erreur explicite.
4. **Le brief ne peut que préciser, jamais casser.** Aucun mot du brief ne doit activer un mode caché.
   Le brief est converti une seule fois en contrat structuré, validé par schéma, et affiché à l'utilisateur.
5. **Ancrage sur les mots, pas sur les secondes.** Tout effet est attaché à un indice de mot de la transcription.
6. **Sécurité par défaut** : arguments FFmpeg en tableau (jamais de shell), validation zod de toutes les entrées,
   plafonds de taille et de durée, aucun secret côté client, isolation par utilisateur.
7. **Jamais de test désactivé, jamais de `--no-verify`, jamais de push sans tests verts.**
8. **Une phase = une branche, des commits atomiques, un déploiement, une vérification en production.**

## 4. Plan d'exécution (dans cet ordre, ne pas passer à la suite sans avoir atteint les critères)

### Phase 0 — Banc d'essai et instrumentation (fondation de tout le reste)
- `scripts/bench/` : rejoue 10 projets réels de production (rush + brief stockés dans `/data`) et 3 rushes de
  `qa-real-input/`. Pour chacun, il produit un score : temps par étape, durée livrée par rapport à la cible,
  effets demandés / présents dans le MP4, coupes dans un mot, décalage des sous-titres, LUFS, coût, nombre
  d'appels d'API.
- Chronométrage fin de `final_render` : chaque sous-étape (`cutClip`, `concat`, `overlay_track` Remotion,
  `finalEncode`, mixage, `delivery-audit`) avec sa durée et son nombre d'images par seconde.
- Explique précisément pourquoi le rendu final est 20 fois plus lent que l'aperçu et pourquoi il est relancé
  2 à 3 fois (`delivery-audit` → réparation → nouveau rendu ? « Stale edit blueprint » ?).
- Le banc tourne en CI et **bloque tout déploiement qui fait baisser le score**.
- Livrable : un tableau de référence des chiffres actuels, commité.

### Phase 1 — Vitesse du rendu final (le plus gros gain, environ 85 % du temps)
- Un seul rendu final par montage : la vérification après rendu corrige le plan de montage et ne relance un rendu
  que si une exigence est réellement violée, au plus une fois, et seulement sur le segment fautif si possible.
- Remplacer le rendu image par image Remotion/Chromium des sous-titres et textes par du rendu natif FFmpeg :
  sous-titres karaoké en ASS (libass), titres en `drawtext` ou ASS, zooms par `crop`/`scale` animés suivant
  le visage, transitions par `xfade`, fondu par `fade`. Vérifie le rendu visuel à l'identique sur le banc
  (SSIM ≥ 0,98 sur les images clés et contrôle visuel de captures).
- Encodage en une seule passe, préréglage x264 adapté (`-preset veryfast`, CRF calibré), pas de réencodages
  intermédiaires sans perte inutiles, découpe sans réencodage quand c'est possible.
- Critère : rendu final ≤ 1,5 × la durée de la vidéo, sur le banc et en production.

### Phase 2 — Contrat de durée et de contenu exact
- La durée cible (fourchette, valeur unique, « durée complète ») est une contrainte dure du plan de montage,
  vérifiée avant le rendu. Un plan hors fourchette est corrigé (ajout ou retrait de phrases entières par ordre de
  qualité) avant de rendre, jamais livré.
- « Garde tout / durée complète / ordre d'origine » = mode fidèle : seuls les silences et les « euh » sont retirés.
- Le récit doit rester cohérent : phrases complètes, début accrocheur si demandé, fin sur une phrase conclusive.
- Corrige « Stale edit blueprint » à la racine (condition de concurrence entre versions du plan).
- Critère : 100 % des projets du banc dans la fourchette, 0 phrase coupée.

### Phase 3 — Un seul cerveau : brief → contrat → plan de montage
- Le brief est converti par **un seul appel IA** en un contrat structuré (zod) : durée, format, cadrage,
  style des sous-titres, liste des effets ancrés sur des phrases exactes, musique, titre, appel à l'action.
  Le contrat est affiché à l'utilisateur avant le montage (« voici ce que j'ai compris »).
- **Un seul appel IA** produit le plan de montage (passages gardés par indices de mots + effets ancrés sur
  des indices de mots), validé par schéma, avec au plus une réparation automatique.
- Tout le reste est déterministe (sans IA) : recalage des coupes sur l'audio (`cut-snap.ts`), cadrage visage,
  sous-titres, mixage.
- Supprime les couches redondantes (`creative-brain*`, `human-brain*`, `editor*`, `*director*` doublons,
  quality gates qui se contredisent) une fois le banc égal ou meilleur. Supprime les déclencheurs cachés
  (source-timeline-lock déclenché par des mots, letterbox implicite).
- Mets en cache les sorties IA par empreinte (rush + brief), température 0.
- Critère : ≤ 3 appels IA par vidéo, coût ≤ 0,10 $, même entrée → même sortie, banc ≥ niveau précédent.

### Phase 4 — Qualité professionnelle vérifiée sur le fichier final
- Contrôle final déterministe sur le MP4 : durée, chaque effet du contrat présent à son instant
  (détection de mouvement / zoom / noir / texte), synchro sous-titres, LUFS, crêtes, images noires ou figées,
  coupes dans un mot (enveloppe audio).
- Rapport de conformité lisible par l'utilisateur : chaque instruction du brief → « fait à 00:12 » ou
  « impossible parce que… ».
- Critère : 100 % des effets demandés présents sur le banc, 0 « euh », décalage sous-titres ≤ 80 ms.

### Phase 5 — Parallélisme et montée en charge
- File de travaux persistante avec reprise après plantage, workers sans état, concurrence calculée selon
  CPU et RAM (`VIDEO_EDITOR_MAX_CONCURRENT_JOBS` ≥ 4 sur performance-4x après mesure).
- Les étapes IA (attente réseau) ne bloquent pas les cœurs de rendu : pool IA séparé du pool de rendu.
- Montée horizontale : machines Fly de rendu supplémentaires démarrées à la demande selon la longueur de la file,
  arrêtées quand la file est vide (sans couper un rendu en cours).
- Stockage des médias sur un stockage objet (S3/Tigris) pour que n'importe quelle machine puisse traiter
  n'importe quel projet.
- Remplacer SQLite par Postgres si plusieurs machines doivent écrire.
- Test de charge : 20 montages soumis d'un coup → tous livrés, p95 dans les cibles, aucune perte.
- Critère : débit ≥ 4 vidéos en parallèle par machine, temps p95 tenu sous charge.

### Phase 6 — Sécurité et exploitation
- Authentification, isolation stricte des projets par utilisateur, envoi direct vers le stockage par URL signée,
  limites de débit, plafonds (taille, durée, nombre de rushes), quotas par utilisateur.
- Validation zod de toutes les routes API, en-têtes de sécurité, aucun secret dans le client ni dans les logs.
- FFmpeg et ffprobe exécutés avec des arguments en tableau, délais maximum, limites mémoire.
- Suivi : tableau de bord (temps par étape, taux d'échec, coût par vidéo, longueur de la file),
  alerte si p95 ou taux d'échec dérivent.
- Revue de sécurité complète (`/security-review`) avant la mise en vente.

### Phase 7 — Nettoyage
- Supprimer le code mort laissé par les phases 1 à 3 (modules, tests et variables d'environnement qui ne servent
  plus). Objectif : diviser au moins par 2 la taille de `packages/agents` et `packages/pipeline`.
- Documentation courte : architecture, comment lancer le banc, comment déployer.

## 5. Méthode de travail à chaque phase

1. Mesure le point de départ avec le banc.
2. Écris le changement minimal qui atteint le critère.
3. Lance typecheck, lint, tests unitaires et banc. Tout doit être vert et le banc ≥ avant.
4. Relis ton diff de façon adverse : qu'est-ce qui pourrait casser en production ?
5. Commit, push, déploiement, puis vérification **sur un vrai montage en production** avec le diagnostic
   en lecture seule (`scripts/diag`).
6. Compte rendu de la phase : chiffres avant → après, ce qui reste, risques.

## 6. Compte rendu attendu à la fin de chaque phase

- Tableau des critères : valeur avant, valeur après, cible, atteint oui/non.
- Liens vers les commits et le déploiement.
- Prochaine phase et ce qui la bloque, le cas échéant.

Commence par la phase 0 maintenant.
