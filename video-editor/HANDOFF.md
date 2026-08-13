# HANDOFF — Monteur vidéo IA (passation pour reprise / ChatGPT)

Ce document résume **tout ce qui a été construit dans cette session** sur le
monteur vidéo IA, avec un **état honnête** de chaque pièce (vivant et testé
vs. présent mais pas encore branché). Il est fait pour qu'un autre
assistant (ou toi) puisse reprendre sans rien redécouvrir.

> Branche de travail : `claude/ai-video-editor-saas-zx4t2m`
> Monorepo : `video-editor/` (pnpm + turbo + TypeScript strict)

---

## 1. Les 3 chantiers de la session

| # | Chantier | État |
|---|----------|------|
| A | **Cerveau créatif** (CreativePlan, Critic, Learning) | ⚠️ **Compilé mais PAS câblé** au pipeline — c'est "l'âme" qui manque encore |
| B | **Usine de production** (queue, concurrence adaptative, workers, recovery, métriques, progression) | ✅ **Vivant + testé** (31 assertions) |
| C | **Réalisme du montage** (rejet plans sombres, ordre cohérent, garde-fous anti-défauts) | ✅ **Vivant + testé** (11 assertions) |

---

## 2. État honnête, pièce par pièce

### ✅ VIVANT et TESTÉ (tourne dans le pipeline réel aujourd'hui)

- **Usine / Render Queue** (`packages/orchestrator`, `packages/db`) : file
  persistante, claim atomique (exécution unique), concurrence adaptative
  CPU/RAM, workers isolés (sous-processus), reprise après crash, annulation,
  métriques. Test : `pnpm --filter @video-editor/orchestrator test` (31 ✓).
- **Optimisations de rendu** (`packages/render`) : remux final sans
  ré-encodage (−98 % sur la passe finale, lossless), bundle Remotion
  persistant entre process, profils FAST/BALANCED/QUALITY.
- **Qualité de montage** (`packages/agents`, `packages/render`) :
  - luminosité RÉELLE mesurée (ffmpeg `signalstats`) → plans sous-exposés
    écartés ;
  - ordre cohérent (chaque rush contigu, plus de saut jour↔nuit) ;
  - garde-fous : rejet du "vide en fin" (audio < vidéo) et de l'orientation
    paysage quand on vise vertical.
  Test : `pnpm --filter @video-editor/pipeline test` (11 ✓).
- **Progression réelle** : %, étape, ETA honnête (dérivée du temps écoulé),
  remontés en base et affichés par l'UI (barre + bouton annuler).

### ⚠️ PRÉSENT mais PAS ENCORE BRANCHÉ (le "cerveau sans âme")

- `packages/agents/src/creative-brain.ts` — produit un `CreativePlan`
  (intention, hooks multiples, arc narratif, pacing, courbe émotionnelle,
  cibles qualité). **Heuristique** (`isStub: true`), **jamais appelé** par
  `runPipeline`.
- `packages/agents/src/creative-critic.ts` — évalue un montage sur 9
  dimensions, décide s'il faut itérer. **Jamais appelé.**
- `packages/agents/src/creative-learning-engine.ts` — apprend les
  préférences de l'utilisateur (feedback progressif). **Jamais appelé.**
- Types associés : `packages/shared-types/src/creative-plan.ts`,
  `creative-criticism.ts`, `creative-learning.ts`.

> C'est précisément ce qui donne l'impression que "le cerveau n'a pas de
> sentiment" : il existe, il compile, il est exporté — mais il ne PILOTE
> encore aucune décision de montage. Voir §6 pour lui donner une âme.

### ❗ Limites assumées (pas des oublis)

- **Sous-titres parlés** = besoin d'une clé STT (`DEEPGRAM_API_KEY`). Sans
  clé, le chemin déterministe **n'invente pas** de sous-titres.
- **Sélection éditoriale fine** = bien meilleure avec `ANTHROPIC_API_KEY`
  (Story Director LLM). Sans clé, heuristiques (déjà nettement améliorées).
- **B-roll** résolu en métadonnées, pas encore splicé dans le rendu.
- **Queue = SQLite** (mono-fichier) ; multi-machine OK via volume partagé,
  migration Postgres/Redis préparée dans l'interface `Db`.

---

## 3. Cartographie des fichiers (créés / modifiés cette session)

