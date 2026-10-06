# App vidéo IA — V1 (iOS · Android · Web) au-dessus du moteur existant

« J'envoie → je choisis → ça monte → je récupère. » Une couche client complète (auth, wallet en euros, création, suivi, résultat, révisions, compte, back-office) construite **au-dessus** du moteur `video-editor/`, qui n'a **pas** été reconstruit.

- Architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · audit de l'existant : [`docs/AUDIT.md`](docs/AUDIT.md)
- **À renseigner avant production : [`SETUP_REQUIRED.md`](SETUP_REQUIRED.md)** (variables, où les trouver, décisions business)
- Sécurité : [`docs/SECURITY.md`](docs/SECURITY.md) · données/suppression : [`docs/PRIVACY_RETENTION.md`](docs/PRIVACY_RETENTION.md)
- **Soumission iOS : [`docs/IOS_SUBMISSION.md`](docs/IOS_SUBMISSION.md)** (`npm run release:check`) · Stores : [`docs/STORE_READINESS.md`](docs/STORE_READINESS.md), [`docs/STORE_PAYMENT_POLICY.md`](docs/STORE_PAYMENT_POLICY.md) · exploitation : [`docs/OPERATIONS.md`](docs/OPERATIONS.md) · tests : [`docs/TESTING.md`](docs/TESTING.md)

## Démarrage local

```bash
cd app-v1 && npm install

# 1. Base : Postgres 16 jetable + migrations + 180+ assertions SQL (RLS A/B, ledger, idempotence…)
npm run test:sql

# 2. Tout le TypeScript : typecheck, garde-fous, tests (≈ 340 tests)
npm run typecheck && npm run lint && npm test

# 3. Client (copier apps/client/.env.example en .env avec votre projet Supabase de DEV)
npm run client        # Expo (i : iOS, a : Android, w : web)   |   npm run client:web
# 4. Back-office (apps/admin/.env.example)
npm run admin
# 5. Orchestrateur (services/orchestrator/.env.example) — à côté du moteur
npm run orchestrator
# 6. E2E RÉEL (Postgres + orchestrateur + passerelle + moteur FFmpeg/Remotion, rend une vraie vidéo, puis une révision)
npm run e2e -w @app/orchestrator
```

## Ce qui est livré

