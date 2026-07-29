-- ══════════════════════════════════════════════════════════════════════════
-- Génération Capable — schéma RÉELLEMENT LIVE en production (2026-07-29)
-- ══════════════════════════════════════════════════════════════════════════
-- Ce fichier documente le schéma effectivement appliqué au projet Supabase
-- fkhfahmzxsahrstxntjs, reconstruit à partir de l'introspection directe de
-- la base (pg_catalog / information_schema) le 2026-07-29. Il a été ajouté
-- rétroactivement : la base avait divergé des fichiers 0001/0002 ci-dessus
-- (appliqués hors dépôt, jamais reportés ici), ce qui cassait tout le
-- parcours paiement → activation → connexion (voir les Netlify Functions,
-- corrigées dans le même commit pour utiliser CE schéma).
--
-- Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS partout) : le rejouer
-- sur le projet de production ne doit rien casser (tout existe déjà). Son
-- utilité première est de servir de source de vérité pour recréer le
-- schéma sur un nouveau projet Supabase (dev/staging) ou en reprise après
-- incident.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. ADMINS — liste des comptes fondateur/staff (remplace subscribers.role)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.admins (
  email      text primary key,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
-- Volontairement AUCUNE policy pour anon/authenticated : personne ne doit
-- pouvoir lire/écrire cette table depuis le client, même son propre email.
-- Seuls service_role (Netlify Functions) et les fonctions SECURITY DEFINER
-- ci-dessous (qui contournent la RLS par construction) y accèdent.

insert into public.admins (email)
values (lower('ledorvenenzo50@gmail.com'))
on conflict (email) do nothing;

create or replace function public.is_current_user_admin()
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists(select 1 from admins where email = auth.jwt()->>'email');
$$;


-- ──────────────────────────────────────────────────────────────────────────
-- 2. AMBASSADORS — programme ambassadeur (état + lien vers Auth)
-- ──────────────────────────────────────────────────────────────────────────
-- Créée avant "subscribers" : celle-ci référence ambassadors(id) par clé
-- étrangère (parrainage).
create table if not exists public.ambassadors (
  id         uuid primary key default gen_random_uuid(),
  email      text unique not null,
  state      jsonb not null default '{}'::jsonb,
  user_id    uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ambassadors enable row level security;

drop policy if exists ambassadors_select_own on public.ambassadors;
create policy ambassadors_select_own on public.ambassadors for select using (auth.uid() = user_id);
drop policy if exists ambassadors_insert_own on public.ambassadors;
create policy ambassadors_insert_own on public.ambassadors for insert with check (auth.uid() = user_id);
drop policy if exists ambassadors_update_own on public.ambassadors;
create policy ambassadors_update_own on public.ambassadors for update using (auth.uid() = user_id);
-- ambassador-data.js (Netlify Function) lit/écrit en service_role après avoir
-- vérifié le token lui-même — ces policies servent un accès direct éventuel,
-- pas le chemin principal.


-- ──────────────────────────────────────────────────────────────────────────
-- 3. SUBSCRIBERS — un compte Auth = une ligne d'abonnement (indexé user_id)
-- ──────────────────────────────────────────────────────────────────────────
-- Volontairement PAS de colonne "email" : Stripe ne connaît que l'email du
-- payeur, jamais l'id Supabase Auth — c'est aux Netlify Functions de
-- résoudre/créer le compte Auth correspondant (voir
-- _lib/supabase-admin.js::ensureAuthUserForEmail) avant d'écrire ici.
create table if not exists public.subscribers (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  is_active               boolean not null default false,
  stripe_customer_id      text unique,
  referred_by_ambassador_id uuid references public.ambassadors(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

alter table public.subscribers enable row level security;

drop policy if exists "Un utilisateur lit son propre statut d'abonnement" on public.subscribers;
create policy "Un utilisateur lit son propre statut d'abonnement"
  on public.subscribers for select
  using (auth.uid() = user_id);

-- Aucune policy insert/update/delete pour anon/authenticated : toute écriture
-- (activation post-paiement, changement de statut) passe exclusivement par
-- une Netlify Function en service_role, ou par les fonctions admin ci-dessous.

create or replace function public.admin_set_subscriber_active(target_user_id uuid, new_status boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_admin_email text;
begin
  if not exists (select 1 from admins where email = auth.jwt()->>'email') then
    insert into audit_logs(event_type, buyer_id, actor, details)
    values ('access_denied', target_user_id, coalesce(auth.jwt()->>'email','anonyme'), jsonb_build_object('action','admin_set_subscriber_active'));
    raise exception 'Accès refusé';
  end if;
  v_admin_email := auth.jwt()->>'email';
  update subscribers set is_active = new_status, updated_at = now() where user_id = target_user_id;
  insert into audit_logs(event_type, buyer_id, actor, details)
  values ('admin_change', target_user_id, 'admin:'||v_admin_email, jsonb_build_object('action','admin_set_subscriber_active','new_status',new_status));
end; $$;

create or replace function public.admin_list_subscribers()
returns table(user_id uuid, email text, is_active boolean, stripe_customer_id text, created_at timestamptz)
language sql
security definer
set search_path to 'public'
as $$
  select s.user_id, u.email, s.is_active, s.stripe_customer_id, s.created_at
  from subscribers s
  join auth.users u on u.id = s.user_id
  where exists (select 1 from admins a where a.email = auth.jwt()->>'email')
  order by s.created_at desc;
$$;


-- ──────────────────────────────────────────────────────────────────────────
-- 4. MODULES — contenu payant ; la RLS est le vrai paywall
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.modules (
  id      integer primary key,
  num     text,
  content jsonb not null
);

alter table public.modules enable row level security;

drop policy if exists "Seuls les abonnes actifs lisent les modules" on public.modules;
create policy "Seuls les abonnes actifs lisent les modules"
  on public.modules for select
  using (
    exists (select 1 from public.subscribers where subscribers.user_id = auth.uid() and subscribers.is_active = true)
  );


-- ──────────────────────────────────────────────────────────────────────────
-- 5. SALES / COMMISSIONS / AUDIT_LOGS / REFERRAL_ATTRIBUTIONS /
--    STRIPE_EVENTS_PROCESSED — trace de vente + programme de commission
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.sales (
  id                    uuid primary key default gen_random_uuid(),
  created_at            timestamptz not null default now(),
  stripe_session_id     text unique,
  stripe_payment_intent text,
  stripe_customer_id    text,
  buyer_user_id         uuid references auth.users(id),
  seller_user_id        uuid references auth.users(id),
  product_id            text not null,
  product_name          text not null,
  amount                integer not null check (amount >= 0),
  currency              text not null default 'eur',
  status                text not null default 'completed' check (status in ('completed','refunded','disputed','cancelled')),
  source                text not null default 'stripe_webhook',
  refund_status         text not null default 'none' check (refund_status in ('none','partial','full')),
  stripe_event_id       text,
  metadata              jsonb not null default '{}'::jsonb
);
comment on table public.sales is 'Ventes validées. Créées uniquement par le webhook Stripe (service_role). Immuable après insertion.';

alter table public.sales enable row level security;
drop policy if exists sales_select_admin on public.sales;
create policy sales_select_admin on public.sales for select using (is_current_user_admin());
drop policy if exists sales_select_own_as_buyer on public.sales;
create policy sales_select_own_as_buyer on public.sales for select using (auth.uid() = buyer_user_id);
drop policy if exists sales_select_own_as_seller on public.sales;
create policy sales_select_own_as_seller on public.sales for select using (auth.uid() = seller_user_id);

create table if not exists public.commissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  sale_id     uuid not null references public.sales(id),
  seller_id   uuid not null references auth.users(id),
  amount      integer not null check (amount >= 0),
  percentage  numeric,
  status      text not null default 'pending' check (status in ('pending','validated','paid','cancelled','refunded')),
  stripe_event_id text
);
comment on table public.commissions is 'Commissions vendeurs. Statuts verrouillés progressivement.';

alter table public.commissions enable row level security;
drop policy if exists commissions_select_admin on public.commissions;
create policy commissions_select_admin on public.commissions for select using (is_current_user_admin());
drop policy if exists commissions_select_own on public.commissions;
create policy commissions_select_own on public.commissions for select using (auth.uid() = seller_id);

create table if not exists public.audit_logs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  event_type      text not null,
  sale_id         uuid references public.sales(id),
  commission_id   uuid references public.commissions(id),
  seller_id       uuid,
  buyer_id        uuid,
  product_id      text,
  amount          integer,
  percentage      numeric,
  stripe_event_id text,
  actor           text not null default 'system',
  ip              inet,
  details         jsonb not null default '{}'::jsonb
);
comment on table public.audit_logs is 'Journal comptable append-only. Aucune UPDATE/DELETE possible.';

alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs for select using (is_current_user_admin());

create table if not exists public.referral_attributions (
  buyer_user_id uuid primary key references auth.users(id),
  buyer_email   text,
  seller_id     uuid not null references auth.users(id),
  locked_at     timestamptz not null default now(),
  source        text
);
comment on table public.referral_attributions is 'Premier vendeur attribué = définitif. Modification uniquement via procédure SQL directe.';

alter table public.referral_attributions enable row level security;
drop policy if exists referral_select_admin on public.referral_attributions;
create policy referral_select_admin on public.referral_attributions for select using (is_current_user_admin());
drop policy if exists referral_select_own on public.referral_attributions;
create policy referral_select_own on public.referral_attributions for select using (auth.uid() = seller_id);

create table if not exists public.stripe_events_processed (
  event_id     text primary key,
  event_type   text not null,
  processed_at timestamptz not null default now()
);
comment on table public.stripe_events_processed is 'Un event.id Stripe = une ligne. Doublon = violation de PK = webhook ne retraite rien.';

alter table public.stripe_events_processed enable row level security;
drop policy if exists stripe_events_select_admin on public.stripe_events_processed;
create policy stripe_events_select_admin on public.stripe_events_processed for select using (is_current_user_admin());


-- ──────────────────────────────────────────────────────────────────────────
-- 6. Fonctions/triggers d'immuabilité (append-only / verrouillage métier)
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.block_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'Suppression interdite sur % (id=%)', TG_TABLE_NAME, OLD.id;
end; $$;

create or replace function public.block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs est append-only : % interdit (id=%)', TG_OP, OLD.id;
end; $$;

create or replace function public.commissions_guard()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if OLD.status <> 'pending' then
    if OLD.sale_id is distinct from NEW.sale_id
       or OLD.seller_id is distinct from NEW.seller_id
       or OLD.amount is distinct from NEW.amount
       or OLD.percentage is distinct from NEW.percentage then
      raise exception 'commissions: montant/vendeur/vente verrouillés après validation (id=%)', OLD.id;
    end if;
  end if;
  if OLD.status = 'paid' and NEW.status not in ('paid','refunded') then
    raise exception 'commissions: transition % -> % interdite', OLD.status, NEW.status;
  end if;
  if OLD.status in ('cancelled','refunded') and NEW.status <> OLD.status then
    raise exception 'commissions: statut final % définitif', OLD.status;
  end if;
  NEW.updated_at = now();
  return NEW;
end; $$;

create or replace function public.referral_lock()
returns trigger language plpgsql as $$
begin
  if OLD.seller_id is distinct from NEW.seller_id then
    raise exception 'parrainage verrouillé : vendeur de % ne peut plus changer', OLD.buyer_user_id;
  end if;
  return NEW;
end; $$;

create or replace function public.sales_prevent_core_mutation()
returns trigger
language plpgsql security definer set search_path to 'public'
as $$
begin
  if OLD.seller_user_id is distinct from NEW.seller_user_id
     or OLD.buyer_user_id is distinct from NEW.buyer_user_id
     or OLD.amount is distinct from NEW.amount
     or OLD.currency is distinct from NEW.currency
     or OLD.product_id is distinct from NEW.product_id then
    raise exception 'sales: vendeur/acheteur/montant/devise/produit immuables après création (id=%)', OLD.id;
  end if;
  return NEW;
end; $$;

create or replace function public.admin_cancel_commission(p_commission_id uuid, p_reason text default null)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_admin_email text;
begin
  if not exists (select 1 from admins where email = auth.jwt()->>'email') then
    insert into audit_logs(event_type, commission_id, actor, details)
    values ('access_denied', p_commission_id, coalesce(auth.jwt()->>'email','anonyme'), jsonb_build_object('action','admin_cancel_commission'));
    raise exception 'Accès refusé';
  end if;
  v_admin_email := auth.jwt()->>'email';
  update commissions set status = 'cancelled' where id = p_commission_id;
  insert into audit_logs(event_type, commission_id, actor, details)
  values ('commission_status_change', p_commission_id, 'admin:'||v_admin_email, jsonb_build_object('new_status','cancelled','reason',p_reason));
end; $$;

create or replace function public.admin_mark_commission_paid(p_commission_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_admin_email text;
begin
  if not exists (select 1 from admins where email = auth.jwt()->>'email') then
    insert into audit_logs(event_type, commission_id, actor, details)
    values ('access_denied', p_commission_id, coalesce(auth.jwt()->>'email','anonyme'), jsonb_build_object('action','admin_mark_commission_paid'));
    raise exception 'Accès refusé';
  end if;
  v_admin_email := auth.jwt()->>'email';
  update commissions set status = 'paid' where id = p_commission_id;
  insert into audit_logs(event_type, commission_id, actor, details)
  values ('commission_status_change', p_commission_id, 'admin:'||v_admin_email, jsonb_build_object('new_status','paid'));
end; $$;

drop trigger if exists trg_audit_no_delete on public.audit_logs;
create trigger trg_audit_no_delete before delete on public.audit_logs for each row execute function block_mutation();
drop trigger if exists trg_audit_no_update on public.audit_logs;
create trigger trg_audit_no_update before update on public.audit_logs for each row execute function block_mutation();

drop trigger if exists trg_commissions_no_delete on public.commissions;
create trigger trg_commissions_no_delete before delete on public.commissions for each row execute function block_delete();
drop trigger if exists trg_commissions_guard on public.commissions;
create trigger trg_commissions_guard before update on public.commissions for each row execute function commissions_guard();

drop trigger if exists trg_referral_lock on public.referral_attributions;
create trigger trg_referral_lock before update on public.referral_attributions for each row execute function referral_lock();

drop trigger if exists trg_sales_immutable on public.sales;
create trigger trg_sales_immutable before update on public.sales for each row execute function sales_prevent_core_mutation();
drop trigger if exists trg_sales_no_delete on public.sales;
create trigger trg_sales_no_delete before delete on public.sales for each row execute function block_delete();


-- ──────────────────────────────────────────────────────────────────────────
-- Vérification rapide après exécution :
--   select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- Toutes les tables ci-dessus doivent avoir rowsecurity = true.
-- ──────────────────────────────────────────────────────────────────────────
