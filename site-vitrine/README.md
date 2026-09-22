# GC — site vitrine

Site de marque "Digital Revenue Systems" pour GC — un projet
Next.js autonome, indépendant du produit existant à la racine du dépôt
(app d'abonnement/coaching, ambassadeurs, CRM, compliance : voir `../`).
Ce dossier ne modifie rien du produit existant ; il peut être déployé sur son
propre sous-domaine ou basculé plus tard.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript
- Tailwind CSS v4
- Framer Motion pour les animations (respecte `prefers-reduced-motion`)

## Développement

```bash
npm install
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

```bash
npm run build     # build de production
npm run lint      # ESLint
npm run test      # tests unitaires (Vitest)
npm run test:e2e  # tests end-to-end (Playwright, desktop + mobile)
npm run verify    # lint + tests unitaires + build
```

Les tests tournent aussi automatiquement en CI sur chaque PR touchant
`site-vitrine/` (voir `.github/workflows/site-vitrine-ci.yml`).

> Note pour les tests locaux : utiliser `http://localhost:3000` et non
> `http://127.0.0.1:3000`. Sur certains environnements le WebSocket HMR de
> Next est bloqué sur `127.0.0.1`, ce qui empêche l'hydratation côté client
> et fait échouer les tests pour une raison sans rapport avec le code.

## Architecture

- `src/app` — routes (App Router) : accueil, `/audit` (tunnel de
  qualification), `/secteurs[/[secteur]]`, `/applications`,
  `/ressources[/[article]]`, pages piliers SEO (`/agence-web`,
  `/creation-site-internet`, `/acquisition`, `/seo`), pages légales,
  `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`.
- `src/components/sections` — sections de la page d'accueil (Hero,
  ValueStrip, InstantCheck, Recommendation, SystemDemo, SystemArchitecture,
  Method, Systems, Applications, Objections, FAQ, FinalCTA).
- `src/components/audit` — `AuditReport.tsx`, l'affichage du diagnostic réel
  produit par le moteur d'audit (voir plus bas) à l'issue du tunnel.
- `src/components/ui` — design system (Button, Badge, Card, Section, Reveal).
- `src/components/schema` — JSON-LD (Organization, WebSite, Service, Article,
  Breadcrumb).
- `src/lib/data` — contenu structuré (secteurs, systèmes, articles,
  applications, identité légale). Aucun client, résultat ou témoignage n'est
  jamais inventé — voir `legal.ts` et les composants qui le consomment.
- `src/app/api/audit/route.ts` — endpoint de réception du formulaire d'audit.
  Valide la requête puis envoie, via Resend (`generationcapable.fr`, domaine
  déjà vérifié DKIM/SPF), un email de notification au propriétaire du
  business et un email de confirmation au prospect. En développement, sans
  les variables d'environnement ci-dessous, il journalise au lieu d'envoyer ;
  en production il répond 500 plutôt que d'avaler silencieusement un lead.
- `src/lib/audit-submission.ts` — validation et gabarits d'emails, isolés du
  handler pour être testables sans réseau (typage strict des champs, limites
  de longueur, échappement HTML, nettoyage du sujet, honeypot anti-bot).
- `src/lib/audit-engine/` — le moteur de diagnostic business (« Capable
  Audit V1 »). Voir la section dédiée ci-dessous.
- `src/app/api/audit/analyze/route.ts` — endpoint qui exécute ce moteur.
  Séparé de `/api/audit` : il ne capture aucun lead et n'envoie aucun email,
  donc une analyse lente ou en échec ne retarde ni ne casse jamais la
  capture du lead.
- `src/lib/rate-limit.ts` — limitation de débit par IP, un compteur distinct
  par endpoint (`/api/audit` : 5 envois / 10 min ; `/api/audit/analyze` :
  10 analyses / 10 min). Empêche que le formulaire serve de relais pour
  envoyer des emails à des adresses arbitraires depuis le domaine vérifié,
  et que l'endpoint d'analyse serve de proxy de requêtes gratuit.
