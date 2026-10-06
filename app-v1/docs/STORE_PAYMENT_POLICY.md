# Politiques de paiement des stores et flux Stripe (wallet prépayé en EUR)

Recherche faite le **2026-10-06**. Ce document n'est **pas un avis juridique**.

Niveaux de confiance :
- **[P]** : page officielle lue directement (developer.apple.com).
- **[S]** : source secondaire (presse, blogs, extraits de recherche). Le proxy de la session bloquait support.google.com, docs.stripe.com, android-developers.googleblog.com, apple.com/newsroom et sec.gov. Les pages Google et Stripe n'ont donc pas pu être lues en entier.
- **[M]** : mémoire du modèle, non vérifiée aujourd'hui.

Tout point [S] ou [M] qui conditionne un choix produit doit être revérifié sur la page officielle avant d'implémenter.

---

## 1. Apple App Store

### 1.1 Règle générale : guidelines 3.1.1 / 3.1.3 (dernière mise à jour des guidelines : 2026-06-08 [P])

**Règle actuelle**
- 3.1.1 : toute fonctionnalité ou tout contenu débloqué dans l'app (abonnements, monnaies virtuelles, contenu premium) doit passer par l'in-app purchase (IAP). Les mécanismes maison (clés de licence, QR codes, cryptos) sont interdits.
- 3.1.1 : « Digital gift cards, certificates, vouchers, and coupons which can be redeemed for digital goods or services can only be sold in your app using in-app purchase. »
- 3.1.1 : les crédits ou monnaies achetés via IAP **ne doivent pas expirer**. Un mécanisme de restauration est exigé pour les achats restaurables.
- 3.1.3(b) Multiplatform Services : l'app peut donner accès à du contenu ou des crédits acquis sur le web ou une autre plateforme, **à condition que ces items soient aussi achetables en IAP dans l'app**.
- 3.1.3(e) : seuls les biens physiques et les services consommés hors de l'app échappent à l'IAP. Les vidéos numériques téléchargées/exportées ne sont pas dans ce cas.

**Implication pour NOTRE app**
- Un wallet prépayé en « solde EUR » dépensé pour des vidéos numériques est du contenu numérique consommé via l'app. Hors exceptions régionales (1.2 à 1.4), **le build iOS App Store doit vendre la recharge en IAP**.
- Le wallet ressemble à un « voucher/crédit ». Le risque de rejet est élevé si on vend du solde EUR hors IAP dans le build iOS.
- Le solde acheté via IAP ne doit pas expirer.
- Un solde acheté sur le web puis dépensé dans l'app iOS n'est toléré (3.1.3(b)) que si l'IAP est aussi proposé dans l'app, sauf storefront US ou UE avec les droits décrits plus bas.

Source : https://developer.apple.com/app-store/review/guidelines/ [P]

### 1.2 Liens et boutons d'achat externes : 3.1.1(a) (état au 2026-10-06)

**Règle actuelle [P]**
- Hors États-Unis, les apps et leurs métadonnées ne peuvent pas contenir de boutons, liens ou appels à l'action vers un autre moyen d'achat. Exception : le *StoreKit External Purchase Link Entitlement* dans certains storefronts (dont l'UE, voir 1.4).
- **Storefront États-Unis** : « no prohibition on an app including buttons, external links, or other calls to action, and no entitlement is required ».

**Implication**
- Le comportement doit être **piloté par le storefront** de l'App Store (pas par la locale ni l'IP), car la règle dépend du storefront.

### 1.3 États-Unis : suite Epic v. Apple [S, non lu en direct]

