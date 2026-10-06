-- ════════════════════════════════════════════════════════════════════════
-- 0005 — RPC côté client (SECURITY DEFINER, toujours bornées à auth.uid())
-- Toutes retournent soit des données, soit {ok:false, code, …} pour les
-- refus MÉTIER (solde insuffisant…) afin que l'UI affiche un message humain
-- sans parser une exception SQL. Les exceptions restent pour les abus.
-- ════════════════════════════════════════════════════════════════════════

-- ── Helpers privés ──────────────────────────────────────────────────────
create or replace function private.require_user()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid := (select auth.uid());
begin
  if v is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  return v;
end $$;

create or replace function private.require_staff()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid := private.require_user();
begin
  if not private.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  return v;
end $$;

create or replace function private.require_admin()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid := private.require_user();
begin
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return v;
end $$;

create or replace function private.log_job_event(
  p_job uuid, p_source text, p_level text, p_stage text, p_message text, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.job_events (job_id, correlation_id, source, level, stage, message, data)
  select j.id, j.correlation_id, p_source, p_level, p_stage, p_message, p_data
  from public.video_jobs j where j.id = p_job;
$$;

create or replace function private.notify(
  p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb, p_dedupe text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, data, dedupe_key)
  select p_user, p_kind, p_title, p_body, p_data, p_dedupe
  where p_user is not null
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
$$;

create or replace function private.fmt_eur(p_cents bigint)
returns text language sql immutable as $$
  select replace(to_char(p_cents / 100.0, 'FM999G990D00'), ',', ',') || ' €';
$$;

-- ── Nouvel utilisateur : profil + wallet personnel ──────────────────────
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_first text := nullif(left(coalesce(
    new.raw_user_meta_data ->> 'given_name',
    split_part(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), ' ', 1)), 80), '');
  v_last text := nullif(left(coalesce(new.raw_user_meta_data ->> 'family_name', ''), 80), '');
