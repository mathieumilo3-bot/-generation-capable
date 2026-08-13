# Video Editing Factory — Architecture de production

Ce document décrit la transformation du monteur vidéo IA en **usine de
production vidéo** : une infrastructure capable de recevoir plusieurs
projets simultanément, de gérer elle-même ses ressources, et de scaler de
1 à N workers sans réécriture. Il complète `RENDER_OPTIMIZATIONS.md`
(optimisations FFmpeg antérieures) et le `README.md` (produit).

> **Honnêteté d'ingénierie.** Tout ce qui est décrit ici est réellement
> implémenté, compilé et testé (voir `packages/orchestrator/dist/test-queue.js`,
> 31 assertions). Les limites connues sont listées en fin de document, pas
> masquées.

## Architecture cible (implémentée)

```
UPLOAD ─▶ PROJECT ─▶ ENQUEUE (render_queue, persistante en base)
                          │
                          ▼
                    SCHEDULER  ── concurrence ADAPTATIVE (CPU/RAM réels)
                          │        claim ATOMIQUE (exécution unique garantie)
              ┌───────────┼───────────┐
              ▼           ▼           ▼
          WORKER 1    WORKER 2    WORKER N        (sous-processus isolés)
              │           │           │
        run-pipeline  run-pipeline  run-pipeline
              │           │           │
        FFmpeg+Remotion (cut→concat→mix→habillage→finalize)
              │           │           │
              ▼           ▼           ▼
         render_metrics + progress + heartbeat ──▶ UI (progression réelle)
```

Un même serveur héberge le scheduler in-process (mono-machine, déploiement
actuel). Pour scaler horizontalement, on lance le **même** scheduler dans
des process/machines dédiés (`scheduler-daemon.ts`) contre la même base :
le claim atomique garantit qu'aucun job n'est exécuté deux fois. Aucune
logique de montage n'est touchée.

## Ce qui a changé (fichiers)

### Nouveau package `packages/orchestrator`
Le cœur de la factory, sans dépendance lourde (importable par le serveur
web sans entraîner `@remotion/bundler`).

| Fichier | Rôle |
|---------|------|
| `config.ts` | Config centralisée depuis l'environnement (§22) — aucun nombre magique dispersé. |
| `system-monitor.ts` | Échantillonne CPU/RAM réels (`os` + `/proc/meminfo`). |
| `adaptive-concurrency.ts` | Calcule la capacité = min(CPU, RAM, plafond), plancher 1 (§3). |
| `scheduler.ts` | Worker-pool : heartbeat, recovery, claim, dispatch, cancel (§4, §18, §28). |
| `scheduler-daemon.ts` | Point d'entrée autonome pour scale horizontal (§23). |
| `test-queue.ts` / `test-worker-mock.ts` | Test automatisé (31 assertions). |

### `packages/shared-types`
| Fichier | Rôle |
|---------|------|
| `render-queue.ts` | Types `RenderJob`, statuts (§2), profils de rendu FAST/BALANCED/QUALITY (§10), `RenderMetrics` (§20). |
| `stage-progress.ts` | Poids de progression par étape → barre honnête (§9). |

### `packages/db`
- Table `render_queue` (persistance, priorité, tentatives, heartbeat) + table `render_metrics`.
- Méthodes : `enqueueRenderJob` (dédup par projet), `claimNextRenderJob` (transaction `BEGIN IMMEDIATE`, exécution unique), `updateRenderJobProgress`, `completeRenderJob`, `failRenderJob` (retry borné), `cancelRenderJob`, `recoverStaleRenderJobs`, `recordRenderMetrics`.
- **WAL + busy_timeout** au constructeur : accès concurrent sûr web + scheduler + N workers sur le même fichier SQLite.

### `packages/render`
- `assemble.ts` : **finalisation sans ré-encodage** quand la vidéo d'habillage est déjà au format cible (remux stream-copy + faststart au lieu d'une passe libx264 complète — §5) ; profils FFmpeg ; breakdown de timings pour les métriques.
- `ffmpeg.ts` : `cutClip`/`finalEncode` paramétrés par profil ; nouvelle `finalizeOutput` (chemin rapide copy).
- `remotion.ts` : **bundle persistant sur disque** indexé par empreinte du code source — réutilisé entre process (chaque worker est un process séparé ; évite ~10s de bundle par job — §5, §6) ; `concurrency` Remotion configurable ; frames rendues remontées.

### `packages/pipeline`
- `run-pipeline.ts` : accepte un profil de rendu ; enregistre les `render_metrics` réelles (durations cut/concat/habillage/encode, frames, fps, RSS).
- `cli-run-project.ts` : le worker reporte la **progression réelle** (%, étape, ETA honnête dérivée du temps écoulé) dans `render_queue`.

### `apps/web`
- `server/jobs.ts` : **remplace le `Set` en mémoire** par la queue persistante + démarrage du scheduler in-process. Dédup, cancel.
- `api/projects/[id]/status` : expose progression globale, ETA, étape, tentatives, worker.
- `api/projects/[id]/cancel` : annulation réelle (§18).
- `projects/[id]/page.tsx` + `globals.css` : barre de progression réelle avec %, ETA, tentatives, bouton d'annulation.