- `src/lib/tracking.ts` — wrapper `dataLayer` pour les événements
  (`audit_started`, `form_started`, `audit_analysis_started`,
  `audit_report_viewed`, `audit_cta_clicked`, `cta_clicked`, …). Poussé dans
  `window.dataLayer` que Google Tag Manager soit chargé ou non — voir
  `src/components/Analytics.tsx`.

### Le moteur d'audit (`src/lib/audit-engine/`)

Pipeline : collecte (déclaré + sonde du site) → classification sectorielle
→ neuf modules d'analyse → priorisation → rapport. Chaque fichier a un rôle
précis :

- `types.ts` — le contrat central : chaque donnée porte un statut
  `observed` / `inferred` / `unknown` (jamais un chiffre inventé pour
  combler une inconnue) et chaque `Finding` porte son impact, la facilité
  de correction, sa preuve et, si négatif, une recommandation.
- `sectors.ts` — quinze profils sectoriels + `autre`, chacun avec ses
  dimensions prioritaires, ses signaux de confiance types et ses limites
  explicites (des heuristiques, jamais des vérités universelles).
- `classify.ts` — fait correspondre le secteur déclaré dans le tunnel (les
  huit boutons de `src/lib/data/sectors.ts`, une taxonomie marketing
  distincte) à l'un de ces quinze profils.
- `probe.ts` — récupère la page (5 s de délai maximum, 1,5 Mo max, garde
  anti-SSRF contre les cibles privées/locales) et en extrait les signaux
  observables par une analyse HTML légère, sans dépendance de parsing.
  Ne mesure jamais une donnée privée (trafic, chiffre d'affaires…) ; un
  site inaccessible dégrade le rapport plutôt que de le faire échouer.
- `analyzers/` — neuf analyses (positionnement, psychologie, offre,
  acquisition, parcours, conversion, confiance, preuve sociale, modèle
  économique), chacune produisant des `Finding[]` à partir des signaux et
  du profil sectoriel.
- `leaks.ts` — sélectionne les 3 à 5 fuites prioritaires selon une formule
  explicite (impact × importance dans le parcours × confiance ×
  facilité de correction), sans jamais en inventer pour atteindre le
  plancher.
- `report.ts` / `engine.ts` — assemblent le rapport final et orchestrent le
  pipeline. `runAudit()` ne lève jamais d'exception : une sonde en échec
  dégrade le rapport, elle ne casse jamais la requête.
- `ai-synthesis.ts` — couche d'intelligence facultative via l'API OpenAI Responses. Elle ne remplace jamais les faits du moteur : elle reformule et priorise uniquement les signaux observés/déduits déjà produits, sous schéma JSON strict. Toute erreur, absence de clé ou réponse invalide retombe silencieusement sur le rapport déterministe.

Testé à trois niveaux : chaque module unitairement (classification,
extraction HTML, priorisation, génération du rapport, cas sans données,
secteur inconnu), l'API par ses contrats (`audit-analyze-api.spec.ts`), et
le tunnel de bout en bout (`audit-report.spec.ts`).
- `next.config.ts` — en-têtes de sécurité envoyés sur toutes les réponses
  (nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP,
  HSTS) et `no-store` / `noindex` sur `/api/*`.

## Variables d'environnement

Copier `.env.example` en `.env.local` et renseigner :

- `RESEND_API_KEY` — clé Resend `sending_access` restreinte au domaine
  `generationcapable.fr` (créée pour ce formulaire).
- `AUDIT_NOTIFY_EMAIL` — adresse qui reçoit chaque nouvelle demande d'audit.
- `RESEND_FROM_EMAIL` — optionnel, expéditeur par défaut
  `GC <audit@generationcapable.fr>`.
- `OPENAI_API_KEY` — optionnel mais recommandé pour le diagnostic enrichi : active la synthèse OpenAI du rapport à partir des signaux publics collectés par le moteur déterministe. Les coordonnées du formulaire ne sont pas transmises à OpenAI. Sans cette clé, le moteur déterministe continue de fonctionner normalement.
- `OPENAI_AUDIT_MODEL` — optionnel, modèle utilisé pour la synthèse. Par défaut : `gpt-5.6-sol`.
- `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` — optionnel, jeton de validation Google Search Console. Renseigner uniquement la valeur du jeton ; Next.js génère la balise meta de vérification.
- `NEXT_PUBLIC_GTM_ID` — optionnel, conteneur Google Tag Manager
  (`GTM-XXXXXXX`). Laissée vide, aucune balise tierce n'est chargée (vérifié
  par un test E2E). Renseignée, GA4, les conversions Google Ads et le pixel
  Meta se branchent depuis l'interface GTM : les évènements du tunnel sont
  déjà poussés dans `window.dataLayer`.

