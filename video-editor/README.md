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

Activer les vraies réponses des modèles : copier des clés dans
l'environnement avant de lancer (`ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` ou
`GEMINI_API_KEY`, `DEEPGRAM_API_KEY`). Sans clé, tout tourne quand même —
en mode dégradé honnête, annoncé comme tel dans les logs et les warnings
retournés par le pipeline.

## Structure

```
apps/
  web/                    # Next.js — upload, progression réelle, résultat, édition conversationnelle
packages/
  shared-types/            # Contrats de données + schémas zod (validation stricte, anti-hallucination)
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
