# Audit architecture & sécurité — GC Shield v2

Date : 2026-07-27  
Branche : `refactor/architecture-v2`

## Périmètre audité

- Application statique Netlify : `index.html`, `ambassadors.html`.
- Fonctions serverless : `netlify/functions/ai-proxy.js`, `netlify/functions/ambassador-data.js`.
- Configuration : `netlify.toml`.
- Données/artefacts hérités : `ambassador-data.js` à la racine, `index.pdf`.

## Constats majeurs

### Architecture

1. **Monolithe front-end** : `index.html` concentre UI, état métier, auth, paiement, IA, admin, textes légaux et logique de progression.
2. **Duplication** : `ambassador-data.js` existe à la racine et dans `netlify/functions`; seule la version Netlify est exécutable en production.
3. **Absence de migrations versionnées** avant GC Shield v2 : les tables Supabase utilisées par l'application ne disposaient pas d'un contrat SQL dans le dépôt.
4. **Couplage fournisseur** : appels IA centralisés côté serveur, mais prompts et traitements restent dispersés dans le HTML.

### Sécurité

1. **Admin côté client** : l'accès admin historique repose sur une vérification locale, insuffisante pour un back-office réel.
2. **Paiements non centralisés** : les liens Stripe directs ne créent pas de trace serveur systématique avant redirection.
3. **État d'abonnement local** : des flags comme `module1Validated` et `subscribed` restent présents côté navigateur pour compatibilité, mais ne doivent pas être considérés comme source de vérité.
4. **RLS non versionnée** : les règles Supabase devaient être formalisées pour les nouveaux objets critiques.
5. **Risque XSS** : le chat ambassadeur affichait du contenu avec `innerHTML` sans échappement systématique.

### Dette technique

- HTML/CSS/JS non modularisé, donc difficile à tester et faire évoluer.
- Pas de tests automatisés ni pipeline de lint.
- Pas de contrat d'API documenté entre front, Netlify Functions et Supabase.
- Gestion d'erreurs parfois compatible legacy avec HTTP 200 + `{ error }`, utile pour ne pas casser le front mais à normaliser à terme.

## GC Shield v2 implémenté

### 1. Signatures uniques de sites

- Table `gc_site_signatures` avec `signature_id` unique, propriétaire, URL, statut et métadonnées.
- Endpoint `gc-shield-signature` : création authentifiée pour les rôles autorisés, vérification publique par identifiant.
- Signatures déclaratives ajoutées aux pages existantes via `<meta name="gc-signature-id">`.

### 2. Journal d'audit immuable

- Table `gc_audit_log` avec chaînage par `previous_hash` et `event_hash`.
- Trigger SQL empêchant update/delete.
- Helper serveur `writeAudit()` utilisé par les endpoints GC Shield.

### 3. Détection des comportements anormaux

- Table `gc_anomaly_events`.
- Détection initiale non bloquante : user-agent manquant, payload trop volumineux, alias email suspect.
- Architecture prête pour ajout de scoring comportemental par fréquence/IP/ressource.

### 4. Rôles et permissions

- Rôles : Admin, Manager, Vendeur, Ambassadeur, Client.
- Module serveur `roles.js` centralisant permissions et résolution Supabase.
- Table `gc_user_roles` et fonctions SQL `gc_current_role()` / `gc_is_staff()`.

### 5. Paiements centralisés

- Table `gc_platform_payments` pour tracer toute initiation.
- Endpoint `gc-shield-payment` qui crée une intention plateforme avant de retourner un lien Stripe configuré par variable d'environnement.
- Le front tente le paiement centralisé puis retombe sur l'ancien lien Stripe si l'environnement n'est pas encore prêt.

### 6. Portail d'authenticité

- Page `verify.html` permettant de vérifier une signature GC Shield.
- Badge client `gc-shield.js` ajouté aux pages signées.

### 7. Corrections critiques

- Échappement HTML du chat ambassadeur pour réduire le risque XSS.
- Script GC Shield servi à la racine pour compatibilité Netlify statique.
- Migration RLS relançable via `drop policy if exists`.

## Prochaines étapes recommandées

1. Remplacer l'admin client par un vrai back-office authentifié Supabase + rôle `admin`.
2. Ajouter un webhook Stripe serveur pour passer `gc_platform_payments.status` à `paid` et activer les droits.
3. Déplacer progressivement le JS de `index.html` vers des modules dédiés (`auth`, `payments`, `training`, `admin`, `ai`).
4. Supprimer ou archiver le fichier racine `ambassador-data.js` après validation qu'aucun déploiement ne l'utilise.
5. Ajouter tests unitaires Node pour helpers Netlify et tests end-to-end critiques.
6. Enrichir la détection d'anomalies avec fenêtres temporelles, seuils par utilisateur et alerting staff.
