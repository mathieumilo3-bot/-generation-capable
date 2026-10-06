-- ════════════════════════════════════════════════════════════════════════
-- 0015 — Conservation 24 h maximum, modifications désactivées (flag), acceptation des conditions
-- ════════════════════════════════════════════════════════════════════════

-- ── Réglages ────────────────────────────────────────────────────────────
delete from public.app_settings where key in ('retention.raw_days', 'retention.renders_days');
insert into public.app_settings (key, value, is_public, description) values
  ('retention.raw_hours',     '24'::jsonb, true, 'Conservation MAXIMALE des fichiers envoyés (heures) — au-delà ils sont supprimés'),
  ('retention.renders_hours', '24'::jsonb, true, 'Conservation MAXIMALE des vidéos produites et miniatures (heures) — au-delà elles sont supprimées'),
  ('features.revisions',      'false'::jsonb, true, 'Modifications / nouvelles versions : désactivées pour le moment (le code et le moteur les supportent)'),
  ('features.password_login', 'false'::jsonb, true, 'Connexion par mot de passe : UNIQUEMENT pour le compte de test App Review (laisser false sinon)'),
  ('urls.sales_terms',  '"https://example.com/conditions-de-vente"'::jsonb, true, 'Conditions générales de vente'),
  ('urls.legal_notice', '"https://example.com/mentions-legales"'::jsonb, true, 'Mentions légales'),
  ('legal.terms_version',     '"2026-10-06"'::jsonb, true, 'Version courante des CGU/CGV/confidentialité (incrémenter à chaque changement substantiel)')
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public, description = excluded.description;

-- ── Versions : date d'expiration + purge ───────────────────────────────
alter table public.project_versions add column expires_at timestamptz;
alter table public.project_versions add column purged_at timestamptz;
alter table public.project_versions drop constraint project_versions_status_check;
alter table public.project_versions add constraint project_versions_status_check
  check (status in ('pending', 'ready', 'failed', 'expired'));
create index project_versions_expiry_idx on public.project_versions (expires_at) where status = 'ready' and purged_at is null;