begin
  insert into public.profiles (id, email, first_name, last_name) values (new.id, new.email, v_first, v_last);
  insert into public.wallets (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── Projets & uploads ───────────────────────────────────────────────────
create or replace function public.create_draft_project(
  p_title text default 'Sans titre', p_source_mode text default 'edit_rushes', p_organization_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_wallet uuid;
  v_id uuid;
begin
  perform private.check_rate_limit('draft:' || v_uid, 30, 3600);
  if p_source_mode not in ('edit_rushes', 'autonomous') then raise exception 'invalid_mode' using errcode = '22023'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'account_suspended' using errcode = '42501';
  end if;
  if p_organization_id is not null then
    if not private.has_org_role(p_organization_id, 'editor') then raise exception 'forbidden' using errcode = '42501'; end if;
    select id into v_wallet from public.wallets where organization_id = p_organization_id;
  else
    select id into v_wallet from public.wallets where user_id = v_uid;
  end if;
  insert into public.projects (owner_user_id, organization_id, wallet_id, title, source_mode)
  values (v_uid, p_organization_id, v_wallet, left(coalesce(nullif(trim(p_title), ''), 'Sans titre'), 160), p_source_mode)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.register_asset(
  p_project_id uuid, p_kind text, p_filename text, p_mime_type text, p_size_bytes bigint,
  p_duration_sec numeric default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_proj public.projects;
  v_max_file bigint := coalesce((private.setting('upload.max_file_bytes'))::bigint, 2147483648);
  v_max_total bigint := coalesce((private.setting('upload.max_total_bytes'))::bigint, 8589934592);
  v_max_files int := coalesce((private.setting('upload.max_files'))::int, 20);
  v_mimes jsonb := coalesce(private.setting('upload.allowed_mime_types'), '[]'::jsonb);
  v_count int; v_total bigint; v_asset uuid := gen_random_uuid();
  v_safe text; v_path text;
begin
  perform private.check_rate_limit('asset:' || v_uid, 200, 3600);
  select * into v_proj from public.projects where id = p_project_id and deleted_at is null;
  if not found or not private.can_write_project(p_project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_proj.status <> 'draft' then return jsonb_build_object('ok', false, 'code', 'project_locked'); end if;
  if p_kind not in ('raw', 'reference', 'image', 'logo', 'audio_note') then raise exception 'invalid_kind' using errcode = '22023'; end if;
  if p_size_bytes is null or p_size_bytes <= 0 then raise exception 'invalid_size' using errcode = '22023'; end if;
  if p_size_bytes > v_max_file then return jsonb_build_object('ok', false, 'code', 'file_too_large', 'max_bytes', v_max_file); end if;
  if not (v_mimes ? lower(p_mime_type)) then return jsonb_build_object('ok', false, 'code', 'unsupported_format'); end if;

  select count(*), coalesce(sum(size_bytes), 0) into v_count, v_total
    from public.assets where project_id = p_project_id and status in ('pending', 'uploaded');
  if v_count >= v_max_files then return jsonb_build_object('ok', false, 'code', 'too_many_files', 'max_files', v_max_files); end if;
  if v_total + p_size_bytes > v_max_total then return jsonb_build_object('ok', false, 'code', 'total_too_large', 'max_bytes', v_max_total); end if;

  v_safe := left(regexp_replace(coalesce(nullif(trim(p_filename), ''), 'fichier'), '[^A-Za-z0-9._-]', '_', 'g'), 120);
  v_path := v_uid::text || '/' || p_project_id::text || '/' || v_asset::text || '/' || v_safe;
  insert into public.assets (id, project_id, owner_user_id, kind, bucket, path, filename, mime_type, size_bytes, duration_sec)
  values (v_asset, p_project_id, v_uid, p_kind, 'raw', v_path, left(p_filename, 255), lower(p_mime_type), p_size_bytes, p_duration_sec);
  return jsonb_build_object('ok', true, 'asset_id', v_asset, 'bucket', 'raw', 'path', v_path);
end $$;

-- Confirme qu'un fichier est réellement arrivé dans le Storage (taille incluse).
create or replace function public.complete_asset(p_asset_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  a public.assets;
  v_size bigint;
begin
  select * into a from public.assets where id = p_asset_id for update;
  if not found or not private.can_write_project(a.project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if a.status = 'uploaded' then return jsonb_build_object('ok', true, 'replayed', true); end if;
  select nullif(o.metadata ->> 'size', '')::bigint into v_size
    from storage.objects o where o.bucket_id = a.bucket and o.name = a.path;
  if not found then return jsonb_build_object('ok', false, 'code', 'upload_missing'); end if;
  if v_size is not null and v_size <> a.size_bytes then
    update public.assets set status = 'failed' where id = a.id;
    return jsonb_build_object('ok', false, 'code', 'upload_incomplete');
  end if;
  update public.assets set status = 'uploaded', uploaded_at = now() where id = a.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.delete_asset(p_asset_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.assets;
begin
  perform private.require_user();
  select * into a from public.assets where id = p_asset_id for update;
  if not found or not private.can_write_project(a.project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not exists (select 1 from public.projects where id = a.project_id and status = 'draft') then
    raise exception 'project_locked' using errcode = '42501';
  end if;
  update public.assets set status = 'deleted' where id = a.id;  -- l'objet Storage est purgé par le housekeeping serveur
end $$;

create or replace function public.rename_project(p_project_id uuid, p_title text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_user();
  if not private.can_write_project(p_project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.projects set title = left(coalesce(nullif(trim(p_title), ''), 'Sans titre'), 160) where id = p_project_id;
end $$;

-- Suppression douce (les fichiers sont purgés par le housekeeping serveur).
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
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.duplicate_project(p_project_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  p public.projects;
  v_id uuid;
begin
  perform private.check_rate_limit('dup:' || v_uid, 20, 3600);
  select * into p from public.projects where id = p_project_id and deleted_at is null;
  if not found or not private.can_write_project(p_project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  -- La copie repart en brouillon : même brief, sans fichiers (à ré-ajouter) ni facturation.
  insert into public.projects (owner_user_id, organization_id, wallet_id, title, source_mode, brief)
  values (v_uid, p.organization_id, p.wallet_id, left(p.title || ' (copie)', 160), p.source_mode, p.brief)
  returning id into v_id;
  return v_id;
end $$;

-- ── Devis serveur (écran récapitulatif, §19/§58) ────────────────────────
create or replace function public.quote_video_job(
  p_project_id uuid, p_pricing_rule_id uuid default null, p_kind text default 'create')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  p public.projects; r public.pricing_rules; w public.wallets;
  v_avail bigint; v_price int;
begin
  select * into p from public.projects where id = p_project_id and deleted_at is null;
  if not found or not private.can_read_project(p_project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_kind = 'revision' then
    select * into r from public.pricing_rules pr where pr.mode = 'revision' and private.pricing_rule_is_current(pr)
      order by effective_from desc limit 1;
  else
    select * into r from public.pricing_rules pr where pr.id = p_pricing_rule_id
      and pr.mode = p.source_mode and private.pricing_rule_is_current(pr);
  end if;
  if not found then return jsonb_build_object('ok', false, 'code', 'pricing_unavailable'); end if;
  select * into w from public.wallets where id = p.wallet_id;
  v_avail := w.balance_cents - w.held_cents;
  v_price := r.price_cents;
  return jsonb_build_object(
    'ok', true, 'pricing_rule_id', r.id, 'label', r.label, 'currency', r.currency,
    'price_cents', v_price, 'available_cents', v_avail,
    'after_cents', v_avail - v_price,
    'shortfall_cents', greatest(v_price - v_avail, 0),
    'can_afford', v_avail >= v_price);
end $$;

-- ── Construction du manifeste d'entrée (copie figée des assets) ─────────
create or replace function private.build_manifest(p_project uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'asset_id', a.id, 'kind', a.kind, 'bucket', a.bucket, 'path', a.path, 'filename', a.filename,
    'mime_type', a.mime_type, 'size_bytes', a.size_bytes, 'duration_sec', a.duration_sec) order by a.created_at), '[]'::jsonb)
  from public.assets a where a.project_id = p_project and a.status = 'uploaded';
$$;

-- ── Lancement d'une vidéo : prix serveur → solde → job → HOLD atomique ──
create or replace function public.submit_video_job(
  p_project_id uuid, p_pricing_rule_id uuid, p_editing_method_id uuid,
  p_aspect_ratio text default '9:16', p_instructions text default null, p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  p public.projects; r public.pricing_rules; m public.editing_methods; w public.wallets;
  v_existing public.video_jobs;
  v_caps jsonb; v_avail bigint; v_job uuid := gen_random_uuid(); v_ver uuid := gen_random_uuid();
  v_hold public.wallet_holds; v_hold_id uuid;
  v_raw int; v_refs int; v_pending int; v_low bigint;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'idempotency_key_required' using errcode = '22023';
  end if;
  perform private.check_rate_limit('submit:' || v_uid, 30, 60);

  -- Rejeu (double clic / retry réseau) : même résultat, aucun effet de bord.
  select * into v_existing from public.video_jobs where user_id = v_uid and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('ok', true, 'replayed', true, 'job_id', v_existing.id, 'project_id', v_existing.project_id,
      'version_id', v_existing.version_id, 'price_cents', v_existing.price_cents);
  end if;

  if coalesce((private.setting('maintenance.enabled'))::boolean, false) then
    return jsonb_build_object('ok', false, 'code', 'maintenance');
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    return jsonb_build_object('ok', false, 'code', 'account_suspended');
  end if;

  -- Verrou projet (ordre de verrouillage : projet → wallet).
  select * into p from public.projects where id = p_project_id and deleted_at is null for update;
  if not found or not private.can_write_project(p_project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p.status <> 'draft' then return jsonb_build_object('ok', false, 'code', 'already_submitted'); end if;

  select * into r from public.pricing_rules pr where pr.id = p_pricing_rule_id
    and pr.mode = p.source_mode and private.pricing_rule_is_current(pr);
  if not found then return jsonb_build_object('ok', false, 'code', 'pricing_unavailable'); end if;

  -- Capacités moteur : n'accepte jamais une option non supportée.
  select capabilities into v_caps from public.engine_capabilities where active;
  if p.source_mode = 'autonomous' and not coalesce((v_caps ->> 'autonomous_creation')::boolean, false) then
    return jsonb_build_object('ok', false, 'code', 'mode_unsupported');
  end if;
  if not coalesce(v_caps -> 'aspect_ratios' ? p_aspect_ratio, false) then
    return jsonb_build_object('ok', false, 'code', 'format_unsupported');
  end if;
  if v_caps ? 'max_duration_sec' and r.duration_max_sec > (v_caps ->> 'max_duration_sec')::int then
    return jsonb_build_object('ok', false, 'code', 'duration_unsupported');
  end if;

  select * into m from public.editing_methods where id = p_editing_method_id and active;
  if not found or not (m.capabilities -> 'modes' ? p.source_mode) then
    return jsonb_build_object('ok', false, 'code', 'method_unavailable');
  end if;
  if coalesce((m.capabilities ->> 'requires_instructions')::boolean, false) and coalesce(trim(p_instructions), '') = '' then
    return jsonb_build_object('ok', false, 'code', 'instructions_required');
  end if;

  select count(*) filter (where kind = 'raw' and status = 'uploaded'),
         count(*) filter (where kind = 'reference' and status = 'uploaded'),
         count(*) filter (where status = 'pending')
    into v_raw, v_refs, v_pending
    from public.assets where project_id = p_project_id;
  if v_pending > 0 then return jsonb_build_object('ok', false, 'code', 'uploads_incomplete'); end if;
  if p.source_mode = 'edit_rushes' and v_raw = 0 then return jsonb_build_object('ok', false, 'code', 'no_files'); end if;
  if coalesce((m.capabilities ->> 'requires_references')::boolean, false) and v_refs = 0 then
    return jsonb_build_object('ok', false, 'code', 'references_required');
  end if;

  select * into w from public.wallets where id = p.wallet_id;
  if w.status <> 'active' then return jsonb_build_object('ok', false, 'code', 'wallet_unavailable'); end if;
  v_avail := w.balance_cents - w.held_cents;
  if v_avail < r.price_cents then
    return jsonb_build_object('ok', false, 'code', 'insufficient_funds', 'price_cents', r.price_cents,
      'available_cents', v_avail, 'shortfall_cents', r.price_cents - v_avail);
  end if;

  insert into public.project_versions (id, project_id, version_number, status, instructions)
  values (v_ver, p_project_id, 1, 'pending', nullif(trim(p_instructions), ''));

  insert into public.video_jobs (id, kind, project_id, version_id, user_id, organization_id, wallet_id, source_mode,
    editing_method_id, editing_method_slug, requested_duration_sec, aspect_ratio, instructions,
    pricing_rule_id, price_cents, status, idempotency_key)
  values (v_job, 'create', p_project_id, v_ver, v_uid, p.organization_id, w.id, p.source_mode,
    m.id, m.slug, r.duration_max_sec, p_aspect_ratio, nullif(trim(p_instructions), ''),
    r.id, r.price_cents, 'queued', p_idempotency_key);

  insert into public.video_job_internals (job_id, input_manifest)
  values (v_job, jsonb_build_object(
    'assets', private.build_manifest(p_project_id),
    'method', jsonb_build_object('slug', m.slug, 'version', m.version, 'engine_config', m.engine_config),
    'brief', nullif(trim(p_instructions), '')));

  -- HOLD atomique : le montant est réservé, pas encore encaissé.
  if r.price_cents > 0 then
    v_hold_id := gen_random_uuid();
    insert into public.wallet_holds (id, wallet_id, job_id, amount_cents) values (v_hold_id, w.id, v_job, r.price_cents);
    perform private.wallet_apply(w.id, 'hold', r.price_cents, 'hold:' || v_job, null, p_project_id, v_job, v_hold_id,
      'Montage vidéo', jsonb_build_object('pricing_rule_id', r.id, 'bucket', r.bucket_key), v_uid);
    update public.video_jobs set wallet_hold_id = v_hold_id where id = v_job;
  end if;

  update public.project_versions set job_id = v_job where id = v_ver;
  update public.projects set status = 'processing', current_version_id = null where id = p_project_id;
  perform private.log_job_event(v_job, 'billing', 'info', 'submit',
    'Job créé et montant réservé', jsonb_build_object('price_cents', r.price_cents, 'hold_id', v_hold_id));

  -- Solde faible (une notification par jour max).
  v_low := coalesce((private.setting('wallet.low_balance_threshold_cents'))::bigint, 500);
  if (v_avail - r.price_cents) < v_low then
    perform private.notify(v_uid, 'low_balance', 'Votre solde est presque épuisé',
      'Il vous reste ' || private.fmt_eur(v_avail - r.price_cents) || '. Ajoutez de l''argent en un geste.',
      jsonb_build_object('deep_link', 'account/wallet'), 'low:' || current_date::text);
  end if;

  return jsonb_build_object('ok', true, 'job_id', v_job, 'project_id', p_project_id, 'version_id', v_ver,
    'price_cents', r.price_cents, 'remaining_cents', v_avail - r.price_cents);
end $$;

-- ── Nouvelle version (modification) — la précédente n'est jamais écrasée ─
create or replace function public.submit_revision(
  p_project_id uuid, p_parent_version_id uuid, p_instructions text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  p public.projects; pv public.project_versions; pj public.video_jobs;
  r public.pricing_rules; w public.wallets; v_existing public.video_jobs;
  v_job uuid := gen_random_uuid(); v_ver uuid := gen_random_uuid(); v_num int;
  v_avail bigint; v_hold_id uuid; v_caps jsonb;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'idempotency_key_required' using errcode = '22023';
  end if;
  if coalesce(trim(p_instructions), '') = '' then return jsonb_build_object('ok', false, 'code', 'instructions_required'); end if;
  perform private.check_rate_limit('revision:' || v_uid, 30, 60);

  select * into v_existing from public.video_jobs where user_id = v_uid and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('ok', true, 'replayed', true, 'job_id', v_existing.id, 'project_id', v_existing.project_id,
      'version_id', v_existing.version_id, 'price_cents', v_existing.price_cents);
  end if;
  if coalesce((private.setting('maintenance.enabled'))::boolean, false) then
    return jsonb_build_object('ok', false, 'code', 'maintenance');
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    return jsonb_build_object('ok', false, 'code', 'account_suspended');
  end if;

  select * into p from public.projects where id = p_project_id and deleted_at is null for update;
  if not found or not private.can_write_project(p_project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  select * into pv from public.project_versions where id = p_parent_version_id and project_id = p_project_id;
  if not found or pv.status <> 'ready' then return jsonb_build_object('ok', false, 'code', 'version_unavailable'); end if;
  if exists (select 1 from public.video_jobs where project_id = p_project_id
             and status not in ('completed', 'failed', 'cancelled')) then
    return jsonb_build_object('ok', false, 'code', 'job_in_progress');
  end if;

  select * into pj from public.video_jobs where id = pv.job_id;
  select * into r from public.pricing_rules pr where pr.mode = 'revision' and private.pricing_rule_is_current(pr)
    order by effective_from desc limit 1;
  if not found then return jsonb_build_object('ok', false, 'code', 'pricing_unavailable'); end if;

  select capabilities into v_caps from public.engine_capabilities where active;
  if not coalesce((v_caps #>> '{revisions,enabled}')::boolean, false) then
    return jsonb_build_object('ok', false, 'code', 'mode_unsupported');
  end if;

  select * into w from public.wallets where id = p.wallet_id;
  if w.status <> 'active' then return jsonb_build_object('ok', false, 'code', 'wallet_unavailable'); end if;
  v_avail := w.balance_cents - w.held_cents;
  if v_avail < r.price_cents then
    return jsonb_build_object('ok', false, 'code', 'insufficient_funds', 'price_cents', r.price_cents,
      'available_cents', v_avail, 'shortfall_cents', r.price_cents - v_avail);
  end if;

  select coalesce(max(version_number), 0) + 1 into v_num from public.project_versions where project_id = p_project_id;
  insert into public.project_versions (id, project_id, version_number, parent_version_id, status, instructions)
  values (v_ver, p_project_id, v_num, p_parent_version_id, 'pending', trim(p_instructions));

  insert into public.video_jobs (id, kind, project_id, version_id, user_id, organization_id, wallet_id, source_mode,
    editing_method_id, editing_method_slug, requested_duration_sec, aspect_ratio, instructions,
    pricing_rule_id, price_cents, status, idempotency_key)
  values (v_job, 'revision', p_project_id, v_ver, v_uid, p.organization_id, w.id, p.source_mode,
    pj.editing_method_id, pj.editing_method_slug, pj.requested_duration_sec, pj.aspect_ratio, trim(p_instructions),
    r.id, r.price_cents, 'queued', p_idempotency_key);

  insert into public.video_job_internals (job_id, input_manifest)
  values (v_job, jsonb_build_object(
    'revision', jsonb_build_object('parent_version_id', p_parent_version_id, 'parent_job_id', pv.job_id,
                                   'instruction', trim(p_instructions))));

  if r.price_cents > 0 then
    v_hold_id := gen_random_uuid();
    insert into public.wallet_holds (id, wallet_id, job_id, amount_cents) values (v_hold_id, w.id, v_job, r.price_cents);
    perform private.wallet_apply(w.id, 'hold', r.price_cents, 'hold:' || v_job, null, p_project_id, v_job, v_hold_id,
      'Modification vidéo', jsonb_build_object('revision_of', p_parent_version_id), v_uid);
    update public.video_jobs set wallet_hold_id = v_hold_id where id = v_job;
  end if;
  update public.project_versions set job_id = v_job where id = v_ver;
  update public.projects set status = 'processing' where id = p_project_id;
  perform private.log_job_event(v_job, 'billing', 'info', 'submit', 'Révision créée et montant réservé',
    jsonb_build_object('price_cents', r.price_cents, 'parent_version_id', p_parent_version_id));
  return jsonb_build_object('ok', true, 'job_id', v_job, 'project_id', p_project_id, 'version_id', v_ver,
    'price_cents', r.price_cents, 'remaining_cents', v_avail - r.price_cents);
end $$;

-- Annulation par l'utilisateur : immédiate si pas encore pris en charge.
create or replace function public.cancel_video_job(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare j public.video_jobs; v_res jsonb;
begin
  perform private.require_user();
  select * into j from public.video_jobs where id = p_job_id;
  if not found or not private.can_write_project(j.project_id) then raise exception 'forbidden' using errcode = '42501'; end if;
  if j.status in ('completed', 'failed', 'cancelled') then
    return jsonb_build_object('ok', true, 'status', j.status, 'replayed', true);
  end if;
  if j.status in ('created', 'queued') and (j.locked_until is null or j.locked_until < now()) then
    v_res := private.finish_job(p_job_id, 'cancelled', 'cancelled_by_user', 'Annulé par l''utilisateur');
    return v_res || jsonb_build_object('ok', true, 'status', 'cancelled');
  end if;
  update public.video_jobs set cancel_requested = true where id = p_job_id;
  perform private.log_job_event(p_job_id, 'app', 'info', 'cancel', 'Annulation demandée');
  return jsonb_build_object('ok', true, 'status', j.status, 'cancel_requested', true);
end $$;

-- ── Compte, notifications, support ──────────────────────────────────────
create or replace function public.touch_profile(p_app_version text, p_platform text)
returns void language sql security definer set search_path = '' as $$
  update public.profiles
     set last_seen_at = now(), app_version = left(p_app_version, 40),
         platform = case when p_platform in ('ios', 'android', 'web') then p_platform else platform end
   where id = (select auth.uid());
$$;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user();
begin
  perform private.check_rate_limit('push:' || v_uid, 30, 3600);
  if p_platform not in ('ios', 'android', 'web') or char_length(p_token) not between 10 and 500 then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  insert into public.push_tokens (user_id, token, platform) values (v_uid, p_token, p_platform)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_n integer;
begin
  update public.notifications set read_at = now()
   where user_id = private.require_user() and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.create_support_request(
  p_category text, p_message text, p_project_id uuid default null, p_job_id uuid default null,
  p_version_id uuid default null, p_app_version text default null, p_platform text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_id uuid; v_proj uuid := p_project_id; v_job uuid := p_job_id;
begin
  perform private.check_rate_limit('support:' || v_uid, 10, 3600);
  if v_proj is not null and not private.can_read_project(v_proj) then v_proj := null; v_job := null; end if;
  if v_job is not null and not exists (select 1 from public.video_jobs where id = v_job and project_id = v_proj) then v_job := null; end if;
  insert into public.support_requests (user_id, project_id, job_id, version_id, category, message, app_version, platform)
  values (v_uid, v_proj, v_job,
          (select id from public.project_versions where id = p_version_id and project_id = v_proj),
          case when p_category in ('video_problem', 'payment', 'account', 'other') then p_category else 'other' end,
          left(p_message, 4000), left(p_app_version, 40), left(p_platform, 20))
  returning id into v_id;
  return v_id;
end $$;

-- ── Organisations (architecture V1, UX minimale) ────────────────────────
create or replace function public.create_organization(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user(); v_org uuid;
begin
  perform private.check_rate_limit('org:' || v_uid, 5, 3600);
  insert into public.organizations (name, created_by) values (left(trim(p_name), 120), v_uid) returning id into v_org;
  insert into public.organization_members (organization_id, user_id, role) values (v_org, v_uid, 'owner');
  insert into public.wallets (organization_id) values (v_org);
  return v_org;
end $$;

-- ── Recharge automatique (réglage ; l'exécution est côté serveur) ───────
create or replace function public.set_auto_reload(
  p_enabled boolean, p_threshold_cents integer, p_amount_cents integer, p_monthly_cap_cents integer,
  p_payment_method_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  v_wallet uuid; v_min bigint := coalesce((private.setting('wallet.min_topup_cents'))::bigint, 1000);
  v_row public.auto_reload_rules;
begin
  perform private.check_rate_limit('autoreload:' || v_uid, 30, 3600);
  if not coalesce((private.setting('payments.auto_reload_enabled'))::boolean, false) then
    return jsonb_build_object('ok', false, 'code', 'auto_reload_unavailable');
  end if;
  select id into v_wallet from public.wallets where user_id = v_uid;
  if p_enabled then
    if p_amount_cents < v_min then return jsonb_build_object('ok', false, 'code', 'amount_too_low', 'min_cents', v_min); end if;
    if p_threshold_cents < 0 or p_threshold_cents > 100000 then return jsonb_build_object('ok', false, 'code', 'invalid_threshold'); end if;
    if p_monthly_cap_cents < p_amount_cents then return jsonb_build_object('ok', false, 'code', 'cap_too_low'); end if;
    if p_payment_method_id is null or not exists (
         select 1 from public.payment_methods where id = p_payment_method_id and user_id = v_uid and wallet_id = v_wallet) then
      return jsonb_build_object('ok', false, 'code', 'payment_method_required');
    end if;
  end if;
  insert into public.auto_reload_rules (wallet_id, user_id, enabled, threshold_cents, amount_cents, monthly_cap_cents, payment_method_id)
  values (v_wallet, v_uid, p_enabled, p_threshold_cents, greatest(p_amount_cents, v_min), greatest(p_monthly_cap_cents, p_amount_cents), p_payment_method_id)
  on conflict (wallet_id) do update set enabled = excluded.enabled, threshold_cents = excluded.threshold_cents,
    amount_cents = excluded.amount_cents, monthly_cap_cents = excluded.monthly_cap_cents,
    payment_method_id = excluded.payment_method_id, failure_count = 0
  returning * into v_row;
  return jsonb_build_object('ok', true, 'rule_id', v_row.id, 'enabled', v_row.enabled);
end $$;

-- ── Invitations commerciales (§36) ──────────────────────────────────────
-- Aperçu anonyme avant création de compte : n'expose que le strict nécessaire.
create or replace function public.peek_invitation(p_token text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare i public.invitations; d public.commercial_deals;
begin
  select * into i from public.invitations where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found or i.status <> 'pending' or i.expires_at < now() then return jsonb_build_object('valid', false); end if;
  select * into d from public.commercial_deals where id = i.deal_id;
  return jsonb_build_object('valid', true, 'kind', i.kind, 'credit_cents', i.credit_cents,
    'name', split_part(coalesce(d.client_name, ''), ' ', 1), 'company', d.company);
end $$;

create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := private.require_user();
  i public.invitations; d public.commercial_deals; v_wallet uuid; v_src public.sales_sources;
begin
  perform private.check_rate_limit('invite:' || v_uid, 10, 3600);
  select * into i from public.invitations where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'invalid_invitation'); end if;
  if i.status = 'accepted' and i.accepted_by = v_uid then return jsonb_build_object('ok', true, 'replayed', true); end if;
  if i.status <> 'pending' or i.expires_at < now() then return jsonb_build_object('ok', false, 'code', 'invalid_invitation'); end if;

  if i.kind = 'organization' then
    insert into public.organization_members (organization_id, user_id, role)
    values (i.organization_id, v_uid, coalesce(i.org_role, 'viewer')) on conflict do nothing;
  else
    select id into v_wallet from public.wallets where user_id = v_uid;
    if i.credit_cents > 0 then
      perform private.wallet_apply(v_wallet, 'commercial_credit', i.credit_cents, 'invite:' || i.id, null, null, null, null,
        'Offre commerciale', jsonb_build_object('invitation_id', i.id, 'deal_id', i.deal_id), v_uid);
      perform private.notify(v_uid, 'topup_done', 'Votre solde offert est disponible',
        private.fmt_eur(i.credit_cents) || ' ont été ajoutés à votre solde.', '{}'::jsonb, 'invite:' || i.id);
    end if;
    if i.deal_id is not null then
      select * into d from public.commercial_deals where id = i.deal_id for update;
      update public.commercial_deals set user_id = v_uid, status = 'active', activated_at = now() where id = i.deal_id;
      select * into v_src from public.sales_sources where id = d.sales_source_id;
      update public.profiles set acquisition = jsonb_strip_nulls(jsonb_build_object(
        'source', v_src.name, 'campaign', v_src.campaign, 'salesperson', v_src.salesperson, 'deal_id', d.id, 'deal_ref', d.deal_ref)),
        company = coalesce(company, d.company)
      where id = v_uid;
    end if;
  end if;
  update public.invitations set status = 'accepted', accepted_by = v_uid, accepted_at = now() where id = i.id;
  insert into public.audit_logs (actor_id, actor_role, action, entity, entity_id, after_data)
  values (v_uid, 'user', 'invitation.accepted', 'invitation', i.id::text, jsonb_build_object('credit_cents', i.credit_cents));
  return jsonb_build_object('ok', true, 'credited_cents', i.credit_cents);
end $$;
