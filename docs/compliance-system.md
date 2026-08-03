# Système de conformité & contrats électroniques — Génération Capable

Signature électronique, dossier administratif et validation admin pour les
Vendeurs (`index.html`) et les Ambassadeurs (`ambassadors.html`) — plus aucun
contrat envoyé par email.

## 1. Vue d'ensemble

Un seul moteur (`compliance-client.js` + les Netlify Functions
`compliance-*`/`admin-compliance.js`), utilisé différemment dans les deux
applications via un paramètre `role` (`vendeur` | `ambassadeur`) :

- **index.html** — nouvelle entrée "Dossier administratif" dans la tuile
  "Ma Performance", + section "Contrats & dossiers à valider" dans le
  back-office admin existant.
- **ambassadors.html** — nouvel onglet "📋 Dossier" dans la barre de
  navigation basse.

Le widget (`compliance-client.js`) est auto-porté et injecté dans un point de
montage — comme `notifications-client.js`, il n'a pas nécessité de récrire la
structure des deux gros fichiers HTML existants.

## 2. Signature électronique

1. Le contrat (texte intégral, voir `netlify/functions/_lib/compliance/contracts.js`)
   est rempli automatiquement avec les informations du dossier
   (`compliance_profiles`) et affiché dans une zone de défilement.
2. Les cases "J'ai lu le contrat" / "J'accepte les conditions" restent
   désactivées tant que l'utilisateur n'a pas fait défiler jusqu'en bas.
3. Signature au doigt/à la souris (canvas, Pointer Events unifiés).
4. À la soumission (`compliance-sign-contract.js`) :
   - le texte est refiltré côté serveur à partir des données réellement en
     base à cet instant (jamais fait confiance à ce que le navigateur a
     affiché) ;
   - un PDF est généré (`pdf-lib`) : texte intégral + bloc de preuve (date,
     heure, IP, identifiant utilisateur, version) + image de la signature ;
   - PDF + image de signature sont archivés dans le bucket privé Supabase
     Storage `compliance-documents` ;
   - une ligne `contract_signatures` est créée — **append-only et immuable**
     (triggers Postgres qui bloquent DELETE et toute UPDATE des colonnes de
     preuve, voir migration 0015) ;
   - l'admin reçoit une notification Push immédiate (catégorie
     `admin.compliance.new_signature`, réutilise le système de notifications).

Une re-signature de la **même version** de contrat est refusée proprement
(déjà signée). Si le texte du contrat change, `CONTRACT_VERSIONS` dans
`contracts.js` doit être incrémenté — ça crée une nouvelle ligne de
signature, sans jamais toucher à l'ancienne.

### ⚠️ Sur la valeur juridique réelle

Le texte des deux contrats est repris **tel quel** depuis les documents
fournis (`GCContratVendeur.docx` / `GCContratAmbassadeur.docx`), qui
indiquent eux-mêmes : *"Ce document ne constitue pas un avis juridique et
doit impérativement être relu, complété et validé par un avocat ou juriste
avant toute signature."* — ça reste vrai ici. Deux articles ont été ajoutés
à la demande de Génération Capable (fraude/multi-comptes/auto-parrainage/
suspension, et valeur juridique de la signature électronique — articles
1366-1367 du Code civil) ; ils doivent être relus avec le reste.

**L'identité légale de la Société n'est pas connue avec certitude par ce
code** (SIRET, adresse du siège, nom et qualité du représentant légal). Tant
que les variables d'environnement `COMPANY_LEGAL_REP_NAME`,
`COMPANY_LEGAL_REP_TITLE`, `COMPANY_SIRET`, `COMPANY_ADDRESS` ne sont pas
configurées sur Netlify, le contrat généré affiche des marqueurs explicites
`[À CONFIGURER...]` plutôt qu'une valeur inventée qui aurait l'air correcte.
**Aucun contrat ne doit être considéré comme valable tant que ces variables
ne sont pas remplies avec les vraies informations légales.**

## 3. Dossier administratif

Onglets : Résumé (checklist + score), Informations (personnelles + pro),
Contrat, Documents, Paiement, Historique.

Score de conformité (0-100%, 20% par item, calculé en direct — jamais un
statut stocké qu'on pourrait faire mentir) :
1. Contrat signé
2. Pièce d'identité déposée
3. RIB **validé par un admin**
4. SIRET renseigné
5. Justificatif SIRET déposé

`dossier_status = 'conforme'` uniquement à 100%. L'animation "Votre dossier
est validé" s'affiche côté client au moment où ce seuil est atteint après une
action de l'utilisateur (signature, dépôt de document).

## 4. Documents & paiement

- **Documents** (`compliance-documents.js`) : identité, RIB scanné,
  justificatif SIRET, attestation URSSAF, certificat TVA. PDF/JPG/PNG, 8 Mo
  max, stockés dans le bucket privé, jamais d'URL publique (URLs signées à
  durée limitée uniquement).