```
packages/shared-types/src/
  creative-plan.ts        [NOUVEAU] contrat du CreativePlan
  creative-criticism.ts   [NOUVEAU] rapport du Critic (9 dimensions)
  creative-learning.ts    [NOUVEAU] profil de préférences / feedback
  render-queue.ts         [NOUVEAU] RenderJob, statuts, profils, métriques
  stage-progress.ts       [NOUVEAU] poids de progression par étape

packages/orchestrator/    [NOUVEAU PACKAGE] — l'usine
  src/config.ts               config centralisée (env, zéro nombre magique)
  src/system-monitor.ts       échantillonnage CPU/RAM réel
  src/adaptive-concurrency.ts capacité = min(CPU, RAM, plafond)
  src/scheduler.ts            worker-pool : claim, dispatch, heartbeat, cancel
  src/scheduler-daemon.ts     entrée autonome (scale horizontal)
  src/test-queue.ts           test (31 assertions)

packages/db/src/
  schema.sql              [MODIFIÉ] tables render_queue + render_metrics
  client.ts               [MODIFIÉ] enqueue/claim/fail/cancel/recover + WAL

packages/render/src/
  ffmpeg.ts               [MODIFIÉ] measureBrightness, finalizeOutput (remux),
                                    validateFinalRender (anti-vide + orientation)
  assemble.ts             [MODIFIÉ] profils, remux, timings, gates
  remotion.ts             [MODIFIÉ] bundle persistant, concurrency, frames

packages/agents/src/
  creative-brain.ts       [NOUVEAU] ⚠️ pas câblé
  creative-critic.ts      [NOUVEAU] ⚠️ pas câblé
  creative-learning-engine.ts [NOUVEAU] ⚠️ pas câblé
  video-analyzer.ts       [MODIFIÉ] qualité visuelle = résolution × luminosité
  story-director.ts       [MODIFIÉ] rejet plans sombres + ordre cohérent

packages/pipeline/src/
  run-pipeline.ts         [MODIFIÉ] profil de rendu + métriques
  cli-run-project.ts      [MODIFIÉ] worker reporte progression réelle
  test-montage-quality.ts [NOUVEAU] test qualité (11 assertions)

apps/web/src/
  server/jobs.ts          [MODIFIÉ] queue + scheduler (remplace le Set mémoire)
  server/db.ts            [MODIFIÉ] expose getDbPath()
  app/api/projects/[id]/status/route.ts  [MODIFIÉ] progression/ETA/worker
  app/api/projects/[id]/cancel/route.ts  [NOUVEAU] annulation
  app/projects/[id]/page.tsx + globals.css [MODIFIÉ] barre de progression réelle

Docs : FACTORY.md (usine), RENDER_OPTIMIZATIONS.md (ffmpeg), ce HANDOFF.md.
```

---

## 4. Build / lancer / tester

```bash
cd video-editor
pnpm install
pnpm build                 # 9 packages, doit finir "9 successful"

# Tests automatisés
pnpm --filter @video-editor/orchestrator test   # queue/scheduler : 31 ✓
pnpm --filter @video-editor/pipeline test        # qualité montage : 11 ✓

# Démo bout-en-bout (génère ses propres rushs via ffmpeg, aucun fichier requis)
pnpm --filter @video-editor/pipeline run demo

# Interface web
pnpm --filter @video-editor/web dev   # http://localhost:3000
```

Sans clé API, tout tourne en mode déterministe honnête. Avec
`ANTHROPIC_API_KEY` / `DEEPGRAM_API_KEY` / `GOOGLE_API_KEY`, les agents
basculent sur leur chemin réel sans changement de code.

---

## 5. Architecture de l'usine (rappel)

```
UPLOAD → ENQUEUE (render_queue) → SCHEDULER (concurrence adaptative, claim atomique)
                                      ├─▶ WORKER 1 (sous-process isolé) → run-pipeline → FFmpeg+Remotion
                                      ├─▶ WORKER 2 …
                                      └─▶ WORKER N …
                                            └─ progress + heartbeat + metrics → UI
```

Voir `FACTORY.md` pour le détail (garanties, benchmarks, scaling).

---

## 6. Donner une âme au cerveau (prochaine grande étape)

Le `CreativeBrain` existe mais ne décide rien. Pour qu'il pilote réellement
le montage (ce qui manque = "le sentiment") :

1. **Câbler `runCreativeBrain` dans `run-pipeline.ts`** : l'appeler juste
   après `brief_analysis` pour produire un `CreativePlan`, et faire
   consommer ce plan par le Story Director / Editor / Caption / Sound au
   lieu de leurs heuristiques isolées (pacing, hook, courbe émotionnelle,
   cibles qualité viennent alors d'UNE stratégie unifiée).
2. **Brancher le vrai LLM** dans `creative-brain.ts` (aujourd'hui
   `isStub: true`) pour l'intention, le choix de hook, l'arc narratif —
   avec repli heuristique conservé si pas de clé.
3. **Boucle Critic** : après le rendu proxy, appeler `runCreativeCritic`,
   et si `shouldIterate`, appliquer une correction ciblée puis re-rendre
   (max 3 itérations). Le squelette de correction existe déjà
   (`apply-correction.ts`).
4. **Learning** : enregistrer les commandes conversationnelles de
   l'utilisateur comme `FeedbackSignal` dans `CreativeLearningEngine` pour
   adapter les préférences au fil du temps.
5. **Sous-titres** : propager les timestamps mot-à-mot du STT jusqu'au
   Caption Director (le `Segment` ne garde aujourd'hui que le transcript
   agrégé) pour des sous-titres karaoké synchronisés.

Chacune de ces étapes est additive et n'exige pas de casser l'existant.

---

## 7. Ce qui a été prouvé (mesuré, pas affirmé)

- Usine : queue persistante, exécution unique, priorité, recovery après
  crash, annulation, concurrence adaptative (petite machine → 1 worker,
  grosse → 4). 31 assertions.
- Rendu : 201.9s → 179.6s (−11 %) sur la démo ; passe finale 5.7s → 0.1s
  (remux lossless). Sortie vérifiée 1080×1920 h264+aac.
- Montage : plan de nuit YAVG=26 → qualité 0.14 (écarté) vs jour YAVG=126 →
  0.70 (retenu) ; 0 plan sombre sélectionné ; ordre cohérent ; garde-fous
  anti-vide et anti-paysage bloquent les mauvais rendus. 11 assertions.
```
