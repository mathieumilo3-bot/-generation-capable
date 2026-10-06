# Tests

| Suite | Commande | Ce qu'elle prouve |
|---|---|---|
| SQL (Postgres 16 jetable, migrations réelles) | `npm run test:sql` | RLS A/B (lecture ET écriture : projet, rush, wallet, rendu, storage), ledger immuable et invariants (solde = Σ mouvements, réservé = holds ouverts), prix serveur, solde insuffisant (manque exact), hold/capture/release, double clic, retry, annulation, révision (v2/parent), topup, webhook ×4, paiement échoué, remboursement, auto-reload (anti double tentative), ajustement admin audité/idempotent, invitations commerciales, suppression de compte (données supprimées, compta anonymisée), rate limiting, privilèges |
| `packages/domain` | `npm test -w @app/domain` | argent/prix/états/erreurs humaines/liens profonds/capacités/matrice de paiement/mapping de révision |
| `packages/api` | `npm test -w @app/api` | client TUS contre un serveur qui coupe la connexion, reprend à l'offset, session expirée, jeton expiré ; gestionnaire d'envois (concurrence, hors ligne, annulation, redémarrage de l'app) |
| `packages/payments`, `analytics`, `video-engine`, `config`, `ui` | `npm test` | fournisseurs (finalisation après crédit serveur), sanitizer analytics, coûts moteur → catégories, contrastes AA des tokens |
| `supabase/functions` | `npm test -w @app/functions` | signature Stripe (rejeu, altération), plan d'événements, webhook idempotent + garde de montant, JWT Apple/Google, vérification d'achats store, e-mails, chiffrement ; `deno check` des 8 entrées |
| `services/orchestrator` | `npm test -w @app/orchestrator` | tous les scénarios job ⇄ moteur (faux) ⇄ Postgres réel : succès, échec, retry, crash+reprise, annulation, révision, parallélisme, push |
| `apps/client`, `apps/admin` | `npm test` | logique pure des écrans (≈ 200 tests) |
| **E2E réel** | `npm run e2e -w @app/orchestrator` | Postgres + orchestrateur + passerelle + **vrai moteur** : MP4 1080×1920 h264 avec audio livré, encaissement exact, révision v2 liée à v1 |
| Garde-fous | `npm run lint` | aucun secret serveur côté client, aucun terme technique visible, aucun prix codé en dur, aucun `parseFloat`, aucun `.env` suivi |

Correspondance avec la liste demandée : création de compte e-mail / Google / Apple, login/logout, session persistante, upload réel côté app, création de projet → **couverts par la logique testée + à rejouer sur appareil/compte réels** (voir README « non vérifiable ici ») ; tous les scénarios financiers, RLS, worker, rendu réussi/échoué, nouvelle version, topup, paiement échoué, ajustement admin, suppression de compte → **automatisés**.