- **Paiement** (`compliance-payment-info.js`) : IBAN/BIC/banque/titulaire.
  **Append-only** — chaque modification crée une nouvelle ligne (jamais un
  UPDATE qui effacerait l'historique) et déclenche une notification admin
  immédiate (`admin.compliance.payment_info_changed`).

## 5. Validation admin

Back-office `admin-compliance.js` (RPC `admin_list_compliance_dossiers` /
`admin_get_compliance_dossier` / `admin_set_{contract,document,payment}_status`)
— tout est vérifié côté base (`is_current_user_admin()`), jamais seulement
côté Netlify Function. Chaque validation/refus est journalisé dans
`compliance_audit_log`.

## 6. Verrou commissions

`request_payout()` (fonction Postgres existante, décrite dans la migration
0006) a été **redéfinie pour ajouter une seule garde en tout début de
fonction** — le reste de la logique financière est repris à l'identique
(vérifié via `pg_get_functiondef()` sur la base réelle avant modification,
jamais réécrit de mémoire) :

```sql
if not public.is_seller_compliance_conforme(auth.uid()) then
  raise exception 'Dossier administratif incomplet : ...';
end if;
```

Un vendeur dont le dossier n'est pas conforme à 100% ne peut donc **pas**
demander de retrait, quel que soit son solde. Message d'erreur affiché
directement dans l'UI existante (`index.html`, écran Commissions).

**Côté Ambassadeur**, ce verrou n'a pas d'équivalent : le système de
rémunération ambassadeur (`ambassadors.html`) n'est aujourd'hui qu'un état
local (`STATE.revenue`) persisté par `ambassador-data.js`, pas un vrai grand
livre financier comme `sales`/`commissions`/`payouts` côté vendeur — il n'y a
donc pas de fonction de retrait réelle à gater. La checklist/score
s'affichent normalement pour un ambassadeur, mais rien ne les bloque
financièrement tant qu'un vrai système de paiement ambassadeur n'existe pas.

## 7. Historique & export

`compliance_audit_log` trace : création/modification de profil, signature,
dépôt de document, modification de RIB, validation, refus. Toujours
horodaté, jamais modifiable (append-only, comme `audit_logs`).

`compliance-export.js` renvoie un JSON complet (profil, score, signatures,
documents, historique) avec des liens signés vers chaque fichier réel — **pas
un unique fichier .zip fusionné** : ce dépôt n'a aucune librairie de
compression, et en ajouter une pour cette seule fonctionnalité n'a pas semblé
justifié. Si un vrai `.zip` téléchargeable en un clic devient nécessaire,
c'est un ajout ciblé (`archiver` ou équivalent) plutôt qu'une refonte.

## 8. Relances automatiques

`notify-cron-compliance-expiry.js` (quotidien, 7h) alerte l'utilisateur à
J-30/J-14/J-7 avant l'expiration d'un document validé avec une date
d'expiration (attestation URSSAF typiquement) — réutilise le moteur de
notifications existant (anti-répétition, dédoublonnage par palier).

## 9. Ce qui reste à faire avant mise en production réelle

1. **Configurer les 4 variables d'environnement de l'identité légale**
   (`COMPANY_LEGAL_REP_NAME`, `COMPANY_LEGAL_REP_TITLE`, `COMPANY_SIRET`,
   `COMPANY_ADDRESS`) — sans ça, les contrats générés portent des
   marqueurs "à compléter" bien visibles.
2. **Faire relire les deux contrats (dont les 2 articles ajoutés) par un
   avocat/juriste** — le document source le demande explicitement, ce
   chantier ne change rien à cette exigence.
3. **Appliquer la migration `supabase/migrations/0015_compliance_contracts.sql`**
   sur le projet Supabase — voir note ci-dessous, cette étape n'a pas pu être
   faite automatiquement dans cette session.
4. Décider si/quand un vrai système de paiement ambassadeur doit être
   construit (aujourd'hui : état local uniquement, voir section 6).

### Note sur l'application de la migration

Cette migration modifie `request_payout()`, une fonction financière en
production — l'outil d'application de migrations a demandé une confirmation
explicite qui n'a pas pu aboutir automatiquement dans cette session (garde de
sécurité, pas un bug). Deux options :
- Réessayer l'appel outillé (il redemandera confirmation) ;
- Ou exécuter directement le contenu de
  `supabase/migrations/0015_compliance_contracts.sql` dans l'éditeur SQL du
  dashboard Supabase (projet `fkhfahmzxsahrstxntjs`).

Le fichier est idempotent (`if not exists` / `drop ... if exists` partout) et
a été vérifié ligne par ligne contre le schéma réellement en production
(notamment `request_payout()`, recopiée exactement via
`pg_get_functiondef()` avant modification, pour ne jamais risquer de casser
la logique de retrait existante).
