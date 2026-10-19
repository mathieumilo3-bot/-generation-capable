# Monteur vidéo IA — MVP

Monteur vidéo personnel autonome propulsé par IA : upload de rushs bruts +
brief en langage naturel → vidéo courte prête à publier, sans timeline,
sans logiciel de montage. Voir le dossier stratégique (conversation
d'origine) pour l'analyse de marché, l'architecture cible et les risques.

**État réel, pas une promesse.** Sans clé API configurée, le pipeline
tourne entièrement sur des replis déterministes (détection de silence
ffmpeg, heuristiques de scoring, extraction de style par détection de
plans) — jamais un texte ou un score inventé à la place d'un vrai calcul.
Avec des clés (`ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `DEEPGRAM_API_KEY`),
les mêmes agents basculent automatiquement sur leur chemin réel, sans
changer une ligne d'appelant. C'est le même principe que `gc-ai-os`
(voir `docs/gc-ai-os/README.md` à la racine du dépôt).

## Pourquoi un dossier séparé de `gc-ai-os`

`gc-ai-os` pilote Génération Capable elle-même (agents CEO/CTO/Marketing…) —
mission et domaine totalement différents de ce produit. Les deux
monorepos partagent des *patterns* (TypeScript strict, pnpm+turbo, Model
Router multi-fournisseur, mode démo honnête sans clé) mais aucun code : les
mélanger casserait la modularité des deux systèmes.

## Démarrer

```bash
pnpm install
pnpm build

# Test bout-en-bout en ligne de commande (génère ses propres rushs de
# test via ffmpeg — aucun fichier externe requis) :
pnpm --filter @video-editor/pipeline run demo

# Interface web :
pnpm --filter @video-editor/web run dev
# -> http://localhost:3000
```

### Sous-titres parlés — transcription locale gratuite

La transcription (sous-titres mot-à-mot) tourne **en local, sans clé ni
coût** : NVIDIA Parakeet TDT 0.6B v3 (25 langues européennes dont le
français, ponctuation incluse) exécuté sur CPU par `sherpa-onnx`
(`packages/model-router/src/local-stt.ts`). Le `Dockerfile` télécharge le
modèle au build ; en local :

```bash
mkdir -p ~/models && curl -L https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2 | tar -xj -C ~/models
export VIDEO_EDITOR_STT_MODEL_DIR=~/models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8

# Test bout-en-bout sur une VRAIE voix : rush = images d'une vidéo + fichiers voix.
# Vérifie que la vidéo finale, re-transcrite, prononce chaque mot sous-titré au bon moment.
pnpm --filter @video-editor/pipeline run test:e2e-speech -- video.mp4 voix1.wav voix2.wav
```

Ordre de choix : modèle local s'il est installé, sinon Deepgram si
`DEEPGRAM_API_KEY` est défini (payant), sinon pas de sous-titres.
`VIDEO_EDITOR_STT=deepgram|off` force un choix.

Montage d'un rush parlé : l'unité est la **phrase** (blancs et prises
ratées retirés, aucune phrase coupée), le rythme vient des punch-ins en une
image ; volume final à -14 LUFS (standard Instagram/TikTok).

Activer les vraies réponses des modèles : copier des clés dans
l'environnement avant de lancer (`ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` ou
`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`). Sans clé, tout tourne quand même —
en mode dégradé honnête, annoncé comme tel dans les logs et les warnings
retournés par le pipeline.

## Déployer en privé (Fly.io)

`Dockerfile` + `fly.toml` sont prêts à l'emploi — Debian (pas Alpine, le
bundler Remotion a un binaire natif lié à glibc), ffmpeg installé,
Chromium headless-shell de Remotion pré-téléchargé au build. Ce
répertoire de session n'a pas d'accès réseau sortant vers Fly.io (politique
réseau de l'environnement) — le déploiement se fait donc depuis ta propre
machine, en 5 commandes :

```bash
# 1. Installer flyctl (une fois) : https://fly.io/docs/flyctl/install/
curl -L https://fly.io/install.sh | sh

# 2. Se connecter (ouvre le navigateur, crée un compte si besoin)
fly auth login

# 3. Depuis video-editor/ : créer l'app (choisis un nom unique globalement)
cd video-editor
fly apps create ton-nom-unique

# 4. Créer le volume persistant (stockage des vidéos + base SQLite)
fly volumes create video_editor_data --app ton-nom-unique --region cdg --size 3

# 5. Éditer fly.toml : remplacer "REMPLACE-MOI" par ton-nom-unique, puis :
fly deploy --app ton-nom-unique
```

`fly deploy` affiche l'URL finale (`https://ton-nom-unique.fly.dev`) — elle
n'est pas indexée ni annoncée nulle part, seul quelqu'un qui connaît
l'adresse y accède (pas d'authentification applicative pour l'instant,
volontaire pour le MVP — voir §16 du brief produit : pas de comptes/SSO).

Pour de vraies réponses IA en production, ajouter les clés en secrets
plutôt qu'en variables d'environnement en clair :

```bash
fly secrets set ANTHROPIC_API_KEY=... DEEPGRAM_API_KEY=... --app ton-nom-unique
```

**Coût** : `shared-cpu-2x` + 2 Go RAM + 3 Go de volume, machine allumée en
continu (`auto_stop_machines = false` — nécessaire car le pipeline tourne
en sous-processus détaché de la requête HTTP ; laisser Fly l'arrêter
automatiquement risquerait de tuer un montage en cours). À vérifier sur
[fly.io/docs/about/pricing](https://fly.io/docs/about/pricing/) — de
l'ordre de quelques dollars à ~15 $/mois selon la région. Pour couper les
coûts entre deux sessions d'usage : `fly scale count 0 --app ton-nom-unique`
(puis `fly scale count 1` pour la relancer).

## Bibliothèque client : liens iCloud / Google Drive → Cloudflare R2

Page `/library` : on colle le lien envoyé par le client, le **serveur**
télécharge les fichiers et les range dans R2 (jamais sur ton Mac), puis on
lance autant de montages que voulu à partir des mêmes fichiers.

| Lien du client | Accès | Qualité |
|---|---|---|
| `share.icloud.com/photos/…` (Photos → Partager → **Copier le lien iCloud**) | API web CloudKit non documentée | **Originaux** — lien valable 30 jours |
| `www.icloud.com/sharedalbum/#…` (album partagé, « Site web public » activé) | API web sharedstreams non documentée | **Réduits par Apple** : ~2048 px, vidéos 720p/1080p |
| `photos.icloud.com/shared/album/…` (albums partagés récents) | API web CloudKit non documentée | selon l'album |
| `drive.google.com/drive/folders/…` (« Tous les utilisateurs disposant du lien ») | **API Drive v3 officielle** (`GOOGLE_DRIVE_API_KEY`) | **Originaux** |

**Honnêteté sur iCloud** : Apple ne publie aucune API pour ces liens. Le
module utilise les mêmes appels que la page icloud.com (et que les outils
open source depuis des années) ; Apple peut les changer sans préavis. Si
un lien exige une connexion Apple ou si le format change, l'import échoue
avec un message explicite → demander au client un dossier Google Drive.

Déroulé d'un import (`packages/ingest`) :

1. **Test d'abord** (défaut) : le lien est lu (nombre de vidéos/photos,
   volume annoncé) et seuls N fichiers (2/3 vidéos, ≥ 1 photo) sont
   importés. Bouton « importer les X fichiers » ensuite — les fichiers
   déjà importés ne sont pas retéléchargés.
2. Par fichier : URL fraîche (les URLs iCloud expirent) → téléchargement
   avec reprise `Range` → SHA-256 → type/durée/format **mesurés par
   ffprobe** → miniature JPEG → pré-analyse ffmpeg (exposition, mouvement,
   voix, passages utiles) → envoi multipart vers R2 → fichier temporaire
   supprimé.
3. Reprise : 3 essais immédiats par fichier, puis jusqu'à 5 passages ;
   un import partiel est repris automatiquement (backoff 5 min → 2 h) ;
   un worker mort (redémarrage, OOM) est détecté par heartbeat et repris.
   404 / lien privé = échec définitif sans insister.
4. Montage : sélection automatique (meilleur score, vidéos sombres
   écartées, vidéos > 45 s réduites à leurs passages utiles, ordre de
   l'album) ou cases cochées. Ça crée un **projet ordinaire** dans la file
   de rendu existante ; le worker rapatrie les originaux depuis R2 dans un
   cache partagé (`storage/media-cache/`, une seule fois par fichier) avant
   de lancer le pipeline inchangé.

Rangement R2 : `clients/<client>/<import>/originals/<asset>/<nom d'origine>`
et `…/thumbs/<asset>.jpg`. Les miniatures/originaux sont servis par URL
signée temporaire (les octets ne passent pas par le serveur).

Configuration (secrets Fly) :

```bash
fly secrets set R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=clients-medias GOOGLE_DRIVE_API_KEY=... --app ton-nom-unique
```

Sur le serveur (`fly ssh console`), sans passer par l'interface :

```bash
cd /app/packages/ingest
node dist/cli.js check "<lien>"                          # accès automatisé possible ? (aucun téléchargement)
node dist/cli.js import "<lien>" --client "Nom" --sample 3
node dist/cli.js full <importId>                         # import complet après le test
node dist/cli.js retry <importId>                        # relancer les échecs
```

Disque : seuls les fichiers en transit (≈ `VIDEO_EDITOR_IMPORT_CONCURRENCY`
× taille d'une vidéo) et le cache des montages occupent le volume ; prévoir
un volume Fly de 20 Go+ pour des rushs 4K. Le cache `media-cache/` peut être
vidé sans risque : il se reconstitue depuis R2.

Tests : `pnpm --filter @video-editor/ingest test` (unitaires) et
`pnpm --filter @video-editor/ingest run test:e2e` (bout-en-bout sur serveurs locaux simulant iCloud/Drive/R2 avec de vrais fichiers ffmpeg :
coupure réseau, 503, 404, redirection de partition, pagination, multipart).

## Structure

```
apps/
  web/                    # Next.js — upload, progression réelle, résultat, édition conversationnelle
packages/
  shared-types/            # Contrats de données + schémas zod (validation stricte, anti-hallucination)
  ingest/                    # Import de liens iCloud / Google Drive → Cloudflare R2, bibliothèque client, pont vers le montage
  db/                        # SQLite locale (node:sqlite, zéro dépendance externe) + schéma Postgres cible (db-migrations/)
  model-router/                # Couche d'abstraction multi-fournisseur — jamais de SDK fournisseur importé ailleurs
  cost-ledger/                   # Traçage du coût réel par appel (§10 du brief)
  render/                          # FFmpeg (cuts/concat/audio/encodage) + Remotion (sous-titres animés, zooms) — l'IA ne touche jamais un pixel
  agents/                            # Agents 01-09 + moteur de rythme déterministe (Agent 04)
  pipeline/                            # Orchestrateur bout-en-bout + scripts CLI (spawnés par apps/web)
db-migrations/                          # Schéma Postgres/pgvector de référence pour la prod
```

## Ce qui est réel aujourd'hui

- Pipeline complet des 18 étapes (upload → livraison), progression réelle
  persistée en base, jamais une barre simulée.
- FFmpeg réellement exécuté : proxies, détection de silence/énergie,
  détection de changement de plan, cuts, concat, normalisation de
  loudness, mixage musique+ducking, encodage final.
- Remotion réellement rendu (Chromium headless, testé dans cet
  environnement) pour les sous-titres animés et le zoom — avec repli
  FFmpeg (`drawtext`) si le rendu Remotion échoue dans un environnement
  donné, pour ne jamais bloquer la livraison.
- QA déterministe (9 critères + score global), une correction automatique
  maximum, conservation de la meilleure version (§5 Agent 09 du brief).
- `cost_ledger` : chaque appel de fournisseur est tracé (coût réel si
  clé configurée, estimation explicitement marquée `isStub` sinon).
- Édition conversationnelle : 5 commandes réellement câblées (`shorter`,
  `faster`, `slower`, `more_zooms`, `less_zooms`) avec re-rendu partiel ;
  les 5 autres du menu répondent honnêtement "pas encore implémenté" au
  lieu de simuler un effet.

## Ce qui reste à faire (gaps documentés, pas des oublis silencieux)

- **B-roll : résolu en métadonnées, pas encore inséré visuellement dans
  le rendu.** L'Agent 05 trouve un média stock correspondant, mais
  `assemble.ts` ne le splice pas encore dans la timeline — l'intégrer
  correctement demande de réserver sa durée dans `timelineStart` dès
  l'Agent 04 pour ne pas désynchroniser sous-titres et zooms.
- **Timing mot-à-mot des sous-titres approximé.** Le Segment n'expose que
  le transcript agrégé, pas les timestamps STT individuels — l'Agent 06
  répartit les mots uniformément sur la durée du segment. Propager les
  vrais timestamps mot-à-mot (déjà disponibles dans `video-analyzer.ts`)
  est le raffinement naturel suivant.
- **Pas de queue distribuée.** `apps/web` spawn un sous-processus Node
  par job (`packages/pipeline/src/cli-run-project.ts`) — suffisant pour
  un MVP mono-instance, pas encore une vraie queue (Redis/Temporal) pour
  plusieurs workers.
- **Postgres/pgvector documenté, pas branché.** `db-migrations/0001_init.sql`
  est le schéma cible ; le MVP tourne sur SQLite local. Migrer consiste à
  écrire une seconde implémentation de la classe `Db` derrière la même
  interface publique (même stratégie que `gc-ai-os`).
- **Un seul utilisateur implicite (`demo-user`), pas d'auth.** Volontaire
  (§16 du brief : pas de SSO/comptes équipe dans le MVP).
- **Nettoyage de `storage/<projet>/work/`** non automatisé (voir le
  commentaire dans `packages/render/src/assemble.ts` — supprimer ce
  dossier trop tôt casse le service de fichiers Remotion pour le reste du
  process).

## Mesurer le coût réel

`pnpm --filter @video-editor/pipeline run demo` imprime, à la fin, le
détail complet du `cost_ledger` pour l'exécution — coût par agent, par
fournisseur, et la comparaison aux cibles de conception (`< 2 $` MVP,
`~1 $` optimisé, `< 0,5 $` long terme). Sans clé API, ce coût est
`0 $` par construction (aucun appel réseau payant) — ce qui valide que le
squelette ne dépend d'aucun appel facturé pour tourner, pas que le coût
en production sera nul. Brancher une clé rend la mesure réelle, via ce
même `cost_ledger`, sans changement de code.
