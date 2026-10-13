# Système de notifications intelligentes — Génération Capable

Documentation du système livré dans ce chantier : ce qui est réellement
câblé et fonctionnel, ce qui reste à faire, et comment le configurer.

## 1. Vue d'ensemble — deux canaux, pas un seul

| Public | Canal | Pourquoi |
|---|---|---|
| Admin (toi) | Push web (VAPID) | Compte authentifié → peut détenir un abonnement Push. Fonctionne app/onglet fermé, y compris sur mobile. |
| Vendeurs | Push web (VAPID) | Idem — coach commercial quotidien. |
| Prospects anonymes (mission section 3) | Email (Resend) | Un visiteur qui n'a fait que laisser son email n'a **pas** de compte, donc pas d'abonnement Push possible. Email est le seul canal qui existe pour lui. |

C'est le même modèle que Duolingo/Revolut : push pour les utilisateurs
connectés, email pour la relance d'un visiteur qui n'a pas fini de
s'inscrire.

### Sur le "push natif iOS/Android" demandé

Ce dépôt est un **site web** (SPA `index.html` + Netlify Functions), pas une
app iOS/Android publiée sur les stores. Il n'existe donc pas d'app native à
laquelle brancher Firebase Cloud Messaging (Android) ou APNs (iOS). Ce qui
est livré ici — **Web Push** — est l'équivalent le plus proche disponible
pour un site web :
- **Android (Chrome/Edge)** : fonctionne nativement, y compris navigateur
  fermé, sans rien installer de plus.
- **iOS (Safari 16.4+)** : fonctionne aussi, mais **seulement si le site a
  été ajouté à l'écran d'accueil** (PWA installée) — restriction Apple, pas
  un choix technique de ce projet. `manifest.json` et les meta tags
  `apple-mobile-web-app-*` ajoutés à `index.html` rendent ce chemin possible.
- **Vraie app App Store/Play Store avec push natif** : nécessiterait
  d'empaqueter le site (ex: Capacitor) et de configurer FCM + APNs — c'est
  un projet mobile à part entière, hors périmètre de ce chantier web.

## 2. Ce qui est câblé (temps réel)

Dans `netlify/functions/stripe-webhook.js` :
- `checkout.session.completed` (abonnement) → `admin.business.new_seller`
  (si première activation), `admin.business.stripe_payment_received`,
  conversion du lead marketing correspondant.
- `checkout.session.completed` (commande CRM payée, `handleOrderPaid`) →
  vente/première vente/grosse vente (vendeur + admin), record personnel du
  vendeur, record plateforme (`platform_records`), objectif journalier
  (si `DAILY_SALES_GOAL_CENTS` configuré).
- `invoice.payment_failed` → `admin.business.payment_failed`.
- `charge.refunded` → `admin.business.refund_processed`.
- `charge.dispute.created` → `admin.business.refund_requested` (un litige
  est, du point de vue admin, la demande de remboursement contestée la plus
  proche de ce que Stripe expose réellement).
- Toute erreur de traitement du webhook → `admin.technical.server_error`
  (best-effort, n'affecte jamais la réponse HTTP renvoyée à Stripe).

Dans `netlify/functions/ambassador-data.js` :
- Première connexion d'un ambassadeur → `admin.business.new_ambassador`.

Toutes ces notifications passent par `safeNotify()` — une erreur du moteur
de notifications ne peut **jamais** faire échouer un paiement ou une
inscription.

## 3. Ce qui est câblé (périodique — Netlify Scheduled Functions)

Voir `netlify.toml` pour les fréquences exactes.

- **`notify-cron-coach-background.js`** (30 min) — coach commercial
  vendeur : message du matin, "objectif du jour ?", point de mi-journée,
  bilan du soir, relance "aucune prospection aujourd'hui", relance
  inactivité 2j/4j/7j+. Chaque vendeur est démarché dans **sa propre**
  fenêtre horaire (réglages), jamais deux fois pour le même évènement le
  même jour (déduplication par `notification_log`), jamais avec la même
  variante de texte deux fois de suite.
- **`notify-cron-leads-background.js`** (15 min) — séquence email prospect
  30min/24h/3j/7j, ancrée sur l'heure de capture (pas sur l'heure d'envoi
  réelle, pour ne jamais dériver).
- **`notify-cron-crm-scan-background.js`** (10 min) — alertes admin
  "Commercial" : nouveau prospect qualifié, rendez-vous pris, devis envoyé,
  vente en attente, prospect chaud sans suivi. Ce sont des écritures faites
  directement par le vendeur via des fonctions RPC Supabase (pas de Netlify
  Function interceptable en temps réel) — d'où un scan périodique à
  curseur plutôt qu'un déclenchement synchrone.
