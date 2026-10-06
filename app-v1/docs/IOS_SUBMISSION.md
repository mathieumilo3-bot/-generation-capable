# Soumission iOS — guide pas à pas

Tout ce qui peut être préparé dans le dépôt l'est. Les étapes ci-dessous marquées **👤** exigent **votre** compte Apple Developer (je n'ai, et ne dois avoir, aucun accès à vos comptes). Barrière finale : `npm run release:check` doit afficher « ✓ prêt ».

## Ce qui est déjà prêt dans le dépôt

| Élément | Où |
|---|---|
| Identifiants de build (bundle id, nom, version/build, schéma) pilotés par variables, iPhone uniquement, chiffrement « exempté » déclaré, manifeste de confidentialité, permissions décrites et demandées **à l'usage** (photos, caméra, micro), Sign in with Apple, domaines associés | `apps/client/app.config.ts` |
| Profils de build development / staging / production, soumission | `apps/client/eas.json` |
| **Fiche App Store complète en français** (titre, sous-titre, description, mots-clés, texte promo, URLs, catégories, questionnaire d'âge, notes pour le relecteur) — validée contre le schéma officiel EAS Metadata | `apps/client/store.config.json` |
| Compte de démonstration pour la relecture (script) | `scripts/create-review-account.mjs` |
| Connexion par mot de passe réservée au relecteur (réglage serveur, **désactivé par défaut**) | `features.password_login` |
| Pages publiques (confidentialité, conditions, mentions légales, suppression de compte) | `web-public/` |
| Captures d'écran 6,9″ (brouillons produits depuis l'app, à remplacer par des captures simulateur si vous préférez) | `apps/client/store-assets/ios/6.9/` |
| Barrière de contrôle des placeholders | `npm run release:check` |

## Conformité aux guidelines (état)

| Guideline | État | Preuve |
|---|---|---|
| 2.1 Complétude : compte de démo + back-end allumé | ✅ à activer au moment de la soumission | script + `features.password_login` ; **gardez l'orchestrateur et le moteur en ligne pendant la relecture** |
| 2.3.3 Captures montrant l'app en usage | ✅ écrans d'usage (accueil, flow, récapitulatif, suivi, résultat) | `store-assets/` |
| 3.1.1 Achats in-app pour les crédits | ✅ packs consommables, aucun lien/bouton de paiement externe dans le build iOS | `payments.providers.ios = apple` ; `docs/STORE_PAYMENT_POLICY.md` |
| 4.8 Login équivalent | ✅ Sign in with Apple | écran de connexion |
| 5.1.1(v) Suppression de compte in-app + révocation Apple | ✅ | `delete-account`, `apple-link` |
| 5.1.2(i) Consentement explicite avant partage avec une IA tierce | ✅ case non pré-cochée, version tracée, **refus serveur sans consentement** | `accept_ai_processing`, test SQL `60_ai_consent` |
| 5.1.1 Permissions au moment utile, textes explicites | ✅ | `infoPlist`, expo-image-picker/audio/notifications |
| Confidentialité : politique publique + déclarations | ✅ modèles à valider (voir `web-public/legal.config.json`) | `web-public/` |
| 4.2 Fonctionnalité minimale / 2.5 | ✅ app native riche, pas un site encapsulé | — |
| Export compliance | ✅ `usesNonExemptEncryption: false` (HTTPS uniquement) | `app.config.ts` |

## Étapes 👤

1. **Compte** : Apple Developer Program (organisation recommandée : votre raison sociale apparaît comme vendeur ; nécessite un numéro D-U-N-S). Acceptez les contrats et renseignez **Contrats, fiscalité et opérations bancaires → Apps payantes** (indispensable pour les achats in-app).
2. **Identifiants** : l'App ID `APP_BUNDLE_ID` avec les capacités *Sign in with Apple*, *Associated Domains*, *Push Notifications*, *In-App Purchase* est créé par `eas credentials` / `eas build`. Créez aussi : le *Services ID* (connexion hors iOS), la clé *Sign in with Apple* (.p8) et la clé *App Store Server API / In-App Purchase* — voir `SETUP_REQUIRED.md §3`. **Sign in with Apple for Email Communication** : enregistrez votre domaine d'envoi (Certificates, Identifiers & Profiles → More) pour que les e-mails parviennent aux adresses « Masquer mon e-mail ».
3. **App Store Connect** : créez l'app (nom unique ≤ 30 car., langue principale français, SKU libre, bundle id). Le nom « Montage » est un **placeholder** : changez-le (`store.config.json` + `APP_NAME`).
4. **Achats in-app** (4 consommables, mêmes identifiants que `payments.store_packs`) :

   | Product ID | Nom de référence | Crédit au wallet | Palier de prix |
   |---|---|---|---|
   | `wallet_topup_10` | Solde 10 € | 10,00 € | à choisir (voir note) |
   | `wallet_topup_20` | Solde 20 € | 20,00 € | idem |
   | `wallet_topup_50` | Solde 50 € | 50,00 € | idem |
   | `wallet_topup_100` | Solde 100 € | 100,00 € | idem |

   Ajoutez pour chacun un nom/description localisés et la capture d'écran de l'écran d'achat (exigée pour la relecture). *Note prix :* Apple impose ses paliers (ex. 9,99 €, 10,99 €…) et prélève 15–30 %. Le serveur crédite **la valeur nominale du pack** quel que soit le prix du palier : décision business (aligner le palier sur le nominal et absorber la commission, ou majorer le palier iOS). Aucune règle de code à changer.