- L'injonction d'avril 2025 interdit à Apple de prélever une commission sur les achats via lien externe aux États-Unis. Les guidelines ont été mises à jour en mai 2025.
- Le Ninth Circuit a confirmé l'essentiel du jugement en 2026 mais admet qu'Apple puisse facturer une commission limitée aux coûts « genuinely and reasonably necessary ». L'affaire est renvoyée au tribunal de district pour fixer un taux.
- La Cour suprême a accordé le certiorari le **2026-06-30**, sur une seule question : le standard du *civil contempt*. Audience prévue au terme d'octobre 2026.
- Mi-août 2026, la demande d'Apple de suspendre la procédure de fixation de commission a été refusée (juge Kagan). Le tribunal de district fixe donc un taux pendant que la Cour suprême instruit.
- À date, les liens externes aux États-Unis restent autorisés. Une commission future est possible.

**Implication** : le link-out US vers Stripe est utilisable aujourd'hui, mais la marge économique est **incertaine**. Prévoir un flag serveur `ios_us_external_link_enabled` (kill-switch).

Sources :
- https://www.neonpay.com/blog/apple-app-store-alternative-payment-fees-what-developers-pay-in-2026
- https://ipwatchdog.com/2026/06/30/high-court-grants-cert-in-apples-challenge-to-ninth-circuit-contempt-ruling-in-app-store-dispute/
- https://www.macrumors.com/2026/08/12/app-store-fee-fight-24-hour-delay/
- https://www.supremecourt.gov/DocketPDF/25/25-1311/424150/20260914154510009_2026-09-14%20No.%2025-1311%20Apple-Epic%20Merits%20Opening%20Brief.pdf

### 1.4 UE / DMA (et France) [P pour les chiffres, via developer.apple.com/support/apps-in-the-eu/]

- Nouvelles conditions unifiées **effectives le 2026-10-01** (annoncées le 2026-08-18). Elles remplacent l'Alternative Terms Addendum et l'addendum StoreKit External Purchase Link.
- Taux annoncés (à reconfirmer dans le contrat) :

| Voie | Commission |
|---|---|
| IAP Apple | 26 % (15 % pour Small Business Program, etc.) |
| Paiement alternatif dans l'app (PSP tiers) | 20 % (10 % si éligible) |
| Lien/offre sortant (Store Services Commission) | 15 % (10 % si éligible), sur les ventes dans les **7 jours** après le tap |
| Core Technology Commission (distribution alternative) | 5 % |

- IAP et paiements alternatifs / liens peuvent **coexister**. Le choix de combinaison doit être maintenu **12 mois**.
- Il faut accepter le contrat mis à jour (Account Holder) et obtenir l'entitlement correspondant (*Alternative Payment Entitlement* / lien externe).
- Le développeur gère les taxes. Rapport mensuel des transactions sous 15 jours.
- Nouvelles exigences de contrôle parental (parental gate) pour les paiements alternatifs, selon l'âge et la région.
- **France** : c'est un storefront UE, donc ces règles s'appliquent. Je n'ai trouvé aucune règle spécifique à la France sur les paiements in-app.

**Implication** : en UE, le link-out vers Stripe est possible (entitlement + commission 15 % sur le lien) mais **pas gratuit**. Le choix par défaut sûr est l'IAP. La combinaison choisie engage 12 mois, donc à décider avec le juridique/finance avant publication.

Sources :
- https://developer.apple.com/support/apps-in-the-eu/
- https://www.macobserver.com/news/eu-app-store-terms-october-1-rate-card/
- https://mjtsai.com/blog/2026/08/18/new-eu-app-store-terms-to-comply-with-dma/

### 1.5 Wallet prépayé : IAP obligatoire ?

- Dans le build iOS App Store **hors US et hors UE avec droits**, oui : le solde est un crédit numérique (3.1.1, voucher/credits).
- **Recharge automatique sous seuil via IAP : non, pas possible.** Les consommables exigent à chaque achat la confirmation de l'utilisateur dans la feuille StoreKit. Seuls les abonnements auto-renouvelables sont récurrents, avec une période fixe (7 jours minimum, 3.1.2(a)) et sans notion de « seuil ». Aucun mécanisme n'existe pour déclencher un consommable côté serveur. Détournement par un abonnement : risque de rejet 3.1.2 / « bait and switch ». Source : https://developer.apple.com/in-app-purchase/ [P], conclusion par inférence ([M] sur l'absence d'API de recharge).
- Alternatives pour l'auto-reload sur iOS : (a) le faire uniquement via Stripe en link-out là où c'est permis (US, UE avec entitlement) ; (b) un abonnement mensuel à crédits inclus (3.1.2(a) : « Subscriptions may include consumable credits »), à valider avec App Review.