- **`notify-cron-healthcheck.js`** (10 min) — ping de la page d'accueil ;
  alerte "Site indisponible" / "Rétabli" / "Temps de réponse anormal".
  N'alerte qu'au changement d'état, jamais en boucle pendant toute une panne.

## 4. L'adaptation "IA" (segmentation comportementale)

`_lib/notifications/segmentation.js` calcule, à partir des vraies données
(prospects, historique de pipeline, ventes), un profil par vendeur :

- **`new`** — inscrit depuis moins de 14 jours et aucune vente → messages
  du matin en ton pédagogique/accompagnement (`sellerCoachMorningNew`).
- **`top`** — ≥3 ventes ou ≥1500€ sur 30 jours → messages plus ambitieux,
  défi du jour (`sellerCoachMorningTop`).
- **`inactive`** — aucune activité de prospection depuis ≥2 jours →
  relance (catégories `seller.coach.inactivity_2d/4d/7d`).
- **`active`** — cas par défaut.

C'est volontairement un scoring transparent et explicable, pas un modèle
externe en boîte noire — cohérent avec l'objectif "augmenter l'engagement
sans devenir intrusif" : on doit pouvoir dire précisément pourquoi un
message a été choisi.

## 5. Anti-répétition, préférences, fréquence

- **Anti-répétition** : `send.js::pickVariant()` regarde les 4 dernières
  variantes envoyées à cet utilisateur pour cette catégorie
  (`notification_log`) et exclut ce sous-ensemble avant de tirer au sort.
- **Déduplication** : chaque envoi a un `event_key` stable
  (`sale:<id>`, `coach:morning:<date>`, …) — jamais deux fois le même
  évènement.
- **Préférences** (`notification_preferences`, via
  `netlify/functions/notification-preferences.js`) : interrupteur général,
  fenêtre horaire (`active_hours_start/end`), fréquence
  (`normal`/`reduced`/`minimal`), et un override booléen par catégorie.
  `reduced` coupe les catégories "bavardes" (objectif du jour, point de
  mi-journée, relance sans activité) ; `minimal` ne garde que les
  catégories critiques (`CRITICAL_CATEGORIES` dans `templates.js`).
- Les catégories **critiques** (vente, premier sale, record, paiement
  échoué, litige, site down, erreur serveur) ignorent la fenêtre horaire —
  ce sont des évènements qu'on veut savoir immédiatement, pas au réveil.

## 6. Interface utilisateur

`notifications-client.js` (chargé en `<script defer>` par `index.html`) est
un widget auto-porté, injecté dynamiquement dans le DOM plutôt que codé en
dur dans le HTML existant (fichier de 477 Ko à ne pas fragiliser) :
- Une cloche flottante 🔔 apparaît quand l'utilisateur est connecté.
- Elle ouvre une modale de réglages qui appelle `notification-preferences.js`
  — la liste des catégories proposées dépend du rôle (admin voit en plus
  les catégories business/commercial/technique).
- L'activation déclenche `Notification.requestPermission()` puis
  l'abonnement Push (`push-subscribe.js`).
- Le bouton "Oui" de la notification "objectif du jour" est un vrai bouton
  d'action de la notification système (`Notification.actions`), géré par
  `sw.js` → `notifications-client.js` confirme l'objectif via
  `seller-goal.js` au retour sur le site.

Rien de tout ça n'a nécessité d'éditer la structure existante d'`index.html`
au-delà de 3 ajouts minimes : une balise `<script>`, un appel à
`captureLead()` dans `activateSubscription()`, et les meta tags PWA.

## 7. Ce qui N'EST PAS câblé (honnêtement)

- **Nouveau partenariat** — aucun modèle de données "partenariat" n'existe
  dans le schéma actuel. Ajouter la notification demande d'abord de définir
  ce qu'est un partenariat pour Génération Capable (table, workflow).
