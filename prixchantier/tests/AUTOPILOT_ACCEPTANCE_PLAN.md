# PrixChantier — Plan de test Autopilote

Objectif : prouver qu'un client peut déposer un DPGF puis fermer son navigateur sans interrompre le cycle achat.

## Critère de sortie

Le produit est considéré vendable lorsque tous les scénarios P0 passent en production sur plusieurs dossiers consécutifs sans intervention manuelle cachée.

## P0 — cœur critique

### 1. Dépôt → analyse automatique
- Déposer un XLSX DPGF standard.
- Ne cliquer sur aucun bouton après l'upload.
- Attendu : `analysis_status` passe automatiquement `pending → running → done`.
- Attendu : les lignes sont extraites, classées et le job autopilote est créé.

### 2. Fonctionnement navigateur fermé
- Mettre un job `auto_launch_project` en file.
- Fermer navigateur / session utilisateur.
- Attendre le cron.
- Attendu : le cron prend le job, il termine en `done`, sans appel manuel.

### 3. Carnet fournisseurs suffisant
- DPGF avec une famille connue.
- 3 fournisseurs compatibles déjà dans le carnet.
- Attendu : maximum 3 consultations sont créées, envoyées avec Excel, relances programmées.

### 4. Sourcing web sans fournisseur local
- Aucun fournisseur compatible dans le carnet.
- Attendu : sourcing Internet de sociétés réelles, e-mail professionnel vérifiable, URL source conservée.
- Attendu : aucune adresse personnelle / inventée.
- Attendu : les fournisseurs trouvés sont ajoutés au carnet et reliés aux bonnes lignes.

### 5. Idempotence
- Rejouer le même job autopilote après succès.
- Attendu : aucun fournisseur recontacté en double, aucune consultation dupliquée, aucun second e-mail.

### 6. Relance automatique
- Fournisseur silencieux.
- Attendre l'échéance de relance.
- Attendu : relance dans le même fil, compteur incrémenté, aucune relance doublée le même jour.

### 7. Réponse fournisseur Excel PrixChantier
- Fournisseur remplit le fichier généré et répond dans le fil.
- Attendu : détection automatique, rattachement, extraction sans IA générique, offre créée, relances annulées.

### 8. Réponse fournisseur PDF
- Répondre avec devis PDF texte.
- Attendu : extraction, correspondance lignes, offre + total + conditions, comparatif mis à jour.

### 9. PDF scanné
- Répondre avec devis image/scanné.
- Attendu : fallback visuel uniquement sur ce document, offre extraite ou erreur visible.

### 10. Réponse partielle
- Certaines lignes non chiffrées.
- Attendu : statut `reponse_partielle`, trous visibles, pas de faux prix.

### 11. Refus fournisseur
- Réponse "nous ne pouvons pas chiffrer".
- Attendu : classification refus, consultation terminée, relances annulées, aucune fausse offre.

### 12. Réponse automatique / absence
- OOO / auto-reply.
- Attendu : ne compte pas comme réponse commerciale, relance conservée.

### 13. Bounce / adresse morte
- Simuler non-remise.
- Attendu : consultation `erreur`, relances annulées, erreur visible.

### 14. Mauvais expéditeur / mail parasite
- Newsletter ou mail sans lien.
- Attendu : non rattaché au dossier, aucune pollution du comparatif.

### 15. Rattachement robuste
Tester successivement :
- même thread ;
- `In-Reply-To` ;
- référence `PC-XXXXXX` dans l'objet ;
- expéditeur unique ;
- ambiguïté.
Attendu : rattachement automatique seulement si sûr ; ambiguïté → action utilisateur, jamais rattachement arbitraire.

### 16. Comparatif final
- 3 offres complètes + 1 partielle.
- Attendu : prix unitaires, totaux, frais de livraison, délais, conditions de paiement, lignes manquantes correctement affichés.

### 17. Arrêt des relances
- Une offre arrive juste avant une relance programmée.
- Attendu : relance annulée avant envoi.

### 18. Reprise après panne
- Forcer une erreur temporaire IA / réseau.
- Attendu : job repasse en file avec backoff puis reprend sans doublon.

### 19. Crédit IA épuisé
- Simuler `credit_balance_exhausted`.
- Attendu : échec définitif clair et visible ; pas de boucle de retries infinie.

### 20. OAuth expiré
- Expirer le token Gmail.
- Attendu : connexion marquée expirée ; aucun envoi silencieusement perdu ; interface demande reconnexion.

## P1 — charge et robustesse

### 21. 10 dossiers parallèles
- 10 DPGF, 3 fournisseurs chacun.
- Attendu : 30 consultations sans doublon ni mélange de dossiers.

### 22. 100 fournisseurs / gros carnet
- Vérifier classement et vitesse de sélection.

### 23. DPGF 1 000+ lignes
- Vérifier extraction, temps, mémoire, sélection des lignes pertinentes.

### 24. Plusieurs pièces jointes
- PDF + Excel + CCTP dans la même réponse.
- Attendu : offre unique cohérente, sources conservées.

### 25. Réponse mise à jour
- Fournisseur renvoie V2 du devis.
- Attendu : nouvelle offre courante ; ancienne version conservée mais exclue du comparatif.

### 26. Deux réponses quasi simultanées
- Même consultation, deux e-mails rapprochés.
- Attendu : aucune course créant deux offres courantes.

### 27. Cron interrompu puis repris
- Laisser plusieurs jobs en attente puis reprendre le cron.
- Attendu : exécution normale, aucune perte.

### 28. Multi-tenant
- Deux entreprises clientes en parallèle.
- Attendu : aucune donnée/fichier/email visible entre organisations.

### 29. Sécurité sourcing
- Fournisseur trouvé sur annuaire non officiel mais aucun e-mail officiel.
- Attendu : rejet.
- E-mail personnel Gmail/Outlook sans preuve officielle.
- Attendu : rejet.

### 30. Qualité sourcing
Pour chaque fournisseur trouvé :
- société existe ;
- vend effectivement la famille ;
- site officiel accessible ;
- e-mail public professionnel ;
- source exacte stockée ;
- lignes `matched_codes` réellement commercialisées.

## P2 — expérience client

### 31. Dashboard autonome
L'écran doit afficher au minimum :
- demandes envoyées ;
- réponses traitées ;
- relances programmées ;
- offres au comparatif ;
- état actuel du pilote ;
- blocage/action requise.

### 32. Transparence
Le client doit pouvoir comprendre en moins de 10 secondes :
- ce qui est déjà fait ;
- ce qui tourne tout seul ;
- ce qui attend une réponse extérieure ;
- ce qui nécessite son action.

### 33. Mobile
Tester création dossier, upload, suivi et comparatif sur iPhone.

## Règle anti-faux positif

Un test n'est pas "passé" parce qu'une ligne existe en base. Pour les étapes externes, vérifier la preuve réelle :
- Gmail pour les envois ;
- boîte entrante pour les réponses ;
- stockage pour les pièces jointes ;
- jobs/cron pour l'exécution autonome ;
- offres/comparatif pour le résultat métier.

## Test de vente final

Faire 3 cycles complets avec de vrais dossiers anonymisés :
1. dossier simple ;
2. dossier avec réponses mixtes (Excel/PDF/refus/silence) ;
3. dossier lourd avec sourcing web.

Succès = aucune intervention technique pendant le cycle normal, hors correction d'une donnée réellement ambiguë.