### 1.6 Tarification IAP : paliers vs montant libre

- App Store Connect propose **900 price points**, de 0,29 $ à 10 000 $ (équivalents locaux), plus des « custom price points » par storefront. Source : https://developer.apple.com/in-app-purchase/ [P].
- **Pas de montant libre** : chaque produit consommable a un prix fixe choisi dans la grille. Un wallet libre « ≥ 10 € » n'est pas réalisable en IAP. Il faut des **packs** (ex. 10/20/50/100 €).
- Le prix client = prix du pack. Le crédit wallet doit être calculé net ou brut de façon cohérente, avec un ledger par source (apple/google/stripe) pour la compta et les remboursements.
- Remboursements IAP : gérés par Apple. Écouter App Store Server Notifications (REFUND / CONSUMPTION_REQUEST) et décrémenter le wallet [M].

---

## 2. Guideline 4.8 et suppression de compte

### 2.1 4.8 Login Services [P]

- Si l'app utilise un login tiers/social (Google Sign-In inclus) pour créer ou authentifier le compte principal, elle doit **aussi** proposer un service de login équivalent, qui :
  1. limite la collecte au nom et à l'email,
  2. permet de masquer l'email,
  3. ne collecte pas les interactions à des fins publicitaires sans consentement.
- Sign in with Apple remplit ces critères. D'autres services respectant ces trois points sont acceptables en théorie.
- Exemptions : l'app n'utilise **que** son propre système de compte (email + mot de passe maison) ; apps éducation/entreprise ; ID gouvernemental ; client d'un service tiers spécifique.

**Implication** : si Google Login est ajouté, il faut **Sign in with Apple** (le plus sûr) dans le build iOS. Sans Google ni autre login social, rien à ajouter. La parité Android/Web est recommandée mais non imposée.

### 2.2 5.1.1(v) Suppression de compte [P]

- Si l'app permet de créer un compte, elle doit permettre de **supprimer le compte dans l'app** (suppression complète des données personnelles, pas une simple désactivation ; un lien vers une page web de suppression est toléré si la suppression se termine sur le web).
- Pour Sign in with Apple, il faut **révoquer les tokens** via l'API REST : `POST https://appleid.apple.com/auth/revoke` avec `client_id`, `client_secret` (JWT signé avec la clé Sign in with Apple), `token` (refresh ou access token), `token_type_hint`. Un 200 signifie révoqué ou déjà invalide. Il faut donc **stocker le refresh_token** obtenu à `/auth/token` lors du login.
- Informer l'utilisateur des délais et des durées de rétention légales. Si un abonnement existe, indiquer comment l'annuler via Apple.

**Implication spécifique wallet** : avant suppression, gérer le solde restant (remboursement ou perte consentie), les commandes en cours et les données comptables conservées légalement. Ce point est à valider par le juridique.

Sources :
- https://developer.apple.com/support/offering-account-deletion-in-your-app/ [P]
- https://developer.apple.com/forums/thread/707545 (paramètres de /auth/revoke) [S]

---

## 3. Google Play

### 3.1 Payments policy et programmes [S, pages support.google.com non lisibles]