5. **Backend de production prêt** : projet Supabase de production, migrations, Edge Functions + secrets Apple (`SETUP_REQUIRED.md`), moteur + orchestrateur déployés et joignables. La relecture crée une vraie vidéo : si le back-end est éteint, c'est un rejet 2.1.
6. **Compte de démo** : `SUPABASE_URL=… SB_SECRET_KEY=… npm run review-account -- review@votre-domaine.fr 2000` → copiez e-mail + mot de passe dans `store.config.json` (`review.demoUsername`, `demoPassword`) puis, dans le back-office → Réglages, passez `features.password_login` à **true** (à remettre à **false** après la relecture).
7. **Renseignez les placeholders** : `store.config.json` (société, contact, URLs réelles), `web-public/legal.config.json` puis `npm run legal:build`, `web-public/.well-known/*` (TEAMID, bundle id), `eas.json` (`ascAppId`). Hébergez `web-public/` sur votre domaine (`SETUP_REQUIRED.md §8`).
8. **Captures** : `apps/client/store-assets/ios/6.9/01…06.png` (1320 × 2868) sont des brouillons générés depuis l'application avec des données de démonstration. Remplacez-les si vous le souhaitez par des captures du simulateur iPhone 17 Pro Max (même taille).
9. **Build + TestFlight** :
   ```bash
   cd apps/client && eas build -p ios --profile production
   eas submit -p ios --latest          # envoie à App Store Connect / TestFlight
   ```
   Testez en interne sur un vrai iPhone : connexion Apple, e-mail, achat **sandbox** (compte testeur sandbox), création d'une vidéo de bout en bout, notification, téléchargement, suppression de compte, expiration à 24 h.
10. **Fiche** : `eas metadata:lint` puis `eas metadata:push` (envoie `store.config.json`). Dans App Store Connect : *Confidentialité de l'app* (réponses ci-dessous), questionnaire d'âge (pré-rempli : aucun contenu sensible → 4+), droits sur le contenu (le contenu est fourni par l'utilisateur), publicité : non, IDFA : non ; sélectionnez le build ; ajoutez les notes de relecture (déjà dans la config).
11. **Soumettre pour relecture**, puis après acceptation : `features.password_login` → false, publication progressive (`phasedRelease` déjà activé).

## Confidentialité de l'app (App Store Connect) — réponses

| Donnée | Collectée | Liée à l'identité | Pistage | Finalité |
|---|---|---|---|---|
| Adresse e-mail, nom | Oui | Oui | Non | Fonctionnement de l'app |
| Contenu utilisateur (vidéos, audio, texte) | Oui | Oui | Non | Fonctionnement de l'app |
| Identifiants (ID utilisateur) | Oui | Oui | Non | Fonctionnement de l'app |
| Historique d'achats | Oui | Oui | Non | Fonctionnement de l'app |
| Diagnostics / données d'usage | Oui | Non (sans contenu) | Non | Fonctionnement, analyse |
| Données partagées avec des tiers | Oui — fournisseurs d'IA (avec consentement explicite) et prestataires de paiement | | Non | |

## Motifs de rejet les plus probables et parades

1. **Solde dépensé en services numériques vendu hors IAP** → build iOS en IAP uniquement (matrice serveur) ; vérifier qu'aucun lien Stripe n'apparaît sur iOS.
2. **Compte de démo inutilisable / back-end éteint** → script + `release:check` + monitoring pendant la relecture.
3. **Partage avec des IA tierces non consenti** → consentement explicite déjà bloquant côté serveur.
4. **Métadonnées incomplètes / placeholders** → `npm run release:check`.
5. **Validation des achats** : la relecture Apple utilise le *sandbox*, et Apple recommande qu'un serveur de production valide d'abord en production puis retombe sur le sandbox. Gardez donc `STORE_ALLOW_SANDBOX=true` côté Edge Functions (c'est le défaut de `staging` dans `eas.json`/la config) : seuls les testeurs sandbox déclarés chez Apple peuvent générer de tels achats. Ils sont **identifiés** (`payments.metadata.environment = "Sandbox"`) pour pouvoir être exclus des chiffres de revenus ; à `false`, la relecture ne pourrait pas acheter.
