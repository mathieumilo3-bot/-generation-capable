-- ══════════════════════════════════════════════════════════════════════════
-- Génération Capable — schéma de production : abonnements, rôles, paiements
-- ══════════════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase → SQL Editor (projet fkhfahmzxsahrstxntjs, celui
-- déjà utilisé par ambassadors.html et les Netlify Functions).
--
-- Objectif : plus AUCUN contrôle d'accès ne doit reposer sur du JavaScript
-- côté navigateur. Ce fichier :
--   1. crée/complète la table "subscribers" (abonnement + rôle admin) ;
--   2. crée la table "payments" (trace fiable de chaque paiement Stripe) ;
--   3. crée/sécurise la table "modules" (contenu payant, RLS = vrai paywall) ;
--   4. verrouille la table "ambassadors" (RLS = accès service_role uniquement,
--      la vérification d'identité reste dans netlify/functions/ambassador-data.js).
--
-- Écrit pour être ré-exécutable sans erreur (IF NOT EXISTS / DROP POLICY IF
-- EXISTS partout) : le rejouer sur une base qui a déjà une partie de ce
-- schéma ne doit rien casser.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. SUBSCRIBERS — un compte = un abonnement + un rôle
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.subscribers (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users(id) on delete set null,
  email                  text not null,
  is_active              boolean not null default false,
  role                   text not null default 'member',
  plan                   text,
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint subscribers_role_check check (role in ('member','admin'))
);

-- Ajoute les colonnes manquantes si la table existait déjà sous une forme
-- antérieure (ex: juste user_id + is_active).
alter table public.subscribers add column if not exists role text not null default 'member';
alter table public.subscribers add column if not exists plan text;
alter table public.subscribers add column if not exists stripe_customer_id text;
alter table public.subscribers add column if not exists stripe_subscription_id text;
alter table public.subscribers add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscribers_role_check'
  ) then
    alter table public.subscribers
      add constraint subscribers_role_check check (role in ('member','admin'));
  end if;
end $$;

-- Un seul abonné par email et par user_id (index partiels pour tolérer les
-- lignes créées avant qu'un compte Supabase Auth existe, ex: achat Académie
-- via le formulaire "lettre d'engagement" sans inscription préalable).
-- Contrainte simple sur "email" (pas lower(email)) : tout le code serveur
-- qui écrit dans cette table (verify-checkout-session.js, stripe-webhook.js)
-- normalise déjà l'email en minuscules avant écriture — une contrainte sur
-- la colonne brute suffit et reste compatible avec l'upsert PostgREST
-- (Prefer: resolution=merge-duplicates + ?on_conflict=email).
create unique index if not exists subscribers_email_unique_idx
  on public.subscribers (email);
create unique index if not exists subscribers_user_id_unique_idx
  on public.subscribers (user_id) where user_id is not null;

alter table public.subscribers enable row level security;

drop policy if exists subscribers_select_own on public.subscribers;
create policy subscribers_select_own
  on public.subscribers for select
  to authenticated
  using (auth.uid() = user_id);

-- Aucune policy insert/update/delete pour anon/authenticated : toute écriture
-- (activation après paiement, changement de rôle) passe exclusivement par
-- une Netlify Function utilisant SUPABASE_SERVICE_ROLE_KEY, qui contourne la
-- RLS par conception. C'est la seule façon d'éviter qu'un utilisateur ne
-- s'auto-active ou s'attribue le rôle admin depuis le navigateur.

-- Pour te nommer admin toi-même une fois inscrit (remplace l'email) :
--   update public.subscribers set role = 'admin' where lower(email) = lower('ton-email@example.com');


-- ──────────────────────────────────────────────────────────────────────────
-- 2. PAYMENTS — trace fiable de chaque événement de paiement Stripe
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id                  uuid primary key default gen_random_uuid(),
  stripe_event_id     text unique,
  stripe_session_id   text,
  stripe_customer_id  text,
  email               text,
  offer               text,
  amount_total        integer,
  currency            text,
  status              text not null,
  raw_event           jsonb,
  created_at          timestamptz not null default now()
);

alter table public.payments enable row level security;
-- Aucune policy : table interne, lisible/écrite uniquement via service_role
-- (webhook Stripe et vérification post-checkout). Jamais exposée au client.


-- ──────────────────────────────────────────────────────────────────────────
-- 3. MODULES — contenu payant ; la RLS est le VRAI paywall (pas le JS)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.modules (
  id         integer primary key,
  num        integer not null,
  content    jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.modules enable row level security;

drop policy if exists modules_select_active_subscribers on public.modules;
create policy modules_select_active_subscribers
  on public.modules for select
  to authenticated
  using (
    exists (
      select 1 from public.subscribers s
      where s.user_id = auth.uid() and s.is_active = true
    )
  );

-- Pas de policy insert/update/delete pour les clients : le contenu des
-- modules est géré depuis le SQL Editor / dashboard Supabase par le
-- fondateur, jamais depuis le site.


-- ──────────────────────────────────────────────────────────────────────────
-- 4. AMBASSADORS — verrouillage RLS (fixe l'IDOR identifié à l'audit)
-- ──────────────────────────────────────────────────────────────────────────
-- netlify/functions/ambassador-data.js vérifie déjà le token de session
-- Supabase et dérive l'email de façon fiable — mais il exécutait ensuite ses
-- requêtes avec la clé ANON. Si la RLS de cette table autorisait le rôle
-- "anon" (nécessaire pour que la fonction elle-même fonctionne), n'importe
-- qui pouvait aussi appeler l'API REST Supabase directement avec la même clé
-- anon (publique, visible dans ambassadors.html) et lire/écrire les données
-- de N'IMPORTE QUEL ambassadeur en devinant son email — sans jamais passer
-- par la vérification de token de la fonction.
--
-- Fix : la fonction est réécrite pour utiliser SUPABASE_SERVICE_ROLE_KEY
-- (qui contourne la RLS) après avoir vérifié le token elle-même. La RLS,
-- elle, n'accorde plus AUCUN accès à anon/authenticated : la seule porte
-- d'entrée redevient la fonction, qui a déjà fait la vérification d'identité.
alter table public.ambassadors enable row level security;
-- Aucune policy pour anon/authenticated = accès refusé par défaut à ces
-- rôles. Seul service_role (utilisé uniquement côté serveur) peut lire/écrire.


-- ──────────────────────────────────────────────────────────────────────────
-- Vérification rapide après exécution (à lancer manuellement) :
--   select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename in ('subscribers','payments','modules','ambassadors');
-- Les 4 lignes doivent avoir rowsecurity = true.
-- ──────────────────────────────────────────────────────────────────────────
