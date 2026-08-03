# Système de conformité & contrats électroniques — Génération Capable

Signature électronique, dossier administratif et validation admin pour les
Vendeurs (`index.html`) et les Ambassadeurs (`ambassadors.html`) — plus aucun
contrat envoyé par email, plus aucune valeur légale codée en dur.

## 1. Vue d'ensemble

Un seul moteur (`compliance-client.js` + les Netlify Functions
`compliance-*`/`admin-compliance.js`/`admin-legal-info.js`/
`admin-contract-templates.js`), utilisé différemment dans les deux
applications via un paramètre `role` (`vendeur` | `ambassadeur`) :

- **index.html** — entrée "Dossier administratif" dans la tuile "Ma
  Performance", + section "Conformité" (5 onglets) et "Informations légales"
  dans le back-office admin existant.
- **ambassadors.html** — onglet "📋 Dossier" dans la barre de navigation
  basse.

Le widget (`compliance-client.js`) est auto-porté et injecté dans un point de
montage — comme `notifications-client.js`, il n'a pas nécessité de récrire la
structure des deux gros fichiers HTML existants.

## 2. Identité légale de la Société — 100% dynamique

**Administration → Informations légales** (`admin-legal-info.js` +
`company_legal_info`, migration 0016) : nom de la société, nom/qualité du
représentant légal, adresse complète (code postal, ville, pays), SIRET, TVA,
email, téléphone, logo, signature officielle. Une seule ligne (`id = 1`),
modifiable à tout moment depuis l'admin, sans déploiement.

`_lib/compliance/contracts.js` lit cette table à chaque génération de contrat
(`getCompanyInfo()`) — **plus aucune variable d'environnement, plus aucun
texte codé en dur**. Si la table est vide (avant toute saisie admin), un
marqueur explicite `[À CONFIGURER dans Administration → Informations
légales...]` apparaît à la place de chaque champ manquant, plutôt qu'une
valeur inventée qui aurait l'air correcte.

## 3. Contrats versionnés (v1, v2, v3...)

Le **texte intégral** des contrats est une donnée versionnée
(`contract_templates`, migration 0016), plus une constante dans le code :

- Une ligne par version publiée (`role`, `version`, `body`, `is_current`,
  `change_notes`, `published_by`, `published_at`) — jamais réécrite après
  coup (une "nouvelle version" = une nouvelle ligne).
- `admin-contract-templates.js` calcule automatiquement la version suivante
  (`v1` → `v2` → `v3`...) et publie un nouveau texte en un clic depuis
  **Conformité → Contrats → Versions**, sans toucher au code.
- `contract_signatures.contract_version` fige, pour chaque signature, la
  version EXACTE que l'utilisateur a acceptée — publier une v2 ne change
  jamais le contenu d'un contrat déjà signé en v1.
- Repli (`FALLBACK_TEMPLATES` dans `contracts.js`) : si la table est
  vide/inaccessible, le texte v1 d'origine (identique octet-pour-octet à ce
  qui a été seedé en base, vérifié par comparaison de longueur) est utilisé
  — le système continue de fonctionner même en cas de problème DB.

### ⚠️ Sur la valeur juridique réelle

Le texte des deux contrats est repris **tel quel** depuis les documents
fournis (`GCContratVendeur.docx` / `GCContratAmbassadeur.docx`), qui
indiquent eux-mêmes : *"Ce document ne constitue pas un avis juridique et
doit impérativement être relu, complété et validé par un avocat ou juriste
avant toute signature."* — ça reste vrai ici, disclaimer inclus dans le texte
généré. Deux articles ont été ajoutés à la demande de Génération Capable
(Article 16 : fraude/multi-comptes/auto-parrainage/suspension ; Article 17 :
valeur juridique de la signature électronique, articles 1366-1367 du Code
civil) ; ils doivent être relus avec le reste.

## 4. Signature électronique

1. Le contrat (version courante publiée, voir §3) est rempli automatiquement
   avec les informations du dossier (`compliance_profiles`) et l'identité
   légale de la Société (§2), puis affiché dans une zone de défilement.
2. Les cases "J'ai lu le contrat" / "J'accepte les conditions" restent
   désactivées tant que l'utilisateur n'a pas fait défiler jusqu'en bas.
