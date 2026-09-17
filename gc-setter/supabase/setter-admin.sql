-- =============================================================================
-- GC Setter — espace admin privé sur la table existante setter_applications.
--
-- Projet Supabase : setter-hunter (wscuqzjhmpyytsczqbjb)
-- À exécuter une fois dans le SQL Editor Supabase. Le script est idempotent.
--
-- Ce qu'il fait :
--   1. déclare les e-mails administrateurs autorisés ;
--   2. remplace la policy "staff full access" (qui ouvrait la table à TOUT
--      compte authentifié) par des policies limitées à ces e-mails ;
--   3. ajoute le jeton d'onboarding et la fonction de lecture publique associée ;
--   4. horodate accepted_at / rejected_at automatiquement ;
--   5. active la réplication temps réel pour le dashboard.
--
-- Ce qu'il NE touche PAS : la policy "public can submit application", qui
-- autorise le formulaire public (rôle anon) à INSÉRER. Le flux
-- candidat -> setter_applications -> dashboard reste intact.
-- =============================================================================

-- 1. Administrateurs autorisés -----------------------------------------------
create table if not exists public.setter_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.setter_admins enable row level security;

insert into public.setter_admins (email) values
  ('ledorvenzo50@gmail.com')
on conflict (email) do nothing;

-- SECURITY DEFINER : les policies doivent pouvoir lire setter_admins même quand
-- l'appelant n'a aucun droit dessus.
create or replace function public.is_setter_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.setter_admins a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_setter_admin() from public;
grant execute on function public.is_setter_admin() to authenticated, anon;

drop policy if exists "admins can read admin list" on public.setter_admins;
create policy "admins can read admin list"
  on public.setter_admins for select
  to authenticated
  using (public.is_setter_admin());

-- 2. Candidatures : lecture et décisions réservées aux administrateurs -------
drop policy if exists "staff full access" on public.setter_applications;

drop policy if exists "admin read applications" on public.setter_applications;
create policy "admin read applications"
  on public.setter_applications for select
  to authenticated
  using (public.is_setter_admin());

drop policy if exists "admin update applications" on public.setter_applications;
create policy "admin update applications"
  on public.setter_applications for update
  to authenticated
  using (public.is_setter_admin())
  with check (public.is_setter_admin());

drop policy if exists "admin insert applications" on public.setter_applications;
create policy "admin insert applications"
  on public.setter_applications for insert
  to authenticated
  with check (public.is_setter_admin());

drop policy if exists "admin delete applications" on public.setter_applications;
create policy "admin delete applications"
  on public.setter_applications for delete
  to authenticated
  using (public.is_setter_admin());

-- 3. Onboarding ---------------------------------------------------------------
alter table public.setter_applications
  add column if not exists onboarding_token uuid not null default gen_random_uuid();

create unique index if not exists setter_applications_onboarding_token_key
  on public.setter_applications (onboarding_token);

create index if not exists setter_applications_status_created_idx
  on public.setter_applications (status, created_at desc);

-- Lecture publique STRICTEMENT limitée : uniquement sur présentation du jeton,
-- uniquement si la candidature est acceptée, uniquement les champs d'accueil.
create or replace function public.get_setter_onboarding(p_token uuid)
returns table (
  full_name text,
  email text,
  status text,
  whatsapp_invite_url text,
  contract_url text,
  guide_url text,
  accepted_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.full_name, a.email, a.status,
         a.whatsapp_invite_url, a.contract_url, a.guide_url, a.accepted_at
  from public.setter_applications a
  where a.onboarding_token = p_token
    and a.status = 'accepted';
$$;

revoke all on function public.get_setter_onboarding(uuid) from public;
grant execute on function public.get_setter_onboarding(uuid) to anon, authenticated;

-- 4. Horodatage des décisions -------------------------------------------------
create or replace function public.setter_applications_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then
    if new.status = 'accepted' then
      new.accepted_at := coalesce(new.accepted_at, now());
      new.rejected_at := null;
    elsif new.status = 'rejected' then
      new.rejected_at := coalesce(new.rejected_at, now());
      new.accepted_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists setter_applications_touch on public.setter_applications;
create trigger setter_applications_touch
  before update on public.setter_applications
  for each row execute function public.setter_applications_touch();

-- 5. Temps réel ---------------------------------------------------------------
-- Le dashboard écoute postgres_changes sur cette table pour afficher
-- « Nouvelle candidature » sans rechargement.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'setter_applications'
  ) then
    execute 'alter publication supabase_realtime add table public.setter_applications';
  end if;
end;
$$;

alter table public.setter_applications replica identity full;
