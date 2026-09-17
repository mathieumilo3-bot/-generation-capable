# Net & Care — site d'acquisition locale

Site vitrine **orienté conversion** pour Net & Care, entreprise de nettoyage textile
et de remise en état basée à Cannes (Antibes, Grasse et alentours).

**Le système de devis de Net & Care, c'est WhatsApp.** Il fonctionne, on ne le
remplace pas. Le site construit les portes d'entrée qui manquent autour, et tout
ramène au même endroit :

```
Google   →  pages locales  ─┐
TikTok   →  /avant-apres   ─┼→  WhatsApp / appel  →  Client
Direct   →  accueil        ─┘        ↑
                          estimation en ligne (facultative)
```

| Porte | Ce qu'elle capte | Où elle mène |
|---|---|---|
| **Google** | Intention forte : « nettoyage canapé Cannes » | 7 pages locales → estimation ou WhatsApp |
| **Site** | Vérification : « est-ce que cette entreprise est sérieuse ? » | Preuve, avis, zones → WhatsApp |
| **TikTok** | Curiosité : quelqu'un qui ne vous connaissait pas | `/avant-apres` → WhatsApp en un geste |

L'estimation en ligne **qualifie** (prestation, dimensions, état, photos, ville)
mais n'est jamais un passage obligé : un bouton « Envoyer sur WhatsApp » est
présent à chaque étape et part avec ce qui a déjà été saisi. Quelqu'un qui veut
écrire tout de suite écrit tout de suite.

Chaque élément de page a une fonction commerciale. Tout ce qui n'en avait pas a été
laissé de côté.

---

## 1. À faire avant la mise en ligne

Le site est complet et fonctionnel, mais **quatre informations manquent encore** :
elles n'étaient pas dans le dossier projet. Tant qu'elles ne sont pas renseignées,
le script de build les rappelle à chaque exécution.

| Ce qui manque | Où le renseigner | Conséquence si oublié |
|---|---|---|
| **Numéro de téléphone et WhatsApp** | `site.config.json` → `contact` | Les boutons d'appel et WhatsApp ne fonctionnent pas |
| **Email de réception des devis** | `site.config.json` → `contact.emailDevis` *(ou la variable Netlify `NETCARE_DEVIS_EMAIL`)* | Les demandes n'arrivent nulle part |
| **Informations légales** (raison sociale, SIRET, adresse, TVA) | `site.config.json` → `entreprise` | Mentions légales incomplètes — obligation légale |
| **Photos réelles et avis Google** | `assets/img/` et `src/data/avis.js` | Le site affiche des visuels et des avis d'exemple |
| **Comptes TikTok et Instagram** | `site.config.json` → `contact.tiktok` / `instagram` | Les liens réseaux pointent vers des comptes inexistants |

Puis, à chaque modification de `site.config.json` :

```bash
npm run build:netcare       # depuis la racine du dépôt
```

### Les photos

Les visuels livrés sont des **placeholders assumés** (texture textile + silhouette,
avec la mention « Visuel provisoire » en bas à gauche). Ils permettent de démontrer
le site immédiatement, pas de le mettre en ligne tel quel.

Pour les remplacer : déposer les vraies photos dans `assets/img/` et remplacer les
chemins dans `src/pages/index.html` et `src/local-pages.js`. La convention de nommage
attendue est `<prestation>-avant.jpg` / `<prestation>-apres.jpg` :

```
canape-avant.jpg      canape-apres.jpg
matelas-avant.jpg     matelas-apres.jpg
tapis-avant.jpg       tapis-apres.jpg
moquette-avant.jpg    moquette-apres.jpg
```

Les paires avant / après doivent être **cadrées identiquement** (même angle, même
distance, si possible même lumière) : le curseur de comparaison ne fonctionne
visuellement que si les deux images se superposent. Format conseillé : 4/3,
1600 px de large, JPEG optimisé sous 300 Ko.

### Les avis

`src/data/avis.js` contient trois avis d'exemple, explicitement marqués comme tels.
**Ils doivent être remplacés par de vrais avis Google avant la mise en ligne.**
Publier des témoignages inventés sous le nom de Net & Care est une pratique
commerciale trompeuse (art. L121-2 du code de la consommation) et expose la fiche
Google à une sanction.

Une fois les vrais avis collectés, renseigner `preuve.noteGoogle` et
`preuve.nombreAvis` dans `site.config.json` et passer `afficherNoteDansSchema` à
`true` : la note est alors publiée dans les données structurées et peut apparaître
en étoiles dans les résultats Google.

---

## 2. Structure

