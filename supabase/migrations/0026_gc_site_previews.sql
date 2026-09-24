-- GC Preview Engine V2 — persisted previews.
--
-- Same security model as gc_audit_leads: RLS on, NO policy, table privileges
-- revoked from every client role. Everything goes through SECURITY DEFINER
-- RPCs gated by gc_audit_secret_ok(p_secret) (the server-side secret already
-- used by the audit funnel). No RPC lets a client list previews: reads need a
-- UUID, and the application additionally checks an HMAC read token.

create table if not exists public.gc_site_previews (
  id uuid primary key,
  preview_token_hash text not null default '',
  idempotency_key text not null unique,
  lead_id uuid null,
  company_name text not null default '',
  siren text null,
  official_domain text null,
  fingerprint text null,
  status text not null default 'running' check (status in ('running', 'needs_input', 'ready', 'failed')),
  stage text not null default 'identity',
  needs text null check (needs is null or needs in ('city', 'site')),
  input jsonb not null default '{}'::jsonb,
  attribution jsonb not null default '{}'::jsonb,
  pipeline jsonb not null default '{}'::jsonb,
  work jsonb not null default '{}'::jsonb,
  company_profile jsonb null,
  audit_report jsonb null,
  preview_blueprint jsonb null,
  email text null,
  notified_at timestamptz null,
  lease_id uuid null,
  lease_until timestamptz null,
  engine_version text not null default '',
  error_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz null,
  expires_at timestamptz not null default (now() + interval '30 days')
);

create index if not exists gc_site_previews_fingerprint_idx on public.gc_site_previews (fingerprint, status, updated_at desc);
create index if not exists gc_site_previews_active_idx on public.gc_site_previews (status, updated_at) where status in ('running', 'ready');

alter table public.gc_site_previews enable row level security;
revoke all on table public.gc_site_previews from public, anon, authenticated;

-- A row as the application sees it: never the token hash, idempotency key or lease internals.
create or replace function public.gc_preview_public(r public.gc_site_previews)
returns jsonb
language sql
immutable
set search_path to 'public'
as $$
  select to_jsonb(r) - 'preview_token_hash' - 'idempotency_key' - 'lease_id' - 'lease_until'
$$;

create or replace function public.gc_preview_create(
  p_secret text, p_id uuid, p_idempotency_key text, p_token_hash text, p_company_name text,
  p_input jsonb, p_attribution jsonb, p_pipeline jsonb, p_work jsonb, p_stage text, p_engine_version text
) returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare r public.gc_site_previews;
begin
  if not public.gc_audit_secret_ok(p_secret) then raise exception 'unauthorized'; end if;
  if length(coalesce(p_idempotency_key, '')) < 16 or length(p_idempotency_key) > 64 then raise exception 'invalid_idempotency_key'; end if;
  if length(trim(coalesce(p_company_name, ''))) < 2 then raise exception 'invalid_company'; end if;
  if octet_length(coalesce(p_work, '{}'::jsonb)::text) > 200000 then raise exception 'payload_too_large'; end if;

  insert into public.gc_site_previews (id, preview_token_hash, idempotency_key, company_name, input, attribution, pipeline, work, stage, engine_version)
  values (p_id, left(coalesce(p_token_hash, ''), 128), p_idempotency_key, left(trim(p_company_name), 160),
          coalesce(p_input, '{}'::jsonb), coalesce(p_attribution, '{}'::jsonb), coalesce(p_pipeline, '{}'::jsonb),
          coalesce(p_work, '{}'::jsonb), left(coalesce(p_stage, 'identity'), 32), left(coalesce(p_engine_version, ''), 40))
  on conflict (idempotency_key) do nothing;

  select * into r from public.gc_site_previews where idempotency_key = p_idempotency_key;
  return public.gc_preview_public(r);
end;
$$;

