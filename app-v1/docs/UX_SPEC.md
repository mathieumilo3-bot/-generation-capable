# Spécification UX/produit (référence des écrans)

Principe : **Clarté → Simplicité → Confiance → Fonctionnalités.** « J'envoie → je choisis → ça monte → je récupère. »
À tout instant l'utilisateur sait : où il est, ce qu'il peut faire, combien ça coûte, ce qui se passe, où retrouver son travail.
Ne jamais afficher : FFmpeg, Deepgram, LLM, worker, queue, encoding, executor. Le client voit des **euros**, jamais des crédits.
Avant d'ajouter un bouton : « un client normal en a-t-il besoin pour obtenir sa vidéo ? » Sinon → caché ou « Plus d'options » (fermé par défaut).

## Direction artistique
Apple > Linear > Stripe. Fond blanc, surfaces #F5F5F7, texte #1D1D1F / #6E6E73, bordures #E5E5EA, accent rouge #FF3B30 (pressé #D70015) **rare** :
CTA principaux, éléments actifs, marque. Succès #34C759, warning #FF9F0A. Pas de dégradés, néons, ombres lourdes, « violet IA », cartes inutiles.
Police système. Large title 34, title 28, section 21, body 17, bouton 17 semibold, secondaire 15, caption 13. Rayon 18–22, boutons hauts (56), champs 56.
Animations 150–250 ms, haptique discrète (confirmation, paiement réussi, vidéo prête, erreur importante). Respecter « réduire les animations ».
Les composants sont dans `@app/ui` (tokens, Button, Card, Input, Screen, Sheet, Chip, Badge, ProgressBar, StepList, Notice, EmptyState, Row/Section).

## Navigation (mobile)
Barre inférieure, 4 espaces : **Accueil · Créer · Projets · Compte** ; « Créer » = action centrale, la plus évidente.
Web desktop : contenu centré (max 560–720 px), grandes zones blanches ; pas de dashboard B2B.

## Connexion (§5-6)
Premier écran (non connecté) : logo, nom, phrase simple, aperçu premium, CTA « Créer ma première vidéo » → auth.
Écran auth : titre « Bienvenue », sous-titre « Créez vos vidéos, nous nous occupons du montage. »
[Continuer avec Apple] [Continuer avec Google] ──ou── [Continuer avec mon e-mail] (code à 6 chiffres, pas de mot de passe).
Après la 1re connexion : directement l'accueil, aucun questionnaire. Apple obligatoire dès qu'un login tiers existe (guideline 4.8).

## Accueil (§8)
« Bonjour, {prénom} » · SOLDE DISPONIBLE **26,40 €** · « Ajouter » discret · très gros CTA « Créer une vidéo » ·
« En cours » (seulement s'il y a des jobs actifs : titre, « Création en cours », %) · « Récentes » (3–6 miniatures) + « Voir tous les projets ».

## Flow Créer (§13-19)
1. « Comment voulez-vous créer votre vidéo ? » — deux grosses options : **J'ai mes rushs** (« Envoyez vos vidéos, nous faisons le montage. »)
   et **Créez tout pour moi** (« Donnez votre idée, nous créons la vidéo. ») — **cette 2e option n'est affichée que si `capabilities.autonomous_creation`** (aujourd'hui faux).
2. Rushs : « Ajoutez vos vidéos » — grand bloc d'upload (Galerie / Fichiers / Caméra), progression propre « 3 vidéos ajoutées · 428 Mo / 1,2 Go »,
   « Vous pouvez quitter cet écran pendant l'envoi. », reprise, retry, annulation, perte de réseau gérée.
