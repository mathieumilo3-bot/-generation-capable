# Exploitation

## Retrouver un problème client
1. Back-office → Clients → fiche (ledger, paiements, jobs, erreurs) ; ou Jobs → filtrer `failed`.
2. Détail d'un job : `correlation_id`, timeline `job_events` (source app/billing/orchestrator/engine/admin), coûts, transactions liées.
3. Paiements : `payments` + `webhook_events` (statut, tentatives, erreur).
4. Actions sûres : relancer un job `failed` (nouveau HOLD, jamais de double encaissement), rembourser un job (ligne `refund` + audit), ajuster un solde (ligne `manual_adjustment` + motif obligatoire).

## Journaux
JSON structurés (Edge Functions, orchestrateur). Chaque ligne porte `job`/`user`/`event`. Activer les *Log Drains* Supabase et l'agrégation des logs de l'orchestrateur/moteur.

## Sauvegardes / reprise
Sauvegardes Postgres Supabase (PITR conseillé en production). Le ledger est append-only : une restauration partielle doit rejouer les invariants (`test.check_ledger_invariants` sert de modèle de requête de contrôle).

## Alertes conseillées
Jobs `failed` > seuil/heure ; webhooks `failed` ; `svc_requeue_stale_jobs` > 0 répété ; solde moteur/clés IA ; marge négative sur un job (`usage_costs.gross_margin_cents < 0`).

## Limites connues (voir README)
Upload en arrière-plan OS non implémenté (la reprise TUS est fiable au retour au premier plan) ; dictée vocale = note vocale jointe (pas de transcription serveur) ; création autonome indisponible (moteur) ; B-roll non inséré dans le rendu (moteur).
