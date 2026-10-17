# Agent autonome Superteam Earn — Génération Capable

Système qui trouve, réalise et soumet des missions rémunérées sur
[Superteam Earn](https://superteam.fun/earn) via l'**API officielle des agents**
([skill.md](https://superteam.fun/skill.md)), sans intervention humaine — sauf la
réclamation des gains, qui exige par conception un humain connecté.

➡️ **Tableau de bord en direct : [STATUS.md](STATUS.md)** (gains, soumissions en
attente, missions en cours, annonces analysées, derniers cycles).

## Fonctionnement

```
 pg_cron (toutes les 30 min)
        │
        ▼
 ┌─────────────────────────────┐   API officielle    ┌──────────────────┐
 │ Supabase Edge Function      │ ──────────────────▶ │ superteam.fun    │
 │ earn-agent  (le « hub »)    │ ◀────────────────── │ /api/agents/...  │
 │ • enregistrement (1 fois)   │                     └──────────────────┘
 │ • découverte + scoring      │
 │ • file de ≤ 5 missions      │   lit les livrables (commit épinglé)
 │ • contrôle qualité final    │ ◀──────────────────┐
 │ • soumission + registre     │                    │
 └──────────────┬──────────────┘                    │
                │ /queue, /status (publics, sans secret)
                ▼                                   │
 ┌─────────────────────────────┐  push   ┌──────────┴────────────────┐
 │ GitHub Actions earn-sync    │ ◀────── │ Worker IA (Claude, tâche  │
 │ écrit state/ et STATUS.md   │ ──────▶ │ planifiée) : réalise ≤ 5  │
 └─────────────────────────────┘  pull   │ missions en parallèle,    │
                                         │ relecture indépendante,   │
                                         │ pousse deliverables/      │
                                         └───────────────────────────┘
```

1. **Enregistrement** — `POST /api/agents` une seule fois ; la clé API et le code
   de réclamation sont stockés dans **Supabase Vault** (jamais dans le dépôt).
2. **Découverte** — toutes les 30 min, `GET /api/agents/listings/live` (pagination
   complète) puis `GET /api/agents/listings/details/:slug` pour chaque annonce.
3. **Analyse** — pour chaque annonce : catégorie (rédaction, traduction, contenu,
   recherche, code, données… prioritaires), valeur en USD (USDC = 1, autres jetons
   via Jupiter/CoinGecko), nombre de places gagnantes, concurrence projetée,
   fiabilité de paiement du sponsor, temps estimé, délai restant.
4. **Sélection** — score = gain espéré ÷ heures estimées. Exclusion automatique de
   tout ce qui ne peut pas être fait honnêtement par une IA : hackathons, missions
   « project » (freelance continu), publication sur X ou réseau social, vidéo,
   présence physique, audience requise, transactions on-chain ou dépenses,
   utilisation d'une application en direct, design graphique, rôle communautaire,
   question d'éligibilité exigeant un compte personnel, annonce régionale hors
   France, échéance < 4 h, jeton sans prix fiable.
5. **Réalisation** — jusqu'à **5 missions en parallèle** par le worker IA
   (`worker/WORKER.md`) : une IA productrice par mission, puis une IA relectrice
   indépendante qui note (≥ 8/10 exigé) et vérifie chaque exigence, l'exactitude
   des faits, l'originalité et l'absence de preuves inventées.
6. **Contrôle qualité** — `worker/qa_check.py` côté worker, puis le hub refait
   toutes les vérifications non négociables : annonce encore ouverte et ouverte
   aux agents, réponses à toutes les questions obligatoires, aucun lien que nous
   ne contrôlons pas, aucun espace réservé ni secret, mention claire que le travail
   est produit par une IA.
7. **Soumission** — `POST /api/agents/submissions/create` avec le lien GitHub du
   livrable **épinglé au commit** (impossible à modifier après la date limite).
8. **Registre** — chaque soumission est enregistrée (récompense max, espérance) ;
   le hub suit l'annonce des gagnants et calcule les gains (position, montant, USD).
9. **Planification** — pg_cron toutes les 30 min (hub) ; worker IA planifié.
10. **Garde-fous** — 5 missions actives max, 8 soumissions / 24 h max, aucune
    dépense, aucun compte créé, respect des limites de l'API (60 soumissions/h).

## Worker IA

Session Claude Code persistante `session_01VgpZyXif2bxw9MR17jkPfG` (dépôt en
source, donc droit de push), réveillée **toutes les heures** par la tâche
planifiée `trig_01F4NHsjgeBrod3K8siWp3YG`. Quand la file est vide, elle s'arrête
après la synchronisation. Le travail de l'IA est décompté du forfait Claude du
compte (aucune clé API payante n'est utilisée).

## Test de bout en bout (17/10/2026)

Mission interne `selftest-earn-agent-api-guide` (jamais soumise) : le worker
planifié a produit [ce guide](deliverables/selftest-earn-agent-api-guide/README.md)
(1 490 mots, chaque endpoint et limite vérifiés contre `skill.md`), le relecteur
indépendant l'a noté 8/10 et corrigé, `qa_check.py` OK, push → workflow → le hub a
re-validé et construit la charge utile officielle (lien épinglé au commit
`c27d27a`) → statut `approved` sans envoi. Elle reste visible dans le tableau de
bord, marquée « test interne ».

## Réclamer les gains (seule action humaine)

Superteam Earn ne verse rien à un agent : un humain doit **réclamer** l'agent.
1. Ouvrir le lien de réclamation (code fourni en privé ; il est aussi dans Supabase
   Vault : `select decrypted_secret from vault.decrypted_secrets where name = 'earn_agent_claim_code';`)
   → `https://superteam.fun/earn/claim/<code>`
2. Se connecter, compléter son profil talent, confirmer. Les paiements (et un
   éventuel KYC demandé par le sponsor) se font ensuite sur ce compte humain.

## Réglages

Table `earn_agent.config`, clé `settings` (JSON fusionné avec les valeurs par
défaut de `lib/types.ts`) — par exemple pour suspendre les soumissions :

```sql
insert into earn_agent.config (key, value) values ('settings', '{"autoSubmit": false}')
on conflict (key) do update set value = earn_agent.config.value || excluded.value;
```

`maxActiveJobs` (5), `dailySubmissionCap` (15), `minScore` (0,5 $/h espéré),
`minHoursLeft` (4), `minQaScore` (8), `allowedRegions` (["France"]),
`relaxedBlockers` (["hackathon_track"] — règles bloquantes laissées au jugement du worker),
`telegramUrl` (null — requis par Earn pour les missions « project », non prises).

Arrêt complet : `select cron.unschedule('earn-agent-tick');` et désactiver la tâche
planifiée « Superteam Earn — worker IA (toutes les heures) » dans Claude.

## Contenu de la branche

| Chemin | Rôle |
|---|---|
| `supabase/functions/earn-agent/` | Hub (Deno/TypeScript) déployé sur Supabase |
| `supabase/migrations/` | Schéma `earn_agent`, Vault, pg_cron |
| `tests/` | Tests (`node --test tests/*.test.ts`) avec faux serveur Earn et faux GitHub |
| `worker/WORKER.md` | Consignes permanentes du worker IA |
| `worker/sync.py`, `worker/qa_check.py` | Synchronisation et contrôle qualité local |
| `.github/workflows/earn-sync.yml` | Passerelle hub ⇄ branche |
| `state/` | File de travail et statut générés par le hub (ne pas éditer) |
| `deliverables/<slug>/` | Livrables réels soumis aux sponsors |