-- Succès d'un job : le rendu est livré avec une date d'expiration (réglage serveur).
create or replace function public.svc_job_complete(
  p_job_id uuid, p_render_path text, p_thumbnail_path text, p_duration_sec numeric,
  p_width integer default null, p_height integer default null, p_size_bytes bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare j public.video_jobs; h public.wallet_holds;
  v_hours int := coalesce((private.setting('retention.renders_hours'))::int, 24);
begin
  select * into j from public.video_jobs where id = p_job_id for update;
  if not found then raise exception 'job_not_found' using errcode = 'P0002'; end if;
  if j.status = 'completed' then return jsonb_build_object('ok', true, 'replayed', true); end if;
  if j.status in ('failed', 'cancelled') then return jsonb_build_object('ok', false, 'code', 'job_not_active'); end if;
  if coalesce(p_render_path, '') = '' then raise exception 'render_path_required' using errcode = '22023'; end if;

  perform 1 from public.projects where id = j.project_id for update;

  select * into h from public.wallet_holds where job_id = p_job_id for update;
  if found and h.status = 'held' then
    perform private.wallet_apply(h.wallet_id, 'capture', h.amount_cents, 'capture:' || p_job_id, null,
      j.project_id, p_job_id, h.id, case when j.kind = 'revision' then 'Modification vidéo' else 'Montage vidéo' end,
      '{}'::jsonb, null);
    update public.wallet_holds set status = 'captured', resolved_at = now() where id = h.id;
  end if;

  update public.project_versions
     set status = 'ready', render_path = p_render_path, thumbnail_path = p_thumbnail_path,
         duration_sec = p_duration_sec, width = p_width, height = p_height, size_bytes = p_size_bytes,
         ready_at = now(), expires_at = now() + make_interval(hours => v_hours)
   where id = j.version_id;
  update public.projects
     set status = 'ready', current_version_id = j.version_id, thumbnail_path = coalesce(p_thumbnail_path, thumbnail_path)
   where id = j.project_id;
  update public.video_jobs
     set status = 'completed', progress = 100, current_stage = 'done', completed_at = now(), locked_until = null
   where id = p_job_id;
  update public.video_job_internals set locked_by = null where job_id = p_job_id;

  insert into public.usage_costs (job_id, user_id, revenue_cents) values (p_job_id, j.user_id, j.price_cents)
  on conflict (job_id) do update set revenue_cents = excluded.revenue_cents;

  perform private.notify(j.user_id,
    case when j.kind = 'revision' then 'revision_ready' else 'video_ready' end,
    case when j.kind = 'revision' then 'Votre nouvelle version est prête' else 'Votre vidéo est prête' end,
    'Téléchargez-la dans les ' || v_hours || ' h : elle est ensuite supprimée.',
    jsonb_build_object('project_id', j.project_id, 'version_id', j.version_id, 'deep_link', 'project/' || j.project_id),
    'job:' || j.id || ':done');
  perform private.log_job_event(p_job_id, 'billing', 'info', 'complete', 'Rendu livré — montant encaissé',
    jsonb_build_object('price_cents', j.price_cents, 'expires_in_hours', v_hours));
  return jsonb_build_object('ok', true, 'captured_cents', coalesce(h.amount_cents, 0));
end $$;

-- Suppression d'un projet par l'utilisateur : ses rendus sont à purger immédiatement du Storage.
create or replace function public.delete_project(p_project_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not private.can_write_project(p_project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.video_jobs where project_id = p_project_id
             and status not in ('completed', 'failed', 'cancelled')) then
    return jsonb_build_object('ok', false, 'code', 'job_in_progress');
  end if;
  update public.projects set deleted_at = now(), status = 'archived' where id = p_project_id;
  update public.assets set status = 'deleted' where project_id = p_project_id and status <> 'deleted';
  update public.project_versions set expires_at = now() where project_id = p_project_id and status = 'ready' and purged_at is null;
  return jsonb_build_object('ok', true);
end $$;

-- ── Expiration et purge (appelées par l'orchestrateur) ──────────────────
-- Marque comme supprimés les fichiers envoyés au-delà de la durée de conservation (sauf si un job les utilise encore).
create or replace function public.svc_expire_content()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_hours int := coalesce((private.setting('retention.raw_hours'))::int, 24); n int;
begin
  update public.assets a set status = 'deleted'
   where a.status in ('pending', 'uploaded', 'failed')
     and a.created_at < now() - make_interval(hours => v_hours)
     and not exists (select 1 from public.video_jobs j where j.project_id = a.project_id
                      and j.status not in ('completed', 'failed', 'cancelled'));
  get diagnostics n = row_count;
  return jsonb_build_object('assets_marked', n);
end $$;

create or replace function public.svc_versions_to_purge(p_limit integer default 100)
returns table (version_id uuid, project_id uuid, user_id uuid, render_path text, thumbnail_path text)
language sql stable security definer set search_path = '' as $$
  select v.id, v.project_id, p.owner_user_id, v.render_path, v.thumbnail_path
  from public.project_versions v join public.projects p on p.id = v.project_id
  where v.status = 'ready' and v.purged_at is null and v.expires_at is not null and v.expires_at <= now()
  order by v.expires_at limit p_limit;
$$;

create or replace function public.svc_version_purged(p_version_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.project_versions;
begin
  update public.project_versions
     set status = 'expired', render_path = null, thumbnail_path = null, purged_at = now()
   where id = p_version_id and status = 'ready' returning * into v;
  if not found then return; end if;
  update public.projects set thumbnail_path = null where id = v.project_id and current_version_id = v.id;
end $$;

-- Prévient l'utilisateur avant la suppression (une seule notification par vidéo).
create or replace function public.svc_notify_expiring(p_hours_before integer default 3)
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in select v.id as version_id, v.project_id, p.owner_user_id, v.expires_at
             from public.project_versions v join public.projects p on p.id = v.project_id
            where v.status = 'ready' and v.purged_at is null and p.deleted_at is null
              and v.expires_at > now() and v.expires_at <= now() + make_interval(hours => p_hours_before)
  loop
    perform private.notify(r.owner_user_id, 'info', 'Votre vidéo va être supprimée',
      'Téléchargez-la avant ' || to_char(r.expires_at at time zone 'Europe/Paris', 'HH24"h"MI') || ' : elle ne sera plus disponible ensuite.',
      jsonb_build_object('project_id', r.project_id, 'deep_link', 'project/' || r.project_id), 'expiring:' || r.version_id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ── Modifications : désactivées par réglage (le code reste prêt) ───────
alter function public.submit_revision(uuid, uuid, text, text) set schema private;
create function public.submit_revision(p_project_id uuid, p_parent_version_id uuid, p_instructions text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((private.setting('features.revisions'))::boolean, false) then
    return jsonb_build_object('ok', false, 'code', 'revisions_disabled');
  end if;
  return private.submit_revision(p_project_id, p_parent_version_id, p_instructions, p_idempotency_key);
end $$;

-- ── Acceptation des conditions (preuve horodatée et versionnée) ────────
alter table public.profiles add column terms_version text;
alter table public.profiles add column terms_accepted_at timestamptz;

create or replace function public.accept_terms(p_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user();
begin
  if p_version is distinct from (private.setting('legal.terms_version') #>> '{}') then
    return jsonb_build_object('ok', false, 'code', 'outdated_terms_version');
  end if;
  update public.profiles set terms_version = p_version, terms_accepted_at = now() where id = v_uid
    and (terms_version is distinct from p_version);
  if found then
    insert into public.audit_logs (actor_id, actor_role, action, entity, entity_id, after_data)
    values (v_uid, 'user', 'terms.accepted', 'profile', v_uid::text, jsonb_build_object('version', p_version));
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── Privilèges ──────────────────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.staff_role(), private.is_staff(), private.is_admin(), private.org_role(uuid),
  private.has_org_role(uuid, text), private.can_read_wallet(public.wallets), private.can_read_project(uuid),
  private.can_write_project(uuid), private.can_read_object(text), private.try_uuid(text), private.role_rank(text)
  to authenticated;
grant execute on all functions in schema private to service_role;
grant execute on function
  public.create_draft_project(text, text, uuid), public.register_asset(uuid, text, text, text, bigint, numeric),
  public.complete_asset(uuid), public.delete_asset(uuid), public.rename_project(uuid, text),
  public.delete_project(uuid), public.duplicate_project(uuid), public.quote_video_job(uuid, uuid, text),
  public.submit_video_job(uuid, uuid, uuid, text, text, text), public.submit_revision(uuid, uuid, text, text),
  public.cancel_video_job(uuid), public.touch_profile(text, text), public.register_push_token(text, text),
  public.mark_notifications_read(uuid[]), public.create_support_request(text, text, uuid, uuid, uuid, text, text),
  public.create_organization(text), public.set_auto_reload(boolean, integer, integer, integer, uuid),
  public.accept_invitation(text), public.accept_terms(text),
  public.admin_adjust_wallet(uuid, text, bigint, text, text), public.admin_refund_job(uuid, text, text),
  public.admin_set_user_status(uuid, text, text), public.admin_add_note(uuid, text),
  public.admin_create_client_invitation(text, text, text, text, text, text, text, bigint, bigint, text, integer),
  public.admin_revoke_invitation(uuid), public.admin_retry_job(uuid, text), public.admin_job_detail(uuid),
  public.admin_list_jobs(text, integer, integer), public.admin_dashboard(text),
  public.admin_customers(text, integer, integer), public.admin_customer_detail(uuid),
  public.admin_set_setting(text, jsonb, text), public.admin_change_price(uuid, integer, text),
  public.admin_update_support_request(uuid, text, text)
  to authenticated;
grant execute on function public.peek_invitation(text) to anon, authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
