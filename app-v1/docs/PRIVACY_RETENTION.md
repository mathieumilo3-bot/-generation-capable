# Données personnelles, conservation, suppression

## Inventaire
| Donnée | Table / stockage | Finalité | Supprimée à la suppression du compte ? |
|---|---|---|---|
| E-mail, nom, entreprise, facturation, version d'app, plateforme | `profiles` | compte, support | **Oui** (cascade) |
| Rushs, références, voix, vidéos produites, miniatures | Storage `raw/processed/renders/thumbnails/temporary` + `assets`, `project_versions` | service | **Oui** (purge `{uid}/` de chaque bucket) |
| Projets, jobs, versions, notifications, jetons push, tokens Apple chiffrés | tables dédiées | service | **Oui** (cascade) ; jeton Apple **révoqué** |
| Paiements, lignes du ledger | `payments`, `wallet_transactions` | **obligation comptable** | **Non — anonymisés** (`user_id` mis à NULL) et conservés ; durée légale à confirmer par le comptable |
| Coûts et marge par job | `usage_costs` | comptabilité analytique | Non — anonymisés (lien job conservé sans identité) |
| Journal d'audit | `audit_logs` | sécurité / preuve des actions admin | Conservé (sans donnée de contenu) |
| Demande de suppression | `account_deletion_requests` | preuve (e-mail haché) | Conservé |

## Suppression de compte (flow)
1. Écran *Compte → Confidentialité → Supprimer mon compte* (explication → confirmation en tapant SUPPRIMER → code e-mail récent).
2. `delete-account` : exige une authentification < 10 min ; annule et **libère** les jobs actifs ; refuse si propriétaire d'équipe avec d'autres membres ; révoque le jeton Apple ; purge les buckets ; supprime l'utilisateur Auth (cascade) ; envoie un e-mail de confirmation.
3. Idempotent : en cas d'échec partiel l'utilisateur peut relancer.
4. Page publique : `web-public/supprimer-mon-compte.html` (URL exigée par Google Play).
Testé : `30_admin_payments.test.sql` (profil/projets supprimés, ledger conservé anonymisé, invariants comptables intacts).

## Rétention configurable
`app_settings.retention.raw_days` / `retention.renders_days` valent `null` (conservation illimitée) : **durée à décider par le business**. Aucune purge automatique n'est active tant qu'une valeur n'est pas fixée ; l'implémentation de la purge planifiée doit être ajoutée au moment de cette décision (la fonction `svc_assets_to_purge` / `svc_asset_purged` gère déjà la purge Storage des assets marqués supprimés).

## Déclarations stores (entrées)
- **App Store — App Privacy** : e-mail et nom (lié à l'identité, fonctionnalités de l'app), contenu utilisateur (vidéos/audio, lié à l'identité), identifiants d'achat, données d'usage non liées. Pas de pistage publicitaire.
- **Google Play — Data safety** : mêmes catégories ; données chiffrées en transit ; suppression demandable in-app et via URL web.
- Manifeste de confidentialité iOS : déclaré dans `app.config.ts` (`privacyManifests`).
