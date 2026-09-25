-- PrixChantier — Row Level Security, fonctions et stockage.
--
-- Principe : un utilisateur ne voit et ne modifie QUE les lignes dont
-- organization_id = current_org_id(). Aucune policy pour anon.
-- Les tâches de fond utilisent la clé service (hors navigateur).

alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.mail_connections enable row level security;
alter table public.projects enable row level security;
alter table public.project_documents enable row level security;
alter table public.project_lines enable row level security;
alter table public.suppliers enable row level security;
alter table public.consultations enable row level security;
alter table public.consultation_lines enable row level security;
alter table public.email_messages enable row level security;
alter table public.supplier_responses enable row level security;
alter table public.offers enable row level security;
alter table public.offer_lines enable row level security;
alter table public.activity_logs enable row level security;
alter table public.scheduled_followups enable row level security;
alter table public.jobs enable row level security;
alter table public.rate_limits enable row level security;

-- Aucun accès anonyme à quoi que ce soit.
revoke all on all tables in schema public from anon;

-- organizations -------------------------------------------------------------
create policy org_select on public.organizations for select to authenticated
  using (id = public.current_org_id());
create policy org_update on public.organizations for update to authenticated
  using (id = public.current_org_id()) with check (id = public.current_org_id());
revoke insert, delete on public.organizations from authenticated;

-- users ---------------------------------------------------------------------
create policy users_select on public.users for select to authenticated
  using (organization_id = public.current_org_id());
create policy users_update_self on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and organization_id = public.current_org_id());
revoke insert, delete on public.users from authenticated;
revoke update on public.users from authenticated;
grant update (full_name) on public.users to authenticated;

-- mail_connections : lecture des colonnes non sensibles uniquement ---------
create policy mail_connections_select on public.mail_connections for select to authenticated
  using (organization_id = public.current_org_id());
revoke all on public.mail_connections from authenticated;
grant select (id, organization_id, user_id, provider, email, display_name, status,
              token_expires_at, last_polled_at, last_error, created_at, updated_at)
  on public.mail_connections to authenticated;

-- Tables métier en lecture/écriture pour les membres de l'organisation -----
do $$
declare
  t text;
begin
  foreach t in array array[
    'projects', 'project_documents', 'project_lines', 'suppliers',
    'consultations', 'consultation_lines', 'supplier_responses',
    'offers', 'offer_lines'
  ] loop
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated using (organization_id = public.current_org_id())', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated with check (organization_id = public.current_org_id())', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id())', t);
    execute format(
      'create policy %1$s_delete on public.%1$s for delete to authenticated using (organization_id = public.current_org_id())', t);
  end loop;
end;
$$;

-- email_messages : écrits uniquement par le serveur ------------------------
create policy email_messages_select on public.email_messages for select to authenticated
  using (organization_id = public.current_org_id());
revoke insert, update, delete on public.email_messages from authenticated;

-- activity_logs : append-only ----------------------------------------------
create policy activity_logs_select on public.activity_logs for select to authenticated
  using (organization_id = public.current_org_id());
create policy activity_logs_insert on public.activity_logs for insert to authenticated
  with check (organization_id = public.current_org_id());
revoke update, delete on public.activity_logs from authenticated;

-- scheduled_followups : lecture seule côté client --------------------------
create policy scheduled_followups_select on public.scheduled_followups for select to authenticated
  using (organization_id = public.current_org_id());
revoke insert, update, delete on public.scheduled_followups from authenticated;

-- jobs / rate_limits : serveur uniquement (aucune policy) -------------------
revoke all on public.jobs from authenticated;
revoke all on public.rate_limits from authenticated;

-- ---------------------------------------------------------------------------
-- Création de l'entreprise à l'inscription
-- ---------------------------------------------------------------------------

create function public.create_organization(p_name text, p_full_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_org uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if exists (select 1 from public.users where id = v_uid) then
    raise exception 'already_member' using errcode = '23505';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 or length(p_name) > 200 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  select email into v_email from auth.users where id = v_uid;
  insert into public.organizations (name) values (btrim(p_name)) returning id into v_org;
  insert into public.users (id, organization_id, email, full_name, role)
    values (v_uid, v_org, v_email, nullif(btrim(coalesce(p_full_name, '')), ''), 'owner');
  return v_org;
end;
$$;
revoke all on function public.create_organization(text, text) from public, anon;
grant execute on function public.create_organization(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Vue tableau de bord : compteurs et statut dérivé (jamais désynchronisé)
-- ---------------------------------------------------------------------------

create view public.project_overview
with (security_invoker = true)
as
select
  p.*,
  coalesce(c.consultations_count, 0) as consultations_count,
  coalesce(c.sent_count, 0) as sent_count,
  coalesce(c.responded_count, 0) as responded_count,
  coalesce(c.awaiting_count, 0) as awaiting_count,
  coalesce(o.offers_count, 0) as offers_count,
  case
    when p.closed_at is not null then 'termine'
    when coalesce(c.sent_count, 0) = 0 then 'preparation'
    when coalesce(o.offers_count, 0) > 0 and coalesce(c.awaiting_count, 0) = 0 then 'comparatif_pret'
    when coalesce(c.responded_count, 0) > 0 then 'reponses_en_cours'
    else 'consultation'
  end as status
from public.projects p
left join lateral (
  select
    count(*) filter (where status <> 'annulee') as consultations_count,
    count(*) filter (where status not in ('a_envoyer', 'annulee')) as sent_count,
    count(*) filter (where status in ('repondu', 'reponse_partielle', 'refus')) as responded_count,
    count(*) filter (where status in ('envoye', 'relance_prevue', 'relance')) as awaiting_count
  from public.consultations
  where project_id = p.id
) c on true
left join lateral (
  select count(*) as offers_count
  from public.offers
  where project_id = p.id and is_current
) o on true;

grant select on public.project_overview to authenticated;
revoke all on public.project_overview from anon;

-- ---------------------------------------------------------------------------
-- File de tâches
-- ---------------------------------------------------------------------------

create function public.claim_jobs(p_limit int)
returns setof public.jobs
language sql
security definer
set search_path = ''
as $$
  update public.jobs j
     set status = 'running', locked_at = now(), attempts = j.attempts + 1
   where j.id in (
     select id from public.jobs
      where (status = 'queued' and run_after <= now())
         -- tâche bloquée (processus tué) : on la reprend après 15 minutes
         or (status = 'running' and locked_at < now() - interval '15 minutes')
      order by run_after
      limit p_limit
      for update skip locked
   )
  returning j.*
$$;
revoke all on function public.claim_jobs(int) from public, anon, authenticated;
grant execute on function public.claim_jobs(int) to service_role;

-- ---------------------------------------------------------------------------
-- Rate limiting (fenêtre fixe) — appelé uniquement par le serveur
-- ---------------------------------------------------------------------------

create function public.rate_limit_hit(p_key text, p_window_seconds int, p_max int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into public.rate_limits (key, window_start, count)
    values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  delete from public.rate_limits where window_start < now() - interval '1 day';
  return v_count <= p_max;
end;
$$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;

-- ---------------------------------------------------------------------------
-- Stockage : bucket privé, un dossier racine par organisation
--   /organization_id/project_id/{source,consultations,responses,exports}/
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('files', 'files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

create policy files_select on storage.objects for select to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = public.current_org_id()::text);
create policy files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'files' and (storage.foldername(name))[1] = public.current_org_id()::text);
create policy files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'files' and (storage.foldername(name))[1] = public.current_org_id()::text);
