# Puissance de rendu — performance-16x + concurrence Remotion adaptative

Objectif : exploiter au maximum la puissance CPU pour rendre le plus de
frames Remotion possible EN PARALLÈLE, avec progression réelle et sans OOM.

## Ce qui a changé

1. **Machine Fly.io** (`fly.toml`) : `shared-cpu-2x/2gb` → **`performance-16x/32gb`**
   (16 vCPU performance dédiés, aucun CPU partagé). `auto_stop_machines`
   reste `false` (un rendu ne doit jamais être tué à mi-parcours).

2. **Concurrence Remotion adaptative au runtime**
   (`packages/render/src/remotion.ts` → `resolveRenderConcurrency`) :
   ```
   concurrency = max(1, min(nbCPU, 16))   // formule cible
   bornée en plus par la RAM : availableMem / ~1.4 Go par worker Chromium
   ```
   - Sur **performance-16x (16 vCPU / 32 Go)** → **16** (RAM permet ~22, plafonné à 16).
   - Sur cette machine de test (4 vCPU) → 4.
   - Override manuel possible : `REMOTION_CONCURRENCY` ou le profil de rendu.
   - Valeur réellement passée à `renderMedia({ concurrency })` → les CPU
     sont réellement utilisés (voir benchmark), jamais un réglage cosmétique.

3. **Progression frame-réelle + heartbeat** : `renderMedia.onProgress`
   remonte les frames réellement rendues jusqu'à `render_queue`. L'UI
   affiche `Export final — 88% (1188/1350 frames, 16 en parallèle)` qui
   avance vraiment, avec un heartbeat à chaque mise à jour (le rendu long
   n'est jamais pris pour "bloqué"). Aucune progression simulée.

4. **Garde RAM** : si 16 workers ne tiennent pas en mémoire, la concurrence
   descend automatiquement — stabilité prioritaire, jamais d'OOM killer.

## Benchmark (mesuré, pas simulé)

Même composition dans les deux cas : **1080×1920, 45 s @ 30 fps = 1350
frames, 22 sous-titres, 6 zooms, mêmes zooms/sous-titres/résolution**.
CPU échantillonné via `/proc/stat`, RAM via `/proc/meminfo`.
Reproductible : `pnpm --filter @video-editor/render bench`.

> ⚠️ Mesuré sur la machine de développement **4 vCPU / 16 Go** (je n'ai pas
> accès à performance-16x depuis cet environnement). Le benchmark compare
> **concurrence=1** (le comportement sous-exploité, proche de shared-cpu)
> à **concurrence=auto** (parallélisme réel) pour prouver le MÉCANISME.
> Sur performance-16x, la même logique applique 16 workers.

| Scénario | Concur. | Durée | FPS moyen | CPU moyen | CPU pic | RAM pic |
|----------|--------:|------:|----------:|----------:|--------:|--------:|
| Séquentiel | 1 | **301.4 s** | 4.5 | 39 % | 90 % | 9.4 Go |
| Parallèle (auto) | 4 | **132.1 s** | 10.2 | **90 %** | 98 % | 7.6 Go |

**Gain : ×2.28 plus rapide · +51 points de CPU réellement utilisés · aucun OOM.**

Ce que ça prouve (tous les points demandés) :
- ✅ le CPU **augmente réellement** pendant le rendu (39 % → 90 %) ;
- ✅ **plusieurs frames en parallèle** (4 workers Chromium ici, 16 sur perf-16x) ;
- ✅ Chromium exploite bien les workers (concurrence appliquée = 4) ;
- ✅ **aucun throttling** visible, RAM stable (pic 7.6 Go < 9.4 Go du séquentiel) ;
- ✅ **aucun OOM** ;
- ✅ progression **basée sur les frames réelles** (129 → 1209 / 1350).

Le speedup ×2.28 sur 4 cœurs (et non ×4) est honnête : il reste des coûts
fixes non parallélisables (démarrage Chromium, décodage de la source,
encodage h264 final). Sur 16 cœurs le gain sera plus élevé mais sublinéaire.

## Estimation performance-16x (à confirmer après déploiement)

Extrapolation **prudente, non mesurée** : le passage de 4 → 16 workers
accélère surtout la phase de rendu des frames (la plus lourde). Attendu :
rendu de cette compo 45 s de l'ordre de **~60–80 s** sur performance-16x
(vs 132 s à 4 workers), à confirmer par `pnpm --filter @video-editor/render
bench` exécuté SUR la machine déployée — je ne donne pas de chiffre inventé
pour un matériel que je n'ai pas exécuté.

## Vérifier sur la vraie machine après `fly deploy`

```bash
# sur la machine performance-16x
pnpm --filter @video-editor/render bench 45
# doit afficher "concurrence AUTO … retenu 16" et un CPU moyen élevé
```
