# Sécurité — garanties réelles et vérifiées

| Garantie | Mécanisme | Vérifié par |
|---|---|---|
| Un utilisateur ne lit/écrit jamais les rushs, projets, wallet, rendus d'un autre | RLS sur toutes les tables, policies Storage par chemin `{user}/{project}/…`, RPC bornées à `auth.uid()` | `supabase/tests/20_rls.test.sql` (≈ 45 assertions A/B, anonyme, staff lecture seule) |
| Le solde ne se modifie que par transaction | pas de `GRANT UPDATE` sur `wallets`; ledger immuable (trigger), même pour `service_role` | `10_billing`, `30_admin_payments` |
| Pas de double facturation | idempotence à chaque couche (voir ARCHITECTURE) | `10_billing`, `shared.test.ts` (webhook ×4), `orchestrator.test.ts` |
| Le client ne peut pas se créditer | crédit = webhook Stripe signé / reçu Apple-Google vérifié serveur ; RPC `svc_*` réservées à `service_role` | `20_rls`, `shared.test.ts` |
| Montant encaissé ≠ attendu ⇒ pas de crédit | contrôle dans `webhook-handler.ts` | `shared.test.ts` |
| Reçu de store lié à l'utilisateur, non rejouable sur un autre compte | `appAccountToken` / `obfuscatedExternalAccountId`, `purchase_already_used` | `shared.test.ts` |
| Aucun secret côté client | seules clés publishable ; `service_role`/secret uniquement serveur ; `lint` (scripts/guard.mjs) interdit leur présence dans les bundles | CI |
| Rôles hors métadonnées modifiables | `staff_roles` (écriture service_role), `organization_members` ; jamais `user_metadata` | `20_rls` (auto-promotion refusée) |
| Passerelle moteur fermée | jeton comparé à temps constant, fermée sans configuration, allowlist anti-SSRF, noms de fichiers assainis | E2E (`npm run e2e -w @app/orchestrator`) |
| Rate limiting | `private.check_rate_limit` dans les RPC sensibles et Edge Functions ; Auth : limites Supabase | `20_rls` |
| Fichiers privés | aucun bucket public ; URLs signées courtes ; envoi limité aux chemins pré-enregistrés par le serveur | `20_rls` |
| Session | Keychain/Keystore (découpage), PKCE, refresh rotatif | revue |

**Ce que nous NE prétendons PAS** : chiffrement de bout en bout, anonymat vis-à-vis des sous-traitants (Supabase, Stripe, services IA si activés).
Points d'attention à auditer avant ouverture : politique de mots de passe n/a (OTP), CAPTCHA sur l'envoi de codes, restrictions réseau de la base, rotation des secrets, revue des permissions du compte de service Google.