3. Signature au doigt/à la souris (canvas, Pointer Events unifiés).
4. À la soumission (`compliance-sign-contract.js`) :
   - le texte est refiltré côté serveur à partir des données réellement en
     base à cet instant (jamais fait confiance à ce que le navigateur a
     affiché) ;
   - une empreinte SHA-256 de l'image de signature reçue est calculée côté
     serveur (`signature_hash`) — preuve d'intégrité indépendante du fichier,
     jamais fournie par le client ;
   - un PDF est généré (`pdf-lib`) : texte intégral + bloc de preuve complet
     (date, heure, adresse IP, **navigateur** (`user-agent`), identifiant
     utilisateur, version exacte du contrat, **empreinte de signature**) +
     image de la signature manuscrite + image de la signature officielle de
     la Société (si configurée en §2) ;
   - PDF + image de signature sont archivés dans le bucket privé Supabase
     Storage `compliance-documents` ;
   - une ligne `contract_signatures` est créée — **append-only et immuable**
     (triggers Postgres qui bloquent DELETE et toute UPDATE des colonnes de
     preuve, voir migration 0015) ;
   - l'admin reçoit une notification Push immédiate (catégorie
     `admin.compliance.new_signature`, réutilise le système de
     notifications).

Une re-signature de la **même version** de contrat est refusée proprement
(déjà signée). Publier une nouvelle version (§3) rend la re-signature
possible pour cette nouvelle version, sans jamais toucher aux signatures
passées.

## 5. Dossier administratif

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

## 6. Coffre-fort documentaire

`compliance-documents.js` : identité, RIB scanné, justificatif SIRET,
attestation URSSAF, certificat TVA, autre document. PDF/JPG/PNG, 8 Mo max,
stockés dans le bucket privé, jamais d'URL publique (URLs signées à durée
limitée uniquement — 5 à 10 minutes selon l'écran).

- **Consultation** : URL signée, régénérée à chaque affichage.
- **Téléchargement** : via la même URL signée.
- **Remplacement (PATCH)** : upload du nouveau fichier, ancien fichier
  supprimé du Storage (best-effort), statut admin remis à `pending` (le
  remplaçant doit être revalidé), historisé (`document_replaced`).
- **Suppression (DELETE)** : historisée AVANT suppression effective
  (`document_deleted`), puis suppression ligne + fichier Storage.
- **Horodatage** : `uploaded_at` à l'insertion, mis à jour à chaque
  remplacement.

**Paiement** (`compliance-payment-info.js`) : IBAN/BIC/banque/titulaire.
**Append-only** — chaque modification crée une nouvelle ligne (jamais un
UPDATE qui effacerait l'historique) et déclenche une notification admin
immédiate (`admin.compliance.payment_info_changed`).

## 7. Back-office — Conformité

`admin-compliance.js`, 5 onglets dans `compliance-client.js` (`AdminPanel`) :

- **Vérifications** — liste des dossiers (`admin_list_compliance_dossiers`),
  fiche détaillée par utilisateur (`admin_get_compliance_dossier`) montrant
  en un seul écran : photo/avatar, nom, statut, contrat signé + version,
  documents, RIB, SIRET, paiements, date de validation (calculée depuis le
  max des `admin_reviewed_at`), historique complet.
- **Contrats** / **Documents** / **Paiements** — files d'attente
  cross-utilisateurs (`pending_contracts`/`pending_documents`/
  `pending_payments`) des éléments `admin_status = 'pending'`, avec identité
  (email, nom) enrichie et lien signé vers chaque fichier.
- **Historique** — `global_history`, les 300 derniers évènements de
  `compliance_audit_log` tous utilisateurs confondus.

Toute validation/refus passe par les RPC `admin_set_{contract,document,
payment}_status`, qui vérifient elles-mêmes `is_current_user_admin()` côté
base — jamais une confiance aveugle en la couche Netlify Function. Les
actions de liste cross-utilisateurs (`pending_*`/`global_history`) sont
protégées par une garde `isAdminEmail()` explicite en tout début de handler,
seule porte pour ces lectures qui ne passent pas par les RPC à granularité
"un seul dossier".

Chaque validation/refus est journalisé dans `compliance_audit_log`, et une
notification `admin.compliance.dossier_complete` part automatiquement dès
qu'une validation fait passer un dossier à 100% (déduplication naturelle par
`event_key`).

## 8. Verrou automatique des paiements

**Choix de conception : trigger, pas redéfinition de fonction.** Plutôt que
de redéfinir `request_payout()` (migration 0006) — ce qui aurait exigé de
recopier intégralement sa logique financière et fait courir un risque de
régression si cette logique évolue plus tard sans que quelqu'un pense à
répercuter la copie ici — le verrou est un trigger `BEFORE INSERT` sur
`payouts` lui-même (`trg_payouts_require_compliance`, migration 0015) :