- **Forte hausse/baisse de trafic** — aucun pipeline analytics
  (Plausible/GA/table d'évènements) n'existe dans ce dépôt pour calculer un
  signal de trafic. Le healthcheck livré couvre disponibilité/latence, pas
  le volume de visiteurs.
- **"Proposition commerciale envoyée" distincte de "Devis envoyé"** — le
  schéma CRM (`orders`/`prospects`) n'a qu'une seule étape `quote_sent`.
  Les deux bullets de la mission pointent vers le même évènement
  (`admin.commercial.quote_sent`) tant que le pipeline n'a pas deux étapes
  distinctes.
- **"Prospect perdu"** — le pipeline (`prospects.stage`) est verrouillé par
  des triggers Postgres qui n'autorisent que 8 étapes précises (voir
  migrations 0009/0010), sans étape "perdu". L'ajouter est un choix produit
  (comment un vendeur déclare-t-il un prospect perdu ? à quel moment ?) qui
  dépasse le périmètre de ce chantier notifications — pas quelque chose à
  décider unilatéralement en modifiant une contrainte métier verrouillée.
- **Monitoring technique avancé** (bug critique vs erreur serveur, APM,
  alerting multi-région) — `admin.technical.server_error` couvre
  aujourd'hui uniquement les erreurs interceptées par `stripe-webhook.js`.
  L'étendre à toutes les Netlify Functions demande d'ajouter le même
  wrapper `safeNotify` dans leurs blocs `catch` respectifs.

## 8. Limites de passage à l'échelle (documentées, pas cachées)

- `notify-cron-coach-background.js` traite au plus
  `MAX_SELLERS_PER_TICK` (2000 par défaut) vendeurs par passage, avec une
  concurrence bornée à 15 requêtes simultanées. Confortable jusqu'à
  quelques milliers de vendeurs actifs. Au-delà, la bonne évolution est de
  pousser le calcul "qui est dû maintenant" côté SQL (fonction dédiée
  renvoyant directement la liste plutôt que de le recalculer ici pour
  chaque vendeur), voire de passer par une vraie file de tâches.
- `capture-lead.js` est un endpoint public sans CAPTCHA ni limitation de
  débit par IP — un acteur malveillant pourrait l'utiliser pour faire
  envoyer des emails à des adresses arbitraires via le compte Resend du
  projet. Mitigation actuelle : validation basique du format email,
  déduplication par email. Si ça devient un problème réel, ajouter
  Cloudflare Turnstile (ou équivalent) côté formulaire.

## 9. Configuration requise (variables d'environnement Netlify)

| Variable | Rôle | Obligatoire |
|---|---|---|
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Signature des notifications Push (RFC 8291). Générer avec `npx web-push generate-vapid-keys`. | Oui, pour le Push |
| `VAPID_SUBJECT` | `mailto:...` de contact requis par la spec VAPID. | Recommandé |
| `RESEND_API_KEY` | Envoi des emails de relance prospect. | Oui, pour la séquence email |
| `RESEND_FROM_EMAIL` | Adresse d'expédition (domaine vérifié sur Resend). | Recommandé |
| `UNSUBSCRIBE_SECRET` | Signature des liens de désinscription email (RGPD). | Recommandé (sinon dérivé de `VAPID_PRIVATE_KEY`) |
| `SITE_URL` | URL pingée par le healthcheck + base des liens dans les emails/Push. | Recommandé |
| `BIG_SALE_THRESHOLD_CENTS` | Seuil "grosse vente" (défaut 100000 = 1000€). | Optionnel |
| `DAILY_SALES_GOAL_CENTS` | Objectif de CA journalier (0 = désactivé). | Optionnel |
| `PROSPECT_STALE_HOURS` | Délai avant "prospect chaud sans suivi" (défaut 48h). | Optionnel |
| `PENDING_ORDER_STALE_HOURS` | Délai avant "vente en attente" (défaut 24h). | Optionnel |
| `MAX_SELLERS_PER_TICK` / `MAX_LEADS_PER_TICK` | Plafonds de passage à l'échelle (section 8). | Optionnel |

Icônes `icon-192.png` / `icon-512.png` référencées par `manifest.json` et
`sw.js` : à fournir par l'équipe (assets de marque), absentes de ce
chantier — leur absence dégrade proprement (icône par défaut du
navigateur), rien ne casse.

## 10. Mise en route

1. Appliquer `supabase/migrations/0014_notifications_system.sql`.
2. Générer les clés VAPID (`npx web-push generate-vapid-keys`) et les
   renseigner sur Netlify.
3. Créer un compte Resend, vérifier un domaine d'envoi, renseigner
   `RESEND_API_KEY`/`RESEND_FROM_EMAIL`.
4. Déployer — `package.json` (nouveau, racine du dépôt) installe la seule
   dépendance npm du projet (`web-push`) au build Netlify.
5. Vérifier dans le dashboard Netlify que les 4 fonctions programmées
   apparaissent bien en "Scheduled functions" avec leur fréquence.
