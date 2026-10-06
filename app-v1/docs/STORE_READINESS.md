# Préparation App Store / Google Play

| Exigence | État | Où |
|---|---|---|
| Identifiants configurables (bundle id, package, nom, version/build) | ✅ | `apps/client/app.config.ts` (variables `APP_*`) |
| Sign in with Apple dès qu'un login tiers existe (guideline 4.8) | ✅ | écran de connexion + `usesAppleSignIn` |
| Suppression de compte in-app + révocation Apple + URL web (Play) | ✅ | `delete-account`, `web-public/` |
| Permissions à l'usage (photos, caméra, micro) — aucune au démarrage ; Android minimal | ✅ | `app.config.ts` (`infoPlist`, `permissions`, `blockedPermissions`) |
| Notifications : permission demandée après la 1re vidéo | ✅ | `src/lib/push.ts` |
| Liens profonds (Universal Links / App Links) | ✅ à brancher (domaine + fichiers `.well-known`) | `web-public/.well-known`, `app.config.ts` |
| URLs Conditions / Confidentialité / Support | ✅ configurables | `app_settings.urls.*` |
| Paiements : IAP/Play Billing sur les builds stores, jamais de bouton de paiement externe interdit | ✅ par matrice serveur | `payments.providers`, `docs/STORE_PAYMENT_POLICY.md` |
| Icônes, splash | ⚠️ placeholders | `apps/client/assets/` |
| Captures, textes de fiche, classification d'âge | ⛔ à produire | consoles |
| Review notes : compte de démonstration avec solde | ⛔ à créer (staging + invitation) | `admin → Nouveau client` |

**Risque de rejet à traiter avant soumission** : la recharge d'un solde dépensé en services numériques est de l'IAP côté stores ; voir les incertitudes listées dans `docs/STORE_PAYMENT_POLICY.md`.