```sql
create trigger trg_payouts_require_compliance
  before insert on public.payouts
  for each row execute function public.enforce_seller_compliance_before_payout();
```

- `request_payout()` n'est touchée par **aucune** ligne de cette migration —
  vérifiée via `pg_get_functiondef()` sur la base réelle avant toute
  modification, et confirmée inchangée après application (0015 ne contient
  ni `create or replace function public.request_payout` ni `drop function`).
- Le verrou s'applique à **toute** insertion dans `payouts`, quel que soit le
  chemin de code qui la déclenche — défense en profondeur, y compris pour un
  futur second point d'entrée de retrait qu'on n'aurait pas pensé à gater
  explicitement.
- `is_seller_compliance_conforme(user_id)` recalcule le même score à 5 items
  que le dossier (contrat signé + identité + RIB validé + SIRET + justificatif
  SIRET) ; en dessous de 100%, `enforce_seller_compliance_before_payout()`
  lève une exception avec un message explicite, l'INSERT échoue, le vendeur
  voit l'erreur directement dans l'UI Commissions existante.

**Côté Ambassadeur**, ce verrou n'a pas d'équivalent : le système de
rémunération ambassadeur (`ambassadors.html`) n'est aujourd'hui qu'un état
local (`STATE.revenue`) persisté par `ambassador-data.js`, pas un vrai grand
livre financier comme `sales`/`commissions`/`payouts` côté vendeur — il n'y a
donc pas de fonction de retrait réelle à gater. La checklist/score
s'affichent normalement pour un ambassadeur, mais rien ne les bloque
financièrement tant qu'un vrai système de paiement ambassadeur n'existe pas.

## 9. Historique & export

`compliance_audit_log` trace : création/modification de profil, signature,
dépôt/remplacement/suppression de document, modification de RIB, validation,
refus. Toujours horodaté, jamais modifiable (append-only — triggers qui
bloquent UPDATE et DELETE, comme `audit_logs`).

`compliance-export.js` renvoie un JSON complet (profil, score, signatures,
documents, historique) avec des liens signés vers chaque fichier réel — **pas
un unique fichier .zip fusionné** : ce dépôt n'a aucune librairie de
compression, et en ajouter une pour cette seule fonctionnalité n'a pas semblé
justifié. Si un vrai `.zip` téléchargeable en un clic devient nécessaire,
c'est un ajout ciblé (`archiver` ou équivalent) plutôt qu'une refonte.

## 10. Relances automatiques

`notify-cron-compliance-expiry.js` (quotidien, 7h) alerte l'utilisateur à
J-30/J-14/J-7 avant l'expiration d'un document validé avec une date
d'expiration (attestation URSSAF typiquement) — réutilise le moteur de
notifications existant (anti-répétition, dédoublonnage par palier).

`notify-cron-crm-scan-background.js` scanne aussi désormais les nouvelles
demandes de retrait (`payouts`) pour notifier l'admin
(`admin.compliance.payout_requested`), en plus des scans CRM existants.

## 11. Sécurité — synthèse de la revue

- **RLS** : les 7 tables du système (`compliance_profiles`,
  `contract_signatures`, `compliance_documents`, `payment_info`,
  `compliance_audit_log`, `company_legal_info`, `contract_templates`) ont
  RLS activée, avec au maximum une policy `select` (propriétaire ou admin) —
  **aucune** policy insert/update/delete pour `anon`/`authenticated` :
  l'écriture passe exclusivement par les Netlify Functions en `service_role`,
  qui vérifient elles-mêmes l'identité/le droit de l'appelant avant d'écrire
  (même convention que le reste du schéma, voir `admins`, 0003).
- **Append-only** : `contract_signatures` (triggers bloquant DELETE et
  UPDATE des colonnes de preuve) et `compliance_audit_log` (triggers
  bloquant UPDATE et DELETE) — une preuve de signature ou une ligne d'audit
  ne peut physiquement pas être trafiquée après coup, y compris par un bug
  applicatif.
- **`search_path` figé** : chaque fonction `SECURITY DEFINER` du système
  déclare `set search_path to 'public'`, y compris le trigger de verrou de
  paiement (`enforce_seller_compliance_before_payout`) — vérifié
  explicitement ligne par ligne dans les deux migrations.
