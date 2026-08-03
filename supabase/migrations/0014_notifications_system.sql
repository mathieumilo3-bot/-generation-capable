-- ══════════════════════════════════════════════════════════════════════════
-- Génération Capable — Système de notifications intelligentes
-- ══════════════════════════════════════════════════════════════════════════
-- Schéma pour le moteur de notifications multi-canal :
--   - Push web (VAPID) pour les comptes authentifiés (admin, vendeurs) —
--     fonctionne même app/onglet fermé une fois l'abonnement Push créé par
--     le navigateur, y compris sur mobile (Android nativement, iOS 16.4+ en
--     PWA installée sur l'écran d'accueil).
--   - Email (Resend) pour les prospects anonymes qui n'ont pas encore de
--     compte donc ne peuvent pas détenir d'abonnement Push.
--
-- Principe repris du reste du schéma (voir 0006) : aucune maturation par
-- cron pour les états qui peuvent être calculés en direct ; là où un cron
-- est réellement nécessaire (envoi programmé d'un message, healthcheck),
-- il est explicite et documenté dans les Netlify Functions correspondantes,
-- jamais implicite.
--
-- Toutes les tables sont idempotentes (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- ──────────────────────────────────────────────────────────────────────────
-- 1. PUSH_SUBSCRIPTIONS — un navigateur/appareil = un abonnement Push
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null,
  p256dh       text not null,
  auth_key     text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz
);

create unique index if not exists push_subscriptions_endpoint_key on public.push_subscriptions (endpoint);
create index if not exists push_subscriptions_user_active_idx on public.push_subscriptions (user_id) where revoked_at is null;

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select_own on public.push_subscriptions;
create policy push_subscriptions_select_own on public.push_subscriptions for select
  using (auth.uid() = user_id);
drop policy if exists push_subscriptions_insert_own on public.push_subscriptions;
create policy push_subscriptions_insert_own on public.push_subscriptions for insert
  with check (auth.uid() = user_id);
drop policy if exists push_subscriptions_update_own on public.push_subscriptions;
create policy push_subscriptions_update_own on public.push_subscriptions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists push_subscriptions_delete_own on public.push_subscriptions;
create policy push_subscriptions_delete_own on public.push_subscriptions for delete
  using (auth.uid() = user_id);
-- Le chemin principal (push-subscribe.js) écrit en service_role après avoir
-- vérifié le token lui-même, comme ambassador-data.js — ces policies ne
-- servent qu'un éventuel accès direct depuis le client.


-- ──────────────────────────────────────────────────────────────────────────
-- 2. NOTIFICATION_PREFERENCES — un réglage par utilisateur, toutes
--    catégories confondues (admin ET vendeur ; les clés de "categories"
--    diffèrent selon le rôle, contrôlé côté application par
--    notification-preferences.js, jamais ici)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.notification_preferences (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  enabled            boolean not null default true,
  timezone           text not null default 'Europe/Paris',
  -- Fenêtre horaire pendant laquelle les messages non-urgents (coaching
  -- vendeur, digests admin) peuvent être envoyés — "choisir les horaires".
  active_hours_start smallint not null default 8  check (active_hours_start between 0 and 23),
  active_hours_end   smallint not null default 20 check (active_hours_end between 0 and 23),
  -- "choisir la fréquence" : normal = tout ; reduced = jalons + 1 point/jour ;
  -- minimal = uniquement les jalons personnels critiques (vente, record).
  frequency          text not null default 'normal' check (frequency in ('normal','reduced','minimal')),
  -- "choisir les catégories" : override booléen par catégorie ; une clé
  -- absente = activée par défaut pour le rôle concerné.
  categories         jsonb not null default '{}'::jsonb,
  updated_at         timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences for select
  using (auth.uid() = user_id);
-- Pas de policy insert/update directe : passe par set_my_notification_preferences()
-- ci-dessous, qui borne strictement les valeurs acceptées (comme update_my_profile).

create or replace function public.get_my_notification_preferences()
returns public.notification_preferences
language plpgsql
security definer
set search_path to 'public'
stable
as $$
declare v_row public.notification_preferences;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select * into v_row from public.notification_preferences where user_id = auth.uid();
  if v_row.user_id is null then
    v_row.user_id := auth.uid();
    v_row.enabled := true;
    v_row.timezone := 'Europe/Paris';
    v_row.active_hours_start := 8;
    v_row.active_hours_end := 20;
    v_row.frequency := 'normal';
    v_row.categories := '{}'::jsonb;
    v_row.updated_at := now();
  end if;
  return v_row;
end;
$$;
revoke all on function public.get_my_notification_preferences() from public;
revoke all on function public.get_my_notification_preferences() from anon;
grant execute on function public.get_my_notification_preferences() to authenticated;

create or replace function public.set_my_notification_preferences(
  p_enabled boolean,
  p_timezone text,
  p_active_hours_start smallint,
  p_active_hours_end smallint,
  p_frequency text,
  p_categories jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if p_frequency not in ('normal','reduced','minimal') then raise exception 'Fréquence invalide'; end if;
  if p_active_hours_start is null or p_active_hours_start < 0 or p_active_hours_start > 23 then raise exception 'Heure de début invalide'; end if;
  if p_active_hours_end is null or p_active_hours_end < 0 or p_active_hours_end > 23 then raise exception 'Heure de fin invalide'; end if;
  if p_categories is null or jsonb_typeof(p_categories) <> 'object' then p_categories := '{}'::jsonb; end if;
  if length(coalesce(p_timezone,'')) = 0 or length(p_timezone) > 64 then p_timezone := 'Europe/Paris'; end if;

  insert into public.notification_preferences
    (user_id, enabled, timezone, active_hours_start, active_hours_end, frequency, categories, updated_at)
  values
    (auth.uid(), coalesce(p_enabled,true), p_timezone, p_active_hours_start, p_active_hours_end, p_frequency, p_categories, now())
  on conflict (user_id) do update set
    enabled = excluded.enabled,
    timezone = excluded.timezone,
    active_hours_start = excluded.active_hours_start,
    active_hours_end = excluded.active_hours_end,
    frequency = excluded.frequency,
    categories = excluded.categories,
    updated_at = now();
end;
$$;
revoke all on function public.set_my_notification_preferences(boolean, text, smallint, smallint, text, jsonb) from public;
revoke all on function public.set_my_notification_preferences(boolean, text, smallint, smallint, text, jsonb) from anon;
grant execute on function public.set_my_notification_preferences(boolean, text, smallint, smallint, text, jsonb) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- 3. NOTIFICATION_LOG — journal append-only : anti-répétition (jamais deux
--    fois la même variante d'affilée), déduplication (jamais deux fois le
--    même évènement) et visibilité admin/utilisateur.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.notification_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  audience    text not null check (audience in ('user','admin')),
  user_id     uuid references auth.users(id) on delete cascade,
  category    text not null,
  event_key   text not null,
  variant_key text,
  title       text not null,
  body        text not null,
  status      text not null check (status in ('sent','skipped_pref','skipped_quiet_hours','skipped_no_subscription','failed')),
  metadata    jsonb not null default '{}'::jsonb
);

create index if not exists notification_log_dedup_idx on public.notification_log (audience, user_id, category, event_key);
create index if not exists notification_log_user_recent_idx on public.notification_log (user_id, category, created_at desc);

alter table public.notification_log enable row level security;
drop policy if exists notification_log_select_admin on public.notification_log;
create policy notification_log_select_admin on public.notification_log for select using (is_current_user_admin());
drop policy if exists notification_log_select_own on public.notification_log;
create policy notification_log_select_own on public.notification_log for select
  using (audience = 'user' and auth.uid() = user_id);
-- Aucune policy insert : uniquement service_role (moteur d'envoi).


-- ──────────────────────────────────────────────────────────────────────────
-- 4. SELLER_DAILY_GOALS — "As-tu défini ton objectif aujourd'hui ?"
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.seller_daily_goals (
  id             uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references auth.users(id) on delete cascade,
  goal_date      date not null,
  target_contacts integer check (target_contacts is null or target_contacts > 0),
  created_at     timestamptz not null default now(),
  unique (seller_user_id, goal_date)
);

alter table public.seller_daily_goals enable row level security;
drop policy if exists seller_daily_goals_select_own on public.seller_daily_goals;
create policy seller_daily_goals_select_own on public.seller_daily_goals for select
  using (auth.uid() = seller_user_id or is_current_user_admin());

create or replace function public.set_my_daily_goal(p_goal_date date, p_target_contacts integer default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if p_goal_date is null then raise exception 'Date requise'; end if;
  if p_target_contacts is not null and p_target_contacts <= 0 then raise exception 'Objectif invalide'; end if;

  insert into public.seller_daily_goals (seller_user_id, goal_date, target_contacts)
  values (auth.uid(), p_goal_date, p_target_contacts)
  on conflict (seller_user_id, goal_date) do update set target_contacts = excluded.target_contacts;
end;
$$;
revoke all on function public.set_my_daily_goal(date, integer) from public;
revoke all on function public.set_my_daily_goal(date, integer) from anon;
grant execute on function public.set_my_daily_goal(date, integer) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- 5. MARKETING_LEADS — prospects anonymes qui ont laissé leurs coordonnées
--    (formulaire d'inscription) sans finaliser leur paiement. Séquence
--    email 30min / 24h / 3j / 7j pilotée par notify-cron-leads.js.
--    RLS volontairement sans AUCUNE policy anon/authenticated (comme
--    "admins") : ce sont des données de contact de non-membres, seul le
--    service_role (Netlify Functions) y accède.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.marketing_leads (
  id             uuid primary key default gen_random_uuid(),
  email          text,
  phone          text,
  first_name     text,
  source         text,
  created_at     timestamptz not null default now(),
  converted      boolean not null default false,
  converted_at   timestamptz,
  sequence_step  integer not null default 0,
  next_send_at   timestamptz not null default (now() + interval '30 minutes'),
  stopped        boolean not null default false,
  metadata       jsonb not null default '{}'::jsonb
);

-- Index simple sur "email" (pas lower(email)) : PostgREST traduit
-- "on_conflict=email" en "ON CONFLICT (email)", qui ne peut cibler qu'un
-- index unique défini exactement sur cette colonne. La normalisation
-- (minuscules) est donc faite à l'écriture, côté application
-- (capture-lead.js / stripe-webhook.js), jamais ici.
create unique index if not exists marketing_leads_email_key on public.marketing_leads (email) where email is not null;
create index if not exists marketing_leads_due_idx on public.marketing_leads (next_send_at)
  where converted = false and stopped = false;

alter table public.marketing_leads enable row level security;
-- Aucune policy : accès exclusivement service_role.


-- ──────────────────────────────────────────────────────────────────────────
-- 6. NOTIFICATION_CRON_STATE — curseur "dernier passage" pour les scanners
--    périodiques (évite de rescanner tout l'historique à chaque tick).
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.notification_cron_state (
  job_name     text primary key,
  last_run_at  timestamptz not null default (now() - interval '1 hour')
);

alter table public.notification_cron_state enable row level security;
drop policy if exists notification_cron_state_select_admin on public.notification_cron_state;
create policy notification_cron_state_select_admin on public.notification_cron_state for select using (is_current_user_admin());
-- Aucune policy insert/update : service_role uniquement.


-- ──────────────────────────────────────────────────────────────────────────
-- 7. SERVICE_HEALTH_STATE — détection de transition up/down pour n'alerter
--    l'admin qu'au changement d'état ("Site indisponible" puis "rétabli"),
--    jamais en boucle à chaque tick pendant une panne prolongée.
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.service_health_state (
  check_name          text primary key,
  is_up               boolean not null default true,
  consecutive_failures integer not null default 0,
  last_latency_ms     integer,
  last_status_change  timestamptz not null default now(),
  slow_alerted_at     timestamptz
);

alter table public.service_health_state enable row level security;
drop policy if exists service_health_state_select_admin on public.service_health_state;
create policy service_health_state_select_admin on public.service_health_state for select using (is_current_user_admin());


-- ──────────────────────────────────────────────────────────────────────────
-- 8. PLATFORM_RECORDS — records battus (CA du jour, plus grosse vente) pour
--    "Record de ventes" admin ; les records personnels vendeur sont
--    calculés en direct depuis "sales" (jamais dupliqués ici).
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.platform_records (
  metric       text primary key,
  value        numeric not null default 0,
  achieved_at  timestamptz not null default now()
);

alter table public.platform_records enable row level security;
drop policy if exists platform_records_select_admin on public.platform_records;
create policy platform_records_select_admin on public.platform_records for select using (is_current_user_admin());


-- ──────────────────────────────────────────────────────────────────────────
-- Vérification rapide après exécution :
--   select tablename, rowsecurity from pg_tables where schemaname = 'public'
--   and tablename in ('push_subscriptions','notification_preferences',
--   'notification_log','seller_daily_goals','marketing_leads',
--   'notification_cron_state','service_health_state','platform_records');
-- ──────────────────────────────────────────────────────────────────────────