3. Durée : « Quelle durée voulez-vous ? » — cartes avec **prix visible immédiatement** (règles `pricing_rules` du serveur, jamais codées en dur).
4. Style : « Quel résultat voulez-vous ? » — **Automatique** (badge « Recommandé », « L'IA choisit le montage le plus adapté. »),
   **Mode Référence** (« Reproduit la grammaire de montage de vos références. » → demande 1+ vidéo de référence),
   **Personnalisé** (« Expliquez exactement ce que vous voulez. » → champ texte « Que souhaitez-vous changer ou mettre en avant ? », placeholder
   « Ex. : rythme rapide, sous-titres dynamiques, beaucoup de B-roll et une intro forte. » + dictée vocale). « Plus d'options » **fermé par défaut**
   (méthodes `advanced`). Les méthodes viennent de `editing_methods_public` filtrées par `usableMethods`.
5. Récapitulatif — « Tout est prêt. » Vidéo : 30–60 s · Type · Style · Format Vertical 9:16 · Fichiers : 7 · Prix 4,84 € · Solde actuel 26,40 € ·
   Après création 21,56 € · bouton rouge **« Créer ma vidéo · 4,84 € »** · « En cas d'échec définitif du rendu, le montant réservé est automatiquement libéré. »
   Les montants viennent de `quote_video_job` (serveur). Une clé d'idempotence par intention ; bouton désactivé pendant l'envoi.
6. Solde insuffisant : « Il manque 1,24 € pour créer cette vidéo. » → bouton « Ajouter 10 € » (montant suggéré) puis « Autre montant » ;
   après paiement réussi **retour automatique au récapitulatif**, sans recommencer.

## Traitement (§20) et résultat (§22-23)
Étapes humaines : Préparation · Analyse · Création du montage · Finalisation · Contrôle qualité → « Votre vidéo est prête ». Progression réelle (Realtime + polling
de repli) ; pas de fausse barre. L'utilisateur peut fermer l'app (notification push).
Résultat : grand lecteur ; primaire **Télécharger** ; secondaires Partager · Modifier · Créer une nouvelle version ; menu Renommer/Dupliquer/Supprimer ; « Version 1 » discret.
Modifier : « Que voulez-vous modifier ? » (ex. « Raccourcis l'intro et enlève le B-roll vers 00:18 ») — **prix affiché AVANT validation** (`quote_video_job` kind=revision) ;
crée Version 2 (`parent_version_id`) sans écraser la précédente. Le moteur n'accepte qu'un menu fermé de commandes : afficher des suggestions rapides
(`REVISION_COMMAND_LABEL`) et utiliser `planRevision` pour dire honnêtement ce qui sera / ne sera pas appliqué.

## Projets (§24, §42)
« Mes vidéos » : grille de miniatures (titre, durée, date, statut), filtres Tous · En cours · Terminés, recherche. Projet : vidéo actuelle, versions, rushs, actions.
États vides partout (ex. « Aucune vidéo pour le moment. » + « Créer ma première vidéo »).

## Wallet & paiements (§10-12, §25-29)
Compte > Paiements : Solde · Ajouter de l'argent · Recharge automatique · Historique. Recharge min 10 € (réglage serveur). Web : montant libre ≥ min + préréglages
(10, 20, 25, 50, 100, 250 €) + « Autre montant ». Stores : packs fixes (pas de montant libre, pas d'auto-reload silencieux → notification « solde faible » + recharge en un geste).
Recharge automatique (seulement si `payments.autoReload`) : seuil, montant, plafond mensuel (100/250/500 € ou personnalisé), activer/désactiver/modifier, voir les recharges.
Paiement refusé : « Le paiement n'a pas pu être validé. » « Votre solde n'a pas été modifié. » [Réessayer] puis « Utiliser un autre moyen de paiement ».
Historique : « +25,00 € Recharge Aujourd'hui », « −4,84 € Montage vidéo », « +4,84 € Montant libéré — rendu annulé » ; chaque ligne ouvre un détail.
Le wallet n'est JAMAIS crédité par le client : seulement après confirmation serveur (webhook Stripe / reçu vérifié).

## Compte (§31-32, §40-41)
Profil · Paiements · Facturation (nom/entreprise, adresse, pays, TVA, e-mail de facturation, reçus) · Notifications (centre interne) · Confidentialité (politique,
conditions, gestion des données, **Supprimer mon compte** : explication → confirmation → réauth → suppression ; « Cette action supprimera définitivement vos projets et données concernés. »)
· Aide (FAQ, Signaler un problème avec project_id/job_id/version_id/app_version/platform joints automatiquement, Contacter le support) · Déconnexion.
Ne jamais promettre « chiffré de bout en bout ». Garanties réelles : RLS, URLs signées, accès privé, HTTPS, séparation des clients.

## Erreurs (§43) et accessibilité (§44)
Chaque erreur répond : Qu'est-ce qui s'est passé ? Mon argent est-il en sécurité ? Que puis-je faire ? → `humanizeError(code, ctx)` de `@app/domain` (jamais de message technique brut).
VoiceOver/TalkBack (labels, rôles, états), Dynamic Type (ne pas figer les hauteurs de texte), contrastes AA, navigation clavier web, réduction des animations, zones tactiles ≥ 44/48.