Ces mêmes variables doivent être configurées sur la plateforme de
déploiement (Netlify, Vercel, …) avant mise en production.

## À faire avant mise en production publique

- **Remplir `src/lib/data/legal.ts`** (bloquant pour toute publicité).
  C'est le seul fichier à éditer : dénomination, forme juridique, siège,
  SIREN, directeur de publication et email de contact. `/mentions-legales`
  se remplit alors toute seule, et `/politique-de-confidentialite` affiche
  le bon responsable de traitement. Tant qu'il est vide, les deux pages le
  disent explicitement plutôt que d'afficher un faux identifiant — aucune
  information légale n'est inventée. Ajouter aussi l'adresse de l'hébergeur
  (`HOST.adresse`) depuis <https://www.netlify.com/legal/>.
- Si une mesure d'audience avec cookies est activée via `NEXT_PUBLIC_GTM_ID`,
  ajouter un bandeau de consentement et mettre à jour la section « Cookies »
  de la politique de confidentialité. Le Consent Mode v2 est initialisé en
  `denied` : sans bandeau, les balises restent sans cookie.
- Configurer `RESEND_API_KEY` / `AUDIT_NOTIFY_EMAIL` sur la plateforme de
  déploiement (voir ci-dessus).
- Remplacer `SITE_URL` dans `src/lib/constants.ts` par le domaine définitif
  si différent de `generationcapable.fr`.
- Publier de vrais cas clients dans `src/lib/data/case-studies.ts` au fur et
  à mesure (jamais de données fictives).

## Pistes d'amélioration identifiées

- **Content-Security-Policy.** Volontairement absente : l'App Router injecte
  des scripts inline, une CSP utile suppose donc des nonces générés par
  requête dans un middleware. À faire comme un chantier dédié, avec la suite
  E2E comme garde-fou — une CSP en `unsafe-inline` n'apporterait qu'une
  fausse sécurité.
- **Limitation de débit partagée.** `src/lib/rate-limit.ts` garde son état en
  mémoire : sur une plateforme serverless, chaque instance a son compteur.
  Suffisant pour casser un flood, à remplacer par un store partagé (Redis /
  Upstash) si le trafic le justifie.
- **Persistance des demandes.** Une demande d'audit n'existe aujourd'hui que
  sous forme d'email. Si l'envoi échoue, le visiteur voit une erreur et peut
  réessayer, mais rien n'est conservé côté serveur. Brancher un CRM ou une
  table Supabase rendrait la capture durable.


<!-- GC Revenue deployment trigger: GTM configuration -->
<!-- Capable Audit deployment trigger: OpenAI synthesis -->


## Pilotage SEO

La carte des intentions est documentée dans `SEO-KEYWORD-MAP.md`.
La boucle de progression Search Console, le maillage et les règles anti-cannibalisation sont documentés dans `SEO-OPERATING-PLAN.md`.

<!-- GC production release trigger — 2026-09-22 -->