- **Règle de base** : les apps distribuées sur Play qui facturent des fonctionnalités ou contenus numériques (monnaies virtuelles, etc.) doivent utiliser Google Play Billing, sauf exceptions et programmes alternatifs. Source : https://support.google.com/googleplay/android-developer/answer/10281818
- **États-Unis (Epic v. Google)** : depuis le 2025-10-29, Google n'impose plus Play Billing aux États-Unis et autorise liens externes et paiements alternatifs, via programmes à inscription. Source : https://technologylaw.fkks.com/post/102lroc/google-allows-external-payments-following-upheld-injunction
- **Règlement Epic/Google (mars 2026) et « Billing Choice Program »** :
  - Déploiement : **2026-06-30** pour États-Unis, Royaume-Uni et EEE ; Australie 2026-09-30 ; Corée et Japon 2026-12-31 ; reste du monde 2027-09-30.
  - Frais annoncés : service fee 10 % sur le premier million de dollars de revenu annuel (15 % au-delà pour les transactions standard), plus une **billing fee de 5 %** uniquement si Play Billing est utilisé (US/UK/EEE). Les paiements alternatifs ou liens externes ne paient pas cette billing fee. Chiffres [S] contradictoires entre sources, à reconfirmer.
  - Source : https://android-developers.googleblog.com/2026/06/play-expanded-billing.html (lien trouvé, non lu), https://support.google.com/googleplay/android-developer/answer/17161464
- **EEE** : le Billing Choice Program coexiste avec l'*External Offers Program* (liens et offres hors Play). Un app inscrit à External Offers ne peut pas utiliser Play Billing ou user choice billing pour les mêmes achats (voir page du programme). Source : https://support.google.com/googleplay/android-developer/answer/14372887
- **User Choice Billing** (historique) : https://support.google.com/googleplay/android-developer/answer/13821247
- **Reste du monde** : jusqu'au déploiement local, **Play Billing reste obligatoire** pour les biens numériques. L'app étant mondiale, c'est le défaut.

**Implication** : Play Billing est requis par défaut sur le build Android Store, sauf pays éligibles (US, UK, EEE dont France) où une inscription à un programme permet Stripe en alternative ou en lien. Play Billing propose aussi des consommables en produits à prix fixe (grille de prix), donc **pas de montant libre** ni de recharge auto sous seuil en Play Billing [M pour les détails techniques].

### 3.2 Suppression de compte et Data Safety [S]

- Si l'app permet de créer un compte dans l'app, il faut : (1) un **chemin de suppression dans l'app** ; (2) un **lien web** où demander la suppression du compte et des données, déclaré dans Play Console (formulaire Data safety, section suppression de données).
- La suppression doit couvrir le compte et les données associées. Les données conservées pour raison légale doivent être divulguées.
- Le formulaire Data safety doit déclarer toutes les données collectées/partagées (y compris celles des SDK : Stripe, analytics, etc.).
- Source : https://support.google.com/googleplay/android-developer/answer/13327111