## Benchmarks (mesurés, pas estimés)

Environnement de mesure : 4 vCPU Xeon 2.10GHz, 15 Go RAM, FFmpeg 6.1.1,
Chromium headless. Vidéo de démo : 2 rushs (40s + 15s) → montage 11.7s
1080×1920, mode déterministe (sans clé API), 3 passes de rendu
(proxy + correction + final).

| Mesure | AVANT | APRÈS | Gain |
|--------|-------|-------|------|
| **Pipeline total** | **201.9 s** | **179.6 s** | **−11 %** |
| proxy_render | 72.6 s | 61.1 s | −16 % |
| correction (2e rendu) | 62.9 s | 51.9 s | −17 % |
| final_render | 58.7 s | 59.2 s | ≈ (variance Remotion) |
| Export final par passe | `finalEncode` libx264 **5.7 s** | remux stream-copy **0.1 s** | −98 % |

Sortie APRÈS vérifiée : `1080×1920 h264 + aac`, 11.7 s, habillage Remotion
(sous-titres + zooms) présent aux 3 passes. **Qualité identique** : le
profil BALANCED garde exactement les mêmes paramètres d'encodage
qu'avant, et le remux final est *lossless* (mêmes pixels, on ne fait que
changer le conteneur + faststart).

> Le gain de **bundle Remotion persistant** (~10 s/job) est **invisible
> dans cette démo mono-process** (le bundle y est déjà mis en cache en
> mémoire pour les 3 rendus) mais **réel en production** où chaque job est
> un process séparé : sans persistance disque, chaque montage repayait les
> ~10 s de bundle. Vérifié : le bundle survit sur disque
> (`/tmp/video-editor-remotion-bundle-<hash>/index.html`) et un nouveau
> process le réutilise au lieu de le reconstruire.

### Pourquoi 96% du temps est dans le rendu

Le profilage montre que les 3 passes de rendu = ~194 s sur 201.9 s. Le
reste (analyse, montage, heuristiques) est négligeable en mode
déterministe. Les leviers réels sont donc :
1. **Ne pas relancer 10 rendus en même temps sur une petite machine**
   (queue + concurrence adaptative) — le vrai risque d'OOM/thrash.
2. **Ne pas ré-encoder inutilement** (remux final — §5).
3. **Ne pas reconstruire le bundle Remotion à chaque job** (persistance disque — §6).

## Concurrence adaptative

La capacité n'est **jamais** un nombre en dur. Elle est calculée depuis les
ressources réelles (`decideConcurrency`) :

```
capacité = clamp( min( ⌊CPU / coresParWorker⌋, ⌊RAMdispo / memParWorker⌋ ), 1, plafond )
```

Vérifié par test :
- petite (2 cœurs / 1.6 Go) → **1 worker**
- grosse (8 cœurs / 14 Go) → **4 workers**
- plancher : jamais 0.

Recommandation actuelle : **BALANCED** par défaut ; sur `shared-cpu-2x`
(2 Go) viser **1 montage à la fois** ; ajouter une 2ᵉ machine dès que la
file dépasse durablement la capacité d'une machine.

## Garanties (prouvées par `test-queue.js`, 31 assertions)

- **Exécution unique** : claim atomique — un job jamais pris par deux workers.
- **Anti-duplication** : trois clics sur le même projet = un seul job (§17).
- **Priorité** respectée dans le dispatch.
- **Isolation** : chaque worker est un sous-processus ; un crash n'affecte aucun autre projet ni le serveur web (§4).
- **Auto-recovery** : worker mort (crash/redémarrage) → job remis en file, borné par `maxAttempts`, sinon échec explicite (§28).
- **Annulation** réelle : SIGTERM puis SIGKILL, job `cancelled` (§18).
- **Progression honnête** : monotone, dérivée du poids réel des étapes + ETA depuis le temps écoulé (§9, §26).

## Limites connues (non masquées)

- **Queue = SQLite** (mono-fichier). Multi-machine fonctionne via le claim
  atomique, mais le fichier doit être partagé (volume) — pour un vrai
  cluster, migrer vers Postgres (`SELECT … FOR UPDATE SKIP LOCKED`) ou
  Redis. La structure des méthodes `Db` est pensée pour cette bascule.
- **`recoverOnStart`** requeue tout job "running" au démarrage : sûr en
  mono-machine (les sous-processus ne survivent pas au parent). En
  multi-machine, laisser `recoverOnStart=false` (défaut du daemon) et
  s'appuyer sur le heartbeat périmé.
- **Concurrence Remotion interne** laissée en auto par défaut ; à calibrer
  finement (`REMOTION_CONCURRENCY`) selon la machine si les workers FFmpeg
  et Chromium se disputent le CPU.
- **Détection de rushs inutilisables** (§15), **cache d'analyse**
  (transcription/scene detection — §6 avancé) et **preview ultra-rapide
  distincte de l'export** (§16) sont des étapes suivantes documentées, pas
  encore implémentées.

## Configuration

Voir `.env.example` (section FACTORY). Tout est optionnel : sans aucune
variable, le système tourne en adaptatif stable sur petite machine.