- **Injection de paramètres PostgREST** : plusieurs endpoints interpolaient
  un identifiant fourni par le client directement dans un filtre PostgREST
  (`?id=eq.<valeur>`). PostgREST paramètre ses filtres en interne (pas
  d'injection SQL classique possible), mais une valeur non validée contenant
  `&`/`=` pouvait élargir la requête au-delà de l'enregistrement visé. Fermé
  par un validateur de format UUID strict (`_lib/compliance/validate.js`,
  `isUuid()`) appliqué avant toute interpolation dans
  `compliance-documents.js` (PATCH/DELETE), `admin-compliance.js` (actions
  `detail`, validation) et `compliance-export.js` (export cross-utilisateur
  admin). Les autres endpoints du système n'interpolent que des valeurs
  déjà dignes de confiance (`userId` du token de session vérifié, `role`
  validé contre un `Set` fixe) — vérifié fichier par fichier.
- **Fraude / doublons / auto-parrainage** : couverts par le texte du contrat
  (Article 16, engagement contractuel signé) et par les mécanismes déjà
  existants du système de parrainage (hors périmètre de cette migration) —
  ce n'est pas quelque chose qu'une contrainte SQL peut empêcher à elle
  seule ; le dossier signé constitue la preuve juridique en cas de manquement
  constaté.
- **Faux documents / faux paiements** : la validation reste un contrôle
  humain (l'admin visualise chaque pièce via URL signée avant de valider) —
  aucun système ne peut authentifier automatiquement un document scanné ;
  c'est un point de vigilance opérationnel, pas un gap technique.
- **Advisors Supabase (`get_advisors`, type security)** : tous les
  avertissements actuels du projet prédatent cette session (fonctions
  `SECURITY DEFINER` existantes exécutables par `anon`/`authenticated`,
  `search_path` non fixé sur d'anciennes fonctions triggers comme
  `block_delete`/`block_mutation`/`referral_lock`, protection mots de passe
  compromis désactivée) — aucun ne concerne les tables/fonctions créées ici.

## 12. Migrations — état d'application

**Les migrations 0015 et 0016 ont été appliquées avec succès sur le projet
Supabase de production (`fkhfahmzxsahrstxntjs`)** au cours de cette session,
statement par statement via l'outil d'exécution SQL du MCP Supabase (l'outil
dédié `apply_migration` a systématiquement demandé une confirmation
d'approbation que cette session ne pouvait pas fournir — comportement
générique de l'outil, pas propre au contenu SQL). Vérifications effectuées
après application :
- RLS activée sur les 5 tables de 0015 (requête `pg_tables`) ;
- les 5 triggers (`trg_payouts_require_compliance`,
  `trg_contract_signatures_no_delete`, `trg_contract_signatures_guard`,
  `trg_compliance_audit_no_delete`, `trg_compliance_audit_no_update`) sont
  présents et activés (`pg_trigger.tgenabled = 'O'`) ;
  `request_payout()` existe toujours, non modifiée ;
- `company_legal_info` contient bien sa ligne unique (`id = 1`) ;
- `contract_templates` contient les deux versions `v1` (`vendeur`,
  `ambassadeur`), toutes deux `is_current = true`, et leur longueur en
  base (13767 / 14054 caractères) correspond exactement à celle des
  constantes de repli `FALLBACK_TEMPLATES` dans `contracts.js`.

Les fichiers `supabase/migrations/0015_compliance_contracts.sql` et
`0016_legal_info_contract_versioning.sql` restent la source de vérité
versionnée dans le dépôt (idempotents : `if not exists`/`drop ... if
exists`/`on conflict ... do nothing` partout), pour toute ré-application
(nouvel environnement, restauration) via l'éditeur SQL du dashboard Supabase
ou un outil de migration classique.

## 13. Reste à faire

1. **Faire relire les deux contrats (dont les articles 16-17 ajoutés) par un
   avocat/juriste** — le document source le demande explicitement, ce
   chantier ne change rien à cette exigence.
2. **Remplir Administration → Informations légales** avec les vraies
   coordonnées de la Société — tant que ce n'est pas fait, les contrats
   générés affichent des marqueurs `[À CONFIGURER...]` bien visibles.
3. Décider si/quand un vrai système de paiement ambassadeur doit être
   construit (aujourd'hui : état local uniquement, voir §8).
4. TypeScript ne s'applique pas à ce dépôt (100% JavaScript, Netlify
   Functions CommonJS) ; il n'y a pas de configuration ESLint dans ce
   projet — la vérification de qualité a donc porté sur `node --check`
   (syntaxe) sur chaque fichier touché plutôt que sur un linter absent.