```
net-and-care/
├── site.config.json          ← LE fichier à modifier (téléphone, prix, zones, délais)
├── netlify.toml              ← déploiement du site client (indépendant de generationcapable.fr)
│
├── index.html                ┐
├── devis.html                │
├── nettoyage-canape-cannes.html
├── nettoyage-canape-antibes.html
├── nettoyage-canape-grasse.html
├── nettoyage-matelas-cannes.html
├── nettoyage-tapis-cannes.html
├── nettoyage-moquette-cannes.html
├── nettoyage-fin-de-chantier-cannes.html
├── avant-apres.html          │  ← porte TikTok (« lien en bio »)
├── mentions-legales.html     │  ← PAGES GÉNÉRÉES : ne pas éditer à la main,
├── confidentialite.html      │     toute modification serait écrasée au build
├── 404.html                  │
├── sitemap.xml               │
├── robots.txt                ┘
│
├── src/                      ← LES SOURCES, c'est ici qu'on écrit
│   ├── layout.html               gabarit commun (head, SEO, scripts)
│   ├── layout-bio.html           gabarit dépouillé de la page TikTok
│   ├── partials/                 en-tête, pied de page, barre d'action, simulateur
│   ├── pages/                    pages rédigées à la main (accueil, devis, avant/après, légal)
│   ├── templates/local.js        gabarit des pages locales
│   ├── local-pages.js            contenu des 7 pages locales
│   └── data/                     avis clients, cartes prestations
│
├── assets/
│   ├── css/netcare.css           feuille de style unique
│   ├── js/site.js                comportements de page
│   ├── js/simulateur.js          le simulateur de devis
│   ├── js/config.generated.js    GÉNÉRÉ depuis site.config.json
│   └── img/                      visuels (provisoires) + favicon + image de partage
│
├── netlify/functions/
│   ├── netcare-devis.js          réception des demandes (email + archivage + photos)
│   └── _lib/                     Supabase et limitation de débit
│
└── tools/
    ├── build.js                  génère les pages HTML, le sitemap et robots.txt
    ├── make-visuals.js           régénère les visuels provisoires
    └── og-source.html            source de l'image de partage réseaux sociaux
```

### Pourquoi un générateur plutôt que des fichiers HTML écrits à la main

Treize pages partagent le même en-tête, le même pied de page et le même simulateur.
Écrites à la main, changer un numéro de téléphone imposerait treize modifications — et
une seule oubliée suffit à perdre des appels. Le générateur produit du **HTML statique
pur, versionné dans le dépôt** : Netlify ne compile rien, et Google indexe du vrai
contenu, pas une coquille remplie en JavaScript.

---

## 3. L'estimation en ligne

Six étapes, conçues pour être franchies au pouce sur un téléphone. Son rôle est de
**qualifier** — pas de remplacer WhatsApp :

| # | Étape | Ce qu'on récupère |
|---|---|---|
| 1 | Prestation | Canapé, matelas, tapis, moquette, fin de chantier, autre |
| 2 | Détails | Places / dimensions / surface, état, options |
| 3 | Localisation | Ville et délai souhaité |
| 4 | Photos | Jusqu'à 4 photos, compressées dans le navigateur |
| 5 | **Estimation** | Fourchette indicative + récapitulatif |
| 6 | Coordonnées | Nom, téléphone, email, précisions, consentement |

Puis une confirmation avec un bouton **WhatsApp au message déjà rédigé** (toutes les
réponses + la référence de la demande).

### Le raccourci WhatsApp, à chaque étape

Sous les boutons de navigation, à toutes les étapes : « Vous préférez écrire
directement ? → Envoyer sur WhatsApp ». Le message part avec **ce qui a déjà été
saisi à cet instant précis**, et seulement cela : tant qu'une étape n'a pas été
franchie, ses valeurs par défaut (« usage courant », « dans la semaine ») ne sont
pas transmises comme si elles avaient été choisies. Le message est donc exact,
qu'on parte à l'étape 1 ou à l'étape 5.

C'est ce qui empêche le formulaire de devenir un péage. L'événement
`devis_whatsapp_direct` remonte l'étape à laquelle le raccourci a été utilisé :
si beaucoup de monde part à l'étape 2, c'est que l'étape 2 est trop longue.

### Les prix

**Aucun prix n'est écrit en dur dans le code.** Tout vient de `site.config.json` →
`tarifs`, qui alimente le simulateur via `assets/js/config.generated.js`.

La formule : `(base + unité × quantité) × coefficient d'état + options + déplacement`,
puis une fourchette de ±12 % arrondie à 5 €.

Le site n'annonce jamais un prix ferme. Il affiche « estimation indicative » et
précise partout que le montant est confirmé par Net & Care après analyse. C'est à la
fois honnête et protecteur : un prix ferme affiché en ligne engage l'entreprise.

Les tableaux de tarifs des pages locales (`src/local-pages.js`) sont écrits à la main
et doivent rester **cohérents avec la grille** — c'est le seul endroit à mettre à jour
en parallèle après un changement de tarif.

