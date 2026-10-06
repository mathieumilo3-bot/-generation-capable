# @app/admin — back-office web

Application Vite + React 19 + TypeScript strict (react-router) pour l'équipe : pilotage, clients, jobs, ventes directes, tarifs et réglages, paiements/webhooks, audit, support. Interface dense, même palette que l'app client (`packages/ui/src/tokens.ts` → variables CSS), aucun composant React Native.

## Démarrer

```bash
cp .env.example .env        # renseigner les 3 variables publiques
npm run dev                 # http://localhost:5174 (depuis app-v1 : npm run admin)
npm run build && npm run preview
npm run typecheck && npm test
```

Variables (publiques, embarquées dans le bundle) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PUBLIC_APP_URL` (base du lien `/invite/<jeton>`), `VITE_APP_ENV` (optionnel). Une clé secrète (`sb_secret_…` ou JWT de rôle serveur) est refusée au démarrage.

## Sécurité

- Le navigateur n'utilise que la clé publishable et la session d'un utilisateur staff (e-mail + code à 6 chiffres, `signInWithOtp({shouldCreateUser:false})`). Jamais de clé serveur.
- L'autorisation est côté serveur (`staff_roles`, RLS, RPC `admin_*` qui vérifient le rôle). L'interface ne fait que refléter le rôle lu dans `staff_roles` : `support` = lecture seule (actions financières masquées ; le support peut toutefois changer le statut / la note des demandes via `admin_update_support_request`), `admin` = tout. Un compte connecté sans rôle voit « Accès réservé » et est déconnecté.
- Aucune écriture directe sur les tables : uniquement des RPC (`src/data/*`). Toute action financière (ajustement, bonus, promotion, crédit commercial, remboursement, relance) demande un motif ≥ 5 caractères, une confirmation en deux temps affichant le montant en euros, une clé d'idempotence générée à chaque ouverture du dialogue, et désactive le bouton pendant l'appel.
- Le lien d'invitation n'est affiché qu'une fois (jeton en mémoire uniquement, jamais stocké ni journalisé).

## Structure

- `src/lib/*` : logique pure testée (formatage, validation, statuts, garde-fous des réglages, graphiques, pagination).
- `src/data/*` : wrappers typés autour de `supabase.rpc` / `select` via l'interface `AdminDb` (testables avec un faux).
- `src/components`, `src/pages`, `src/state`, `src/hooks` : interface.
- `test/*` : vitest (`npm test`).

## Besoins côté serveur restants

- **Invitations** : `accept_invitation` ne vérifie pas que l'e-mail du compte correspond à celui du deal ; le lien est un secret porteur. À durcir côté serveur si souhaité.
- Les RPC de liste ne renvoient pas de total (pagination « page suivante » par lecture de N+1 lignes).
