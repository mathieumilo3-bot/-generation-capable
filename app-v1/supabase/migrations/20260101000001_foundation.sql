-- ════════════════════════════════════════════════════════════════════════
-- 0001 — Fondation : schéma privé, rôles staff, profils, organisations
-- ════════════════════════════════════════════════════════════════════════
-- Principes :
--   * RLS activée sur TOUTE table exposée ; aucune policy permissive "pour
--     que ça marche".
--   * Les autorisations ne lisent JAMAIS user_metadata (modifiable par
--     l'utilisateur) : rôles staff = table `staff_roles` (écriture
--     service_role uniquement) ; rôles d'organisation = `organization_members`.
--   * Fonctions d'aide dans le schéma `private` (non exposé par PostgREST).
--   * Toutes les fonctions SECURITY DEFINER fixent `search_path = ''`.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

-- ── Utilitaires ─────────────────────────────────────────────────────────
create or replace function private.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function private.forbid_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'append_only: % is immutable', tg_table_name using errcode = '42501';
end $$;

create or replace function private.try_uuid(p text)
returns uuid language plpgsql immutable as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;

-- ── Rôles staff (back-office) ───────────────────────────────────────────
create table public.staff_roles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('support', 'admin')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
alter table public.staff_roles enable row level security;

create or replace function private.staff_role()
returns text language sql stable security definer set search_path = '' as $$
  select role from public.staff_roles where user_id = (select auth.uid());
$$;

create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_roles where user_id = (select auth.uid()));
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff_roles where user_id = (select auth.uid()) and role = 'admin');
$$;

create policy staff_roles_select_own on public.staff_roles
  for select to authenticated using (user_id = (select auth.uid()));

-- ── Profils ─────────────────────────────────────────────────────────────
create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  email              text,
  first_name         text check (char_length(first_name) <= 80),
  last_name          text check (char_length(last_name) <= 80),
  company            text check (char_length(company) <= 120),
  locale             text not null default 'fr' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  avatar_path        text,
  status             text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  -- Facturation B2B : {name, company, address, postal_code, city, country, vat_number, email}
  billing            jsonb not null default '{}'::jsonb check (jsonb_typeof(billing) = 'object'),
  acquisition        jsonb not null default '{}'::jsonb,
  app_version        text,
  platform           text,
  last_seen_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));
create trigger profiles_updated before update on public.profiles
  for each row execute function private.set_updated_at();
alter table public.profiles enable row level security;

-- ── Organisations (agences) ─────────────────────────────────────────────
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 120),
  slug       text unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  created_by uuid references auth.users(id) on delete set null,
  status     text not null default 'active' check (status in ('active', 'suspended')),
  billing    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated before update on public.organizations
  for each row execute function private.set_updated_at();
alter table public.organizations enable row level security;

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members (user_id);
alter table public.organization_members enable row level security;

-- Rang numérique d'un rôle d'organisation (viewer < editor < admin < owner).
create or replace function private.role_rank(p_role text)
returns int language sql immutable as $$
  select case p_role when 'viewer' then 1 when 'editor' then 2 when 'admin' then 3 when 'owner' then 4 else 0 end;
$$;

-- Le rôle de l'utilisateur courant dans une organisation (null si non membre).
create or replace function private.org_role(p_org uuid)
returns text language sql stable security definer set search_path = '' as $$
  select role from public.organization_members
  where organization_id = p_org and user_id = (select auth.uid());
$$;

create or replace function private.has_org_role(p_org uuid, p_min text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.role_rank(private.org_role(p_org)) >= private.role_rank(p_min), false);
$$;

-- Politiques profils : lecture/édition de son propre profil, staff en lecture.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_select_staff on public.profiles
  for select to authenticated using (private.is_staff());
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and status = 'active')
  with check (id = (select auth.uid()));

create policy organizations_select_member on public.organizations
  for select to authenticated using (private.org_role(id) is not null or private.is_staff());
create policy organization_members_select on public.organization_members
  for select to authenticated
  using (user_id = (select auth.uid()) or private.org_role(organization_id) is not null or private.is_staff());