**Implication** : prévoir une **page web publique** de suppression de compte (URL stable, utilisable sans l'app) en plus du flux in-app.

---

## 4. Stripe (Web ; link-out là où autorisé) [S, docs.stripe.com non lisible directement]

### 4.1 Top-up à montant libre sur le Web

- Stripe recommande **Checkout Sessions** (avec Payment Element si UI embarquée) pour la plupart des intégrations. Les **PaymentIntents** seuls conviennent si on veut contrôler soi-même l'état de checkout, les taxes, remises et conversions. Source : https://docs.stripe.com/payments/checkout-sessions-and-payment-intents-comparison
- **Dynamic payment methods** : ne pas passer `payment_method_types` ; Stripe affiche les moyens activés dans le Dashboard selon devise et contexte (cartes, Apple Pay, Google Pay, Link, etc.). Source : https://docs.stripe.com/payments/payment-methods/integration-options
- Montant libre : le **serveur** valide les bornes (min, max, pas) et crée la Checkout Session avec `price_data.unit_amount` (EUR en centimes). Ne jamais faire confiance au montant envoyé par le client. L'existence d'un mode « customer chooses price » (`custom_unit_amount`) est à vérifier dans la doc [M].
- **Recommandation** : Checkout Sessions (hébergé ou embarqué) pour le Web. Pas de PaymentIntent « maison » sauf besoin précis.
- Apple Pay et Google Pay sont exposés par Checkout/Payment Element ; Apple Pay web demande la vérification de domaine. Link s'active dans le Dashboard.
- iOS en US : Stripe documente le link-out vers Checkout dans le navigateur externe (pas de WebView). Source : https://docs.stripe.com/mobile/digital-goods/checkout

### 4.2 Recharge automatique (auto-reload, off-session)

Flux recommandé :
1. **Consentement explicite** à la recharge automatique (texte clair : seuil, montant, plafond, comment annuler), horodaté et conservé.
2. Sauvegarde de la carte avec SCA : Checkout avec `setup_future_usage=off_session` pendant un paiement, ou **SetupIntent** `usage=off_session` (défaut). La carte est authentifiée une fois, ce qui augmente les chances d'exemption pour les débits suivants. Source : https://docs.stripe.com/payments/save-and-reuse
3. Déclenchement **côté serveur** quand `solde < seuil` : PaymentIntent avec `customer`, `payment_method`, `off_session=true`, `confirm=true`, avec une **Idempotency-Key** liée à la tentative de recharge (par exemple `autoreload:{user}:{ledger_seq}`). Les clés sont conservées environ 24 h, au-delà un doublon n'est plus dédupliqué (source : https://docs.stripe.com/api/idempotent_requests).
4. **SCA** : les exemptions ne sont pas garanties. Si la banque exige une authentification, le PaymentIntent échoue (`authentication_required`) ou passe en `requires_action`. Il faut alors **désactiver temporairement l'auto-reload, notifier l'utilisateur** (email/push) avec un lien pour revenir en session et confirmer le paiement avec le `client_secret`. Ne pas boucler sur des retries.
5. Garde-fous : plafond par jour/mois, une seule recharge en cours par utilisateur (verrou), limitation après N échecs.
6. Le crédit du wallet n'est fait que sur événement webhook confirmé (voir 4.3).

### 4.3 Webhooks et robustesse

À écouter :
- `checkout.session.completed` : créditer **seulement si `payment_status == "paid"`** ;
- `checkout.session.async_payment_succeeded` / `checkout.session.async_payment_failed` : moyens de paiement différés ;
- `payment_intent.succeeded` : pour les recharges off-session ;
- `payment_intent.payment_failed` / `payment_intent.requires_action` : déclencher la notification utilisateur ;
- `charge.refunded` : débiter ou ajuster le wallet ;
- `charge.dispute.created` : bloquer ou geler le solde correspondant ;
- `setup_intent.succeeded` (enregistrement de carte).

Règles [S : https://docs.stripe.com/webhooks, https://docs.stripe.com/webhooks/signature, https://docs.stripe.com/checkout/fulfillment] :
- **Vérifier la signature** `Stripe-Signature` avec le **corps brut** (pas de JSON parsé avant) et le secret de l'endpoint (`constructEvent`).
- Les événements peuvent arriver **en double ou dans le désordre**. Enregistrer les `event.id` traités, **et** appliquer une contrainte d'unicité sur `payment_intent.id` dans le ledger (le crédit doit être idempotent).
- Répondre vite en 2xx, traiter de façon asynchrone.
- Ne jamais créditer sur la base du retour navigateur (`success_url`) ni de l'app.
- Les `Idempotency-Key` s'appliquent aux **requêtes sortantes** vers l'API Stripe, pas aux webhooks.

### 4.4 TVA, factures, wallet prépayé : à valider avec un comptable

- Un solde prépayé peut être traité comme un « bon » (voucher). Selon qu'il est à finalité unique ou multi-usages, la TVA est due à l'émission ou à la consommation. Je n'invente pas la qualification : **à faire valider par un comptable/fiscaliste** (pays du client, nature du solde, services consommés). Référence générale : https://stripe.com/resources/more/value-added-tax-vat-on-vouchers-in-germany
- Points à trancher : moment du fait générateur de TVA, factures (à la recharge ou à la dépense), traitement des remboursements et soldes non utilisés, **Stripe Tax** (https://docs.stripe.com/tax) activé ou non, et statut réglementaire du wallet (monnaie électronique / réseau limité) pour une app mondiale.
- À valider aussi : droit de rétractation des consommateurs UE pour contenu numérique, conservation comptable après suppression de compte.

---

## 5. Architecture recommandée

### 5.1 Matrice

| Build | Provider par défaut | Provider alternatif (conditionnel) | Montant libre | Auto-reload | Cartes enregistrées |
|---|---|---|---|---|---|
| `ios_store` | `apple_iap` (packs fixes) | `stripe` en link-out navigateur : storefront **US** (sans entitlement) ; storefront **UE** avec entitlement/contrat et commission | IAP : non (packs). Stripe : oui | IAP : **non**. Stripe link-out : oui si permis | IAP : non. Stripe : oui |
| `android_store` | `google_play_billing` (packs fixes) | `stripe` via Billing Choice / External offers : **US, UK, EEE** (dont France) après inscription ; Australie/Japon/Corée aux dates de déploiement | Play Billing : non. Stripe : oui | Play Billing : non. Stripe : oui | Play Billing : non. Stripe : oui |
| `web` | `stripe` (Checkout Sessions) | aucun | oui (bornes serveur) | oui | oui |

Notes :
- Un build hors store (APK sideload, TestFlight interne) n'est pas le canal de production ; ne pas s'en servir pour contourner les règles.
- Le solde est **unique côté serveur** (ledger), avec colonne `source` (`apple`, `google`, `stripe`) pour la compta, les remboursements et les règles d'expiration (IAP : pas d'expiration).

### 5.2 Configurable côté serveur (flags par pays / storefront / plateforme)

- `payments.allowed_providers[platform][country_or_storefront]`, avec défaut restrictif : IAP / Play Billing seulement.
- `ios_us_external_link_enabled` (kill-switch Epic), `ios_eu_external_link_enabled` (entitlement obtenu + combinaison de moyens figée 12 mois), `android_billing_choice_countries` (liste dynamique selon les dates de déploiement Google).
- `topup.min_amount`, `topup.max_amount`, `topup.step`, `iap.packs[]` (identifiants produits App Store / Play, prix, crédit accordé), `auto_reload.enabled_by_platform`, plafonds auto-reload.
- Détection : **storefront App Store** (StoreKit `Storefront`) et pays Play, pas l'IP. Re-évaluer à chaque lancement (la règle suit le storefront).
- Textes légaux liés au provider (CGV, mentions de remboursement), activables par flag.

### 5.3 Incertitudes et validations nécessaires

- **Juriste** : qualification du wallet (monnaie électronique, réseau limité, voucher), droit de rétractation sur contenu numérique, politique de remboursement des soldes, conditions de l'auto-reload (mandat, information préalable), suppression de compte et conservation des données comptables.
- **Comptable** : TVA sur wallet prépayé (voucher), factures, Stripe Tax.
- **App Review (Apple)** : le wallet en « solde EUR » sera-t-il accepté sous la forme de packs consommables IAP ? La dépense du solde web dans l'app est-elle admise en dehors du US/UE (3.1.3(b)) ? Les liens de sortie UE/US et leur formulation. À tester avec un build soumis et à documenter dans les notes de review.
- **Apple US** : commission future sur les liens (district court + Cour suprême, octobre 2026 et après). **Apple UE** : taux et conditions entrés en vigueur le 2026-10-01, à relire dans le contrat.
- **Google** : taux exacts (service fee / billing fee), pays éligibles et calendrier ; je n'ai pas pu lire les pages Play Console.
- **Stripe** : détails de doc non vérifiés en direct (support `custom_unit_amount`, codes d'erreur SCA exacts, événements disponibles).
- Les URL marquées [S] doivent être relues directement avant toute décision d'architecture figée.