| Brique | Contenu |
|---|---|
| `supabase/migrations` | 35 tables + RLS, ledger append-only, holds, pricing_rules, editing_methods data-driven, engine_capabilities, orgs/agences, invitations commerciales, audit, RPC atomiques/idempotentes (`submit_video_job`, `submit_revision`, `svc_job_*`, `svc_payment_*`, `admin_*`), buckets privés + policies, Realtime, privilèges en liste blanche |
| `supabase/functions` | `stripe-webhook`, `create-topup-checkout`, `create-card-setup`, `auto-reload-run`, `verify-store-purchase` (Apple/Google), `delete-account`, `apple-link`, `send-invitation-email` (typecheck `deno check`) |
| `services/orchestrator` | claim par bail, suivi du moteur, livraison au Storage privé, coûts réels → marge, retry/backoff, reprise après crash, annulation, push Expo, e-mails transactionnels, auto-reload |
| `video-editor/apps/web/.../engine-gateway` | passerelle `/api/engine/v1` (jeton serveur, anti-SSRF, idempotente) devant le moteur existant ; corrige au passage le filtre `vignette` invalide qui annulait l'habillage |
| `apps/client` | Expo Router universel : bienvenue, auth Apple/Google/OTP, accueil, flow Créer (upload TUS reprenable, durée/prix serveur, style, récapitulatif), suivi temps réel, résultat/téléchargement/partage, modification (nouvelle version), projets, wallet/recharge/auto-recharge/historique, facturation, aide, confidentialité, suppression de compte, notifications |
| `apps/admin` | Dashboard CA/marge/coûts, clients, fiche client, jobs (relance sûre), ventes directes + invitations, tarifs & réglages, paiements/webhooks, audit, support |
| `packages/*` | `domain` (argent en centimes, prix, états de job, erreurs humaines, liens profonds…), `api` (services Supabase + client TUS + gestionnaire d'envois), `payments` (PaymentProvider Stripe/Apple/Google), `video-engine` (contrat + faux moteur), `analytics` (20 événements, sanitizer), `ui` (tokens Apple-like, composants) |
| CI/CD | `.github/workflows/app-v1-*.yml` (tests, SQL, deno, builds web, moteur, scan de secrets ; EAS et déploiement backend manuels), `apps/client/eas.json` (development/staging/production) |

## Ce qui est vérifié, et ce qui ne l'est pas

**Vérifié automatiquement** : schéma et RLS sur un vrai Postgres 16 ; flux d'argent complet (topup, hold, capture, release, retry, annulation, révision, remboursement, suppression de compte) ; cloisonnement A/B ; webhooks ×4 = 1 crédit ; client TUS contre un serveur de reprise avec coupures réseau ; orchestrateur contre le schéma réel ; **E2E avec le vrai moteur** (MP4 1080×1920 h264 livré, facturé 2,42 €, version 2 facturée 1,21 €) ; rendu navigateur du client et de l'admin avec un backend simulé (double clic = une seule soumission).

**Non vérifiable ici — à tester sur de vrais comptes/appareils avant publication** :
- Connexions Apple/Google réelles, achats in-app (StoreKit / Play Billing, `expo-iap` jamais exécuté), notifications push, haptique, lecture/téléchargement natifs, dictée vocale.
- Stripe réel (Checkout, webhook signé en conditions réelles, 3-D Secure) : le code suit la documentation mais n'a pas été exécuté contre Stripe.
- Edge Functions déployées (seul `deno check` + tests des modules purs).
- Performance mesurée sur appareil (listes virtualisées, pagination et miniatures en lot sont en place).

## Limites assumées (documentées, pas des oublis)

1. **Création autonome indisponible** : le moteur n'a pas de génération vidéo (`autonomous_creation=false`). L'option est masquée et refusée par le serveur ; les écrans et prix (2,90 € / 5,80 €) sont prêts et s'activent quand la capacité apparaît.
2. **Modifications de vidéo : non proposées pour le moment** (`features.revisions = false` : masquées dans l'app, refusées par le serveur). Le code, les tests et le moteur (menu fermé de 5 commandes) sont prêts ; réactivation = un réglage. Prix provisoire : 1,21 €.
3. **Dictée vocale** : jointe comme note vocale ; pas de transcription serveur (un texte écrit reste requis pour « Personnalisé »).
4. **Upload en arrière-plan** : la reprise TUS est fiable (réseau, redémarrage), mais iOS/Android suspendent le JavaScript quand l'app est en arrière-plan ; l'envoi reprend au retour au premier plan.
5. **Paiements stores** : packs fixes 10/20/50/100 €, **sans** montant libre ni recharge automatique silencieuse (non supportée par les consommables) ; matrice par **plateforme** (pas encore par storefront/pays : prévoir un flag si vous activez le lien externe US/UE). À faire valider (voir `STORE_PAYMENT_POLICY.md`, parties Google/Stripe lues via sources secondaires).
6. **Conservation : 24 h maximum** pour les fichiers envoyés et les vidéos produites (purge automatique active, avertissement avant suppression, copies du moteur purgées). Réglable dans `app_settings.retention.*_hours`.
7. **Moteur** : B-roll résolu en métadonnées mais pas inséré dans le rendu ; sous-titres parlés exigent `DEEPGRAM_API_KEY`.
8. **Légal** : dossier complet généré depuis `web-public/legal.config.json` (mentions légales, CGU, CGV avec rétractation/renonciation et médiation, confidentialité RGPD, cookies, suppression de compte) + acceptation versionnée dans l'app ; reste à renseigner l'identité de la société et à faire relire par un juriste ; TVA du solde prépayé : expert-comptable.
9. Mode sombre non fourni en V1 (direction artistique claire) ; icônes/splash = placeholders.