### Trois garde-fous

1. **Ne jamais perdre une demande.** Si l'envoi échoue (réseau coupé, fonction
   indisponible), le visiteur reçoit immédiatement un lien WhatsApp pré-rempli avec
   tout ce qu'il a saisi, plus le numéro de téléphone.
2. **Ne jamais bloquer le parcours.** Photos, email et estimation sont facultatifs,
   et le raccourci WhatsApp est disponible à chaque étape. Le seul obstacle réel
   est nom + téléphone, le minimum pour rappeler quelqu'un.
3. **Reprise après interruption.** Les réponses sont conservées 24 h dans le
   navigateur : un appel entrant en pleine saisie ne fait rien perdre.

---

## 4. La porte TikTok — `/avant-apres`

Page conçue pour une seule situation : quelqu'un vient de voir un avant / après
sur TikTok et clique sur le lien en bio. Il ne cherchait rien, il n'a pas
d'intention d'achat formée — il veut vérifier que c'est réel, puis savoir combien
pour chez lui.

Elle est donc volontairement différente du reste du site :

- **Aucune navigation.** Pas de menu, pas de liens vers les prestations. Chaque
  lien supplémentaire est une occasion de partir ailleurs.
- **La preuve d'abord** : quatre comparateurs avant / après plein écran, en
  colonne, faits pour le pouce.
- **Une relance au milieu du parcours**, pas seulement en bas : c'est juste après
  le deuxième avant / après que l'envie de savoir « combien pour le mien » est la
  plus forte.
- **WhatsApp collé en bas de l'écran**, en permanence. L'estimation chiffrée n'est
  proposée qu'en lien secondaire — ce public-là ne veut pas d'un formulaire.

### L'adresse à mettre dans la bio

```
netandcare.fr/tiktok
```

`/tiktok`, `/bio` et `/insta` redirigent tous vers `/avant-apres` (règles dans
`netlify.toml`). L'intérêt : l'adresse dans la bio ne change jamais, même si la
page d'atterrissage évolue — et on peut distinguer les sources en ajoutant
`?utm_source=tiktok`.

### À alimenter

Les quatre comparateurs utilisent les mêmes visuels provisoires que le reste du
site. **C'est la page qui a le plus besoin des vraies photos** : c'est elle qui
doit convaincre quelqu'un qui n'a aucune raison de faire confiance. Chaque
avant / après vient avec une légende (prestation, ville, ce qui a été traité) —
à réécrire d'après les chantiers réels, dans `src/pages/avant-apres.html`.

Publier une vidéo TikTok sans que le lien en bio mène à cette page, c'est perdre
le trafic : l'ordre à respecter est mettre le lien, puis publier.

---

## 5. Réception des demandes

`netlify/functions/netcare-devis.js` traite chaque envoi, dans cet ordre :

1. **Email à Net & Care — chemin critique.** Toutes les réponses du formulaire, les
   photos en pièces jointes, et deux boutons en haut du message : appeler le prospect,
   ou lui écrire sur WhatsApp. Lisible sur un téléphone, en déplacement.
2. **Archivage en base** (`netcare_quote_requests`) et **dépôt des photos** dans un
   bucket privé — au mieux : leur échec n'empêche jamais l'email de partir.
3. **Accusé de réception au prospect**, s'il a laissé son email.

La fonction ne renvoie une erreur que si Net & Care n'a **rien** reçu : c'est ce qui
déclenche le repli WhatsApp côté navigateur.

### Variables d'environnement Netlify

| Variable | Rôle | Sans elle |
|---|---|---|
| `RESEND_API_KEY` | Envoi des emails (service Resend) | **Aucun email n'est envoyé** |
| `NETCARE_DEVIS_EMAIL` | Adresse qui reçoit les demandes | Repli sur `contact.emailDevis` du fichier de config |
| `NETCARE_FROM_EMAIL` | Expéditeur, ex. `Net & Care <contact@netandcare.fr>` | Valeur par défaut (domaine à vérifier chez Resend) |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | Archivage et stockage des photos | Le site fonctionne en mode email seul |
| `NETCARE_ALLOWED_ORIGIN` | Uniquement si le site est servi depuis un autre domaine que les fonctions | Inutile en déploiement standard |

> Le domaine d'envoi doit être vérifié dans Resend, sinon les emails partent en
> spam — ou ne partent pas du tout.

### Base de données

Migration : `supabase/migrations/0026_netcare_quote_requests.sql` (à la racine du
dépôt). Elle crée la table des demandes et le bucket privé `netcare-photos`.

La table est accessible en `service_role` uniquement : le navigateur n'écrit jamais
directement dans Supabase. Les photos sont dans un bucket **privé** — ce sont des
images de l'intérieur du domicile de particuliers — et ne circulent que par des liens
signés valables 30 jours.

