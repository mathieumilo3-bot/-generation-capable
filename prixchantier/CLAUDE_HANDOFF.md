# PrixChantier — reprise finale par Claude

## Objectif
Finir l'application PrixChantier jusqu'à un état réellement utilisable en production sur Netlify, puis valider le parcours principal. Ne pas reconstruire l'app : le produit est déjà codé dans `prixchantier/`.

## Définition de terminé
- `https://prixchantier.netlify.app` sert l'application réelle.
- `/`, `/login`, `/signup`, `/forgot-password` ne sont plus en 404.
- Les routes protégées redirigent correctement sans session.
- Les routes API Next.js fonctionnent côté serveur.
- Supabase auth + accès DB fonctionnent.
- `/api/cron/tick` renvoie 401 sans autorisation et fonctionne avec son secret.
- `npm ci`, lint, typecheck, tests et build passent.
- Un smoke test est fait sur l'URL publique après le dernier déploiement.

## Repo
Repo : `mathieumilo3-bot/-generation-capable`
App : `prixchantier/`
Branche de reprise : `claude/prixchantier-final-takeover-20260926`

## État déjà réalisé
- Next.js 16.3.6 / React 19.
- App Router, auth Supabase, dossiers, fournisseurs, consultations, exports, cron, relances et intégrations mail déjà codés.
- Le typecheck a été corrigé pour exécuter `next typegen && tsc --noEmit`.
- Projet Supabase de production déjà créé : `wcrpxrcbbigswcqufhik`.
- Migrations déjà appliquées :
  - `20260925000001_schema.sql`
  - `20260925000002_rls.sql`
  - `20260925000003_cron.sql`
  - `20260926000004_ai_usage.sql`
- Le cron Supabase pointe déjà vers `https://prixchantier.netlify.app/api/cron/tick`.
- Site Netlify déjà créé :
  - site id `043f9a8f-7a88-4f95-b3c8-85b8c5606799`
  - URL `https://prixchantier.netlify.app`

## Variables Netlify
Les variables principales ont déjà été créées côté Netlify (URL Supabase, clé publishable, APP_URL, cron secret, clé de chiffrement, modèle OpenAI, clé serveur Supabase).

Important : vérifier dans Netlify que la clé serveur Supabase est une vraie clé valide du projet et pas une valeur temporaire/placeholder. Ne jamais committer de secret.

Les identifiants OAuth Google/Microsoft et la clé OpenAI peuvent rester non configurés si les fonctions correspondantes sont volontairement désactivées, mais il faut le signaler à la fin.

## Diagnostic Netlify déjà effectué

### Cas A — build distant "ready" mais app 404
Des déploiements Netlify ont fini en état `ready`, mais aucune function/edge function Next n'était déployée. Résultat : routes publiques en 404.

Exemple observé : deploy `6ab7d6fe4255642ccd69700d`.

### Cas B — runtime Next explicite
`@netlify/plugin-nextjs@5.16.0` a été testé.

Avec un `netlify.toml` de ce type :

```toml
[build]
  command = "npm run build"

[build.environment]
  NODE_VERSION = "22"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

un build Netlify local complet a réussi :
- Next compile,
- TypeScript passe,
- pages générées,
- `___netlify-server-handler` packagé,
- middleware/edge packagé,
- `Netlify Build Complete`.

Workflow de référence : run GitHub Actions `36241499248`.

Mais le build distant Netlify avec runtime explicite a échoué avec un exit code 2. La cause exacte doit être récupérée dans les logs Netlify.

### Cas C — outil de déploiement utilisé
Le flux temporaire utilisé jusque-là envoyait les sources vers l'API Netlify puis déclenchait un build distant. Il n'envoyait pas directement la sortie `.netlify` précompilée. C'est pourquoi un build local vert ne garantissait pas que le déploiement distant utilisait le même runtime.

## État production à vérifier immédiatement
Plusieurs déploiements de diagnostic ont été lancés. Ne faire confiance ni au badge "ready" ni à l'état GitHub seul.

Première action de Claude :
1. ouvrir `https://prixchantier.netlify.app`,
2. tester `/login`, `/signup`, `/forgot-password`,
3. regarder le dernier deploy Netlify et ses fonctions,
4. remplacer toute version de diagnostic par l'application réelle.

## Stratégie recommandée
1. Travailler depuis cette branche propre basée sur `main`.
2. Lire `prixchantier/README.md`, `prixchantier/src/lib/env.ts`, les clients Supabase et les migrations.
3. Relier proprement le repo Netlify avec base directory `prixchantier` si possible.
4. Laisser Netlify détecter Next.js nativement en priorité.
5. Si le runtime explicite est nécessaire, utiliser une version compatible et confirmer qu'un vrai build distant crée bien le server handler.
6. Ne jamais publier `.next` comme simple dossier statique.
7. Vérifier toutes les variables d'environnement production.
8. Déployer, puis tester les routes publiques et protégées.
9. Tester Supabase signup/login.
10. Tester le cron sans auth (401), puis avec auth.
11. Lancer qualité/tests.
12. Nettoyer les workflows de debug temporaires éventuellement présents dans les autres branches. Ne pas les merger dans main.

## Commandes de validation
Depuis `prixchantier/` :

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run build
```

Lancer les E2E si l'environnement nécessaire est disponible.

## Fichiers critiques
- `prixchantier/package.json`
- `prixchantier/next.config.ts`
- `prixchantier/src/lib/env.ts`
- `prixchantier/src/lib/supabase/server.ts`
- `prixchantier/src/lib/supabase/admin.ts`
- `prixchantier/src/app/api/cron/tick/route.ts`
- `prixchantier/supabase/migrations/`
- `.github/workflows/prixchantier-ci.yml`

## Contraintes
- Ne pas casser les autres projets du monorepo.
- Ne pas supprimer les données Supabase.
- Ne jamais exposer de secret dans Git ou les logs.
- Ne pas annoncer "fini" tant que les routes live n'ont pas été testées.
- Ne pas s'arrêter à un build vert : le critère final est l'application fonctionnelle sur l'URL publique.

## Sortie attendue
Quand tout est fini, donner :
1. commit/PR final,
2. URL production,
3. tests exécutés,
4. résultat des smoke tests live,
5. éventuelles intégrations laissées volontairement non configurées.