create or replace function public.gc_preview_get(p_secret text, p_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare r public.gc_site_previews;
begin
  if not public.gc_audit_secret_ok(p_secret) then raise exception 'unauthorized'; end if;
  select * into r from public.gc_site_previews where id = p_id;
  if not found then return null; end if;
  return public.gc_preview_public(r);
end;
$$;

create or replace function public.gc_preview_claim(p_secret text, p_id uuid, p_lease_ms integer)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare
  r public.gc_site_previews;
  v_lease uuid := gen_random_uuid();
begin
  if not public.gc_audit_secret_ok(p_secret) then raise exception 'unauthorized'; end if;
  update public.gc_site_previews
     set lease_id = v_lease,
         lease_until = now() + make_interval(secs => greatest(1000, least(coalesce(p_lease_ms, 12000), 60000)) / 1000.0)
   where id = p_id and (lease_until is null or lease_until < now())
  returning * into r;
  if found then
    return jsonb_build_object('claimed', true, 'lease_id', v_lease, 'row', public.gc_preview_public(r));
  end if;
  select * into r from public.gc_site_previews where id = p_id;
  if not found then return jsonb_build_object('claimed', false, 'lease_id', null, 'row', null); end if;
  return jsonb_build_object('claimed', false, 'lease_id', null, 'row', public.gc_preview_public(r));
end;
$$;

create or replace function public.gc_preview_save(p_secret text, p_id uuid, p_lease_id uuid, p_patch jsonb)
returns boolean
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.gc_audit_secret_ok(p_secret) then raise exception 'unauthorized'; end if;
  if octet_length(coalesce(p_patch, '{}'::jsonb)::text) > 1500000 then raise exception 'payload_too_large'; end if;
  update public.gc_site_previews set
    status = coalesce(p_patch->>'status', status),
    stage = coalesce(left(p_patch->>'stage', 32), stage),
    needs = case when p_patch ? 'needs' then p_patch->>'needs' else needs end,
    company_name = coalesce(nullif(left(p_patch->>'company_name', 160), ''), company_name),
    siren = case when p_patch ? 'siren' then left(p_patch->>'siren', 20) else siren end,
    official_domain = case when p_patch ? 'official_domain' then left(p_patch->>'official_domain', 255) else official_domain end,
    fingerprint = case when p_patch ? 'fingerprint' then left(p_patch->>'fingerprint', 80) else fingerprint end,
    pipeline = coalesce(p_patch->'pipeline', pipeline),
    work = coalesce(p_patch->'work', work),
    company_profile = case when p_patch ? 'company_profile' then p_patch->'company_profile' else company_profile end,
    audit_report = case when p_patch ? 'audit_report' then p_patch->'audit_report' else audit_report end,
    preview_blueprint = case when p_patch ? 'preview_blueprint' then p_patch->'preview_blueprint' else preview_blueprint end,
    engine_version = coalesce(left(p_patch->>'engine_version', 40), engine_version),
    error_code = case when p_patch ? 'error_code' then left(p_patch->>'error_code', 80) else error_code end,
    ready_at = case when p_patch ? 'ready_at' then (p_patch->>'ready_at')::timestamptz else ready_at end,
    expires_at = case when p_patch ? 'expires_at' and p_patch->>'expires_at' is not null then (p_patch->>'expires_at')::timestamptz else expires_at end,
    updated_at = now(),
    lease_id = null,
    lease_until = null
  where id = p_id and lease_id = p_lease_id;
  return found;
end;
$$;

create or replace function public.gc_preview_find(p_secret text, p_fingerprint text, p_statuses text[], p_max_age_hours integer, p_exclude_id uuid default null)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
declare r public.gc_site_previews;
begin
  if not public.gc_audit_secret_ok(p_secret) then raise exception 'unauthorized'; end if;
  select * into r from public.gc_site_previews
   where fingerprint = p_fingerprint
     and status = any(p_statuses)
     and (p_exclude_id is null or id <> p_exclude_id)
     and updated_at > now() - make_interval(hours => greatest(1, least(coalesce(p_max_age_hours, 24), 24 * 30)))
     and expires_at > now()
   order by updated_at desc
   limit 1;
  if not found then return null; end if;
  return public.gc_preview_public(r);
end;
$$;

create or replace function public.gc_preview_list_active(p_secret text, p_limit integer default 10)
returns jsonb
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.gc_audit_secret_ok(p_secret) then raise exception 'unauthorized'; end if;
  return coalesce((
    select jsonb_agg(public.gc_preview_public(r))
      from (
        select * from public.gc_site_previews
         where (status = 'running' and (lease_until is null or lease_until < now()) and updated_at > now() - interval '2 hours')
            or (status = 'ready' and email is not null and notified_at is null and ready_at > now() - interval '48 hours')
         order by updated_at asc
         limit greatest(1, least(coalesce(p_limit, 10), 30))
      ) r
  ), '[]'::jsonb);
end;
$$;

create or replace function public.gc_preview_set_email(p_secret text, p_id uuid, p_email text, p_lead_id uuid)
returns boolean
language plpgsql security definer set search_path to 'public'
as $$
declare v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not public.gc_audit_secret_ok(p_secret) then raise exception 'unauthorized'; end if;
  if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' or length(v_email) > 254 then raise exception 'invalid_email'; end if;
  update public.gc_site_previews
     set email = v_email, lead_id = coalesce(p_lead_id, lead_id), updated_at = now()
   where id = p_id;
  return found;
end;
$$;

create or replace function public.gc_preview_mark_notified(p_secret text, p_id uuid)
returns boolean
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not public.gc_audit_secret_ok(p_secret) then raise exception 'unauthorized'; end if;
  update public.gc_site_previews set notified_at = now()
   where id = p_id and email is not null and notified_at is null;
  return found;
end;
$$;

-- Retention: previews (and the e-mail attached to them) disappear a week after expiry.
create or replace function public.gc_preview_purge(p_secret text)
returns integer
language plpgsql security definer set search_path to 'public'
as $$
declare n integer;
begin
  if not public.gc_audit_secret_ok(p_secret) then raise exception 'unauthorized'; end if;
  delete from public.gc_site_previews where expires_at < now() - interval '7 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.gc_preview_public(public.gc_site_previews) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'gc_preview_create(text, uuid, text, text, text, jsonb, jsonb, jsonb, jsonb, text, text)',
    'gc_preview_get(text, uuid)',
    'gc_preview_claim(text, uuid, integer)',
    'gc_preview_save(text, uuid, uuid, jsonb)',
    'gc_preview_find(text, text, text[], integer, uuid)',
    'gc_preview_list_active(text, integer)',
    'gc_preview_set_email(text, uuid, text, uuid)',
    'gc_preview_mark_notified(text, uuid)',
    'gc_preview_purge(text)'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated, service_role', f);
  end loop;
end $$;