La colonne `statut` (`nouveau` → `rappele` → `devis_envoye` → `gagne` / `perdu`)
permet de suivre les demandes directement depuis l'interface Supabase.

---

## 6. Déploiement

Le site est **indépendant de generationcapable.fr**, bien qu'hébergé dans le même
dépôt. Sur Netlify, créer un site dont le **répertoire de base** est `net-and-care` :

| Réglage | Valeur |
|---|---|
| Base directory | `net-and-care` |
| Build command | *(vide — les pages sont déjà générées)* |
| Publish directory | `net-and-care` |
| Functions directory | `net-and-care/netlify/functions` *(déjà dans `netlify.toml`)* |

C'est ce répertoire de base qui garantit qu'aucune règle de redirection ni tâche
planifiée de Génération Capable ne s'applique à ce site — et que Net & Care peut être
déplacé ailleurs sans rien casser.

Puis brancher le domaine et, dans `site.config.json`, ajuster `domaine` si l'adresse
définitive diffère de `https://www.netandcare.fr` :

```bash
# après changement de domaine
npm run build:netcare     # met à jour les canonical, le sitemap et robots.txt
```

---

## 7. Référencement local

### Ce qui est en place

- **7 pages locales** réellement différentes, ciblant les requêtes du dossier projet :
  nettoyage canapé Cannes / Antibes / Grasse, nettoyage matelas Cannes, nettoyage
  tapis Cannes, moquette, fin de chantier. Contenu propre à chaque ville (quartiers,
  type de logement, contraintes locales) — des pages clonées seraient déclassées.
- **Données structurées** : `HomeAndConstructionBusiness` avec zone d'intervention et
  horaires, `Service` par page locale, `FAQPage` (éligible aux questions dépliées dans
  Google), `BreadcrumbList`.
- Balises title / meta description uniques, `canonical`, Open Graph et image de partage.
- `sitemap.xml` et `robots.txt` générés automatiquement ; pages légales en `noindex`
  et exclues du sitemap.
- Maillage interne : chaque page locale renvoie vers les autres prestations et les
  autres villes ; l'accueil et le pied de page renvoient vers `/avant-apres`.
- `/avant-apres` est indexable : « avant après nettoyage canapé » est une requête
  réelle, et la page y répond mieux qu'une section d'accueil.
- Site statique et léger, sans framework : la vitesse est un critère de classement.

### Ce qui reste à faire — hors site

Le site ne suffit pas à se classer. Dans l'ordre d'impact :

1. **Fiche Google Business Profile** : catégorie principale « Service de nettoyage »,
   zone desservie (et non une adresse si l'activité est itinérante), photos avant /
   après régulières, horaires exacts, lien vers le site.
2. **Avis Google** : demander l'avis systématiquement en fin d'intervention, avec un
   lien direct (à stocker dans `contact.googleAvis`). C'est le premier facteur de
   classement local, et le plus visible pour un prospect.
3. **Publications Google** à chaque chantier marquant, avec une photo.
4. **Cohérence NAP** (nom, adresse, téléphone) identique partout : site, Google,
   Instagram, annuaires.
5. Soumettre le sitemap dans Google Search Console et suivre les requêtes réelles :
   elles indiqueront quelles pages locales créer ensuite.

---

## 8. Indicateurs

Le site pousse déjà les événements dans `window.dataLayer` — il suffit de brancher
GA4 (ou Google Tag Manager) en renseignant `analytics.ga4` dans `site.config.json` :

| Événement | Déclenchement | Indicateur du dossier projet |
|---|---|---|
| `devis_commence` | Première étape validée | Simulations commencées |
| `devis_etape` | Chaque étape franchie | Point d'abandon dans le tunnel |
| `devis_prestation` | Prestation choisie | Demande par type de prestation |
| `devis_photo_ajoutee` | Photo ajoutée | Qualité des demandes |
| `devis_envoye` | Demande transmise | **Nombre de demandes de devis** |
| `devis_whatsapp_direct` | Raccourci WhatsApp utilisé (avec l'étape) | Où le formulaire est ressenti comme trop long |
| `devis_echec_envoi` | Envoi en échec | Incident à surveiller |
| `clic_contact` | Clic tel / WhatsApp (avec l'emplacement) | Contacts WhatsApp et appels |

Les demandes elles-mêmes sont comptabilisables directement dans la table
`netcare_quote_requests` (par ville, par prestation, par statut).

---

## 9. Régénérer les visuels provisoires

```bash
node net-and-care/tools/make-visuals.js      # textures avant / après, favicon, carte
npx playwright screenshot --viewport-size=1200,630 \
  net-and-care/tools/og-source.html \
  net-and-care/assets/img/og-netandcare.png  # image de partage
```

Ces deux commandes ne servent plus une fois les vraies photos en place.
