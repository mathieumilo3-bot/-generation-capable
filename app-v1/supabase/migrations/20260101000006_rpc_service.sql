-- ════════════════════════════════════════════════════════════════════════
-- 0006 — RPC serveur (orchestrateur, webhooks paiement) — service_role UNIQUEMENT
-- Ordre de verrouillage constant : job → projet → wallet (évite les deadlocks
-- avec submit_video_job qui verrouille projet → wallet).
-- ════════════════════════════════════════════════════════════════════════

-- ── Fin de vie non réussie d'un job : RELEASE du montant réservé ───────
create or replace function private.finish_job(
  p_job_id uuid, p_target text, p_error_code text, p_internal text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  j public.video_jobs; h public.wallet_holds; v_has_ready boolean;
begin
  if p_target not in ('failed', 'cancelled') then raise exception 'invalid_target' using errcode = '22023'; end if;
  select * into j from public.video_jobs where id = p_job_id for update;
  if not found then raise exception 'job_not_found' using errcode = 'P0002'; end if;
  if j.status in ('completed', 'failed', 'cancelled') then
    return jsonb_build_object('ok', true, 'replayed', true, 'status', j.status);
  end if;

  perform 1 from public.projects where id = j.project_id for update;

  update public.video_jobs
     set status = p_target, error_code = p_error_code, completed_at = now(), locked_until = null
   where id = p_job_id;
  update public.video_job_internals
     set error_message_internal = left(p_internal, 2000), locked_by = null where job_id = p_job_id;
  update public.project_versions set status = 'failed' where id = j.version_id;

  select exists (select 1 from public.project_versions where project_id = j.project_id and status = 'ready')
    into v_has_ready;
  update public.projects set status = case when v_has_ready then 'ready' else 'failed' end where id = j.project_id;

  select * into h from public.wallet_holds where job_id = p_job_id for update;
  if found and h.status = 'held' then
    perform private.wallet_apply(h.wallet_id, 'release', h.amount_cents, 'release:' || p_job_id, null,
      j.project_id, p_job_id, h.id, 'Montant libéré', jsonb_build_object('reason', p_error_code), null);
    update public.wallet_holds set status = 'released', resolved_at = now() where id = h.id;
  end if;

  insert into public.usage_costs (job_id, user_id, revenue_cents) values (p_job_id, j.user_id, 0)
  on conflict (job_id) do nothing;

  if p_target = 'failed' then
    perform private.notify(j.user_id, 'job_failed', 'Votre rendu n''a pas pu être terminé',
      'Aucun montant n''a été prélevé.',
      jsonb_build_object('project_id', j.project_id, 'job_id', j.id, 'deep_link', 'project/' || j.project_id),
      'job:' || j.id || ':failed');
  end if;
  perform private.log_job_event(p_job_id, 'billing', case when p_target = 'failed' then 'error' else 'info' end,
    'finish', 'Job terminé sans livraison — montant libéré',
    jsonb_build_object('target', p_target, 'error_code', p_error_code));
  return jsonb_build_object('ok', true, 'status', p_target, 'released', coalesce(h.amount_cents, 0));
end $$;

-- ── Orchestrateur : réservation d'un job à traiter (bail) ──────────────
create or replace function public.svc_claim_job(p_worker text, p_lease_seconds integer default 600)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare j public.video_jobs; i public.video_job_internals;
begin
  select * into j from public.video_jobs
   where status = 'queued' and next_attempt_at <= now() and not cancel_requested
   order by priority desc, created_at
   for update skip locked limit 1;
  if not found then return null; end if;
  update public.video_jobs
     set status = 'preparing', attempt_count = attempt_count + 1, started_at = coalesce(started_at, now()),
         locked_until = now() + make_interval(secs => p_lease_seconds), progress = greatest(progress, 1),
         current_stage = 'preparing'
   where id = j.id returning * into j;
  update public.video_job_internals set locked_by = left(p_worker, 100), updated_at = now()
   where job_id = j.id returning * into i;
  perform private.log_job_event(j.id, 'orchestrator', 'info', 'claim', 'Job pris en charge',
    jsonb_build_object('worker', p_worker, 'attempt', j.attempt_count));
  return jsonb_build_object(
    'job_id', j.id, 'correlation_id', j.correlation_id, 'kind', j.kind, 'user_id', j.user_id,
    'project_id', j.project_id, 'version_id', j.version_id, 'aspect_ratio', j.aspect_ratio,
    'requested_duration_sec', j.requested_duration_sec, 'instructions', j.instructions,
    'editing_method_slug', j.editing_method_slug, 'attempt', j.attempt_count,
    'engine_job_ref', i.engine_job_ref, 'input_manifest', i.input_manifest);
end $$;

-- Progression (monotone) + prolongation du bail. Renvoie cancel_requested.
create or replace function public.svc_job_progress(
  p_job_id uuid, p_status text, p_progress integer, p_stage text default null,
  p_engine_job_ref text default null, p_engine_version text default null, p_lease_seconds integer default 600)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare j public.video_jobs;
  order_of constant text[] := array['preparing', 'analyzing', 'editing', 'rendering', 'quality_check'];
begin
  if p_status <> all (order_of) then raise exception 'invalid_status' using errcode = '22023'; end if;
  select * into j from public.video_jobs where id = p_job_id for update;
  if not found then raise exception 'job_not_found' using errcode = 'P0002'; end if;
  if j.status in ('completed', 'failed', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'job_not_active', 'status', j.status);
  end if;
  update public.video_jobs
     set status = case when array_position(order_of, p_status) >= coalesce(array_position(order_of, j.status), 0)
                       then p_status else j.status end,
         progress = greatest(progress, least(greatest(p_progress, 0), 99)),
         current_stage = coalesce(p_stage, current_stage),
         locked_until = now() + make_interval(secs => p_lease_seconds)
   where id = p_job_id;
  update public.video_job_internals
     set engine_job_ref = coalesce(p_engine_job_ref, engine_job_ref),
         engine_version = coalesce(p_engine_version, engine_version), updated_at = now()
   where job_id = p_job_id;
  return jsonb_build_object('ok', true, 'cancel_requested', j.cancel_requested);
end $$;

-- ── Succès : CAPTURE du montant, version prête, notification ───────────
create or replace function public.svc_job_complete(
  p_job_id uuid, p_render_path text, p_thumbnail_path text, p_duration_sec numeric,
  p_width integer default null, p_height integer default null, p_size_bytes bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare j public.video_jobs; h public.wallet_holds;
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
         duration_sec = p_duration_sec, width = p_width, height = p_height, size_bytes = p_size_bytes, ready_at = now()
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
    'Touchez pour la regarder.',
    jsonb_build_object('project_id', j.project_id, 'version_id', j.version_id, 'deep_link', 'project/' || j.project_id),
    'job:' || j.id || ':done');
  perform private.log_job_event(p_job_id, 'billing', 'info', 'complete', 'Rendu livré — montant encaissé',
    jsonb_build_object('price_cents', j.price_cents));
  return jsonb_build_object('ok', true, 'captured_cents', coalesce(h.amount_cents, 0));
end $$;

-- ── Échec : retry avec backoff, sinon RELEASE ───────────────────────────
create or replace function public.svc_job_fail(
  p_job_id uuid, p_error_code text, p_internal_message text default null, p_retryable boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare j public.video_jobs;
begin
  select * into j from public.video_jobs where id = p_job_id for update;
  if not found then raise exception 'job_not_found' using errcode = 'P0002'; end if;
  if j.status in ('completed', 'failed', 'cancelled') then
    return jsonb_build_object('ok', true, 'replayed', true, 'status', j.status);
  end if;
  if j.cancel_requested then
    return private.finish_job(p_job_id, 'cancelled', 'cancelled_by_user', p_internal_message);
  end if;
  if p_retryable and j.attempt_count < j.max_attempts then
    update public.video_jobs
       set status = 'queued', locked_until = null, current_stage = 'queued',
           next_attempt_at = now() + make_interval(secs => least(30 * power(2, j.attempt_count), 900)::int)
     where id = p_job_id;
    update public.video_job_internals set locked_by = null, error_message_internal = left(p_internal_message, 2000)
     where job_id = p_job_id;
    perform private.log_job_event(p_job_id, 'orchestrator', 'warn', 'retry', 'Échec temporaire — nouvelle tentative planifiée',
      jsonb_build_object('error_code', p_error_code, 'attempt', j.attempt_count));
    return jsonb_build_object('ok', true, 'requeued', true);
  end if;
  return private.finish_job(p_job_id, 'failed', p_error_code, p_internal_message);
end $$;

-- Confirmation d'annulation après arrêt effectif côté moteur.
create or replace function public.svc_job_cancelled(p_job_id uuid)
returns jsonb language sql security definer set search_path = '' as $$
  select private.finish_job(p_job_id, 'cancelled', 'cancelled_by_user', 'Annulation confirmée par le moteur');
$$;

-- Jobs dont le worker a disparu (bail expiré) : retry ou échec définitif.
create or replace function public.svc_requeue_stale_jobs()
returns integer language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0;
begin
  for r in select id from public.video_jobs
           where status in ('preparing', 'analyzing', 'editing', 'rendering', 'quality_check')
             and locked_until < now() for update skip locked loop
    perform public.svc_job_fail(r.id, 'worker_lost', 'Bail expiré sans heartbeat', true);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.svc_job_event(
  p_job_id uuid, p_source text, p_level text, p_stage text, p_message text, p_data jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  select private.log_job_event(p_job_id, p_source, p_level, p_stage, left(p_message, 1000), p_data);
$$;

-- Coûts réels (µ€), écrasés par le dernier cumul fourni par le moteur.
create or replace function public.svc_record_costs(p_job_id uuid, p_costs jsonb, p_fx_usd_eur numeric default null)
returns void language plpgsql security definer set search_path = '' as $$
declare j public.video_jobs;
  g constant text[] := array['transcription', 'llm', 'generation', 'render_compute', 'storage', 'music', 'external_api', 'other'];
  k text;
begin
  select * into j from public.video_jobs where id = p_job_id;
  if not found then raise exception 'job_not_found' using errcode = 'P0002'; end if;
  foreach k in array g loop
    if coalesce((p_costs ->> (k || '_cost_micro'))::bigint, 0) < 0 then raise exception 'negative_cost' using errcode = '22023'; end if;
  end loop;
  insert into public.usage_costs (job_id, user_id, transcription_cost_micro, llm_cost_micro, generation_cost_micro,
    render_compute_cost_micro, storage_cost_micro, music_cost_micro, external_api_cost_micro, other_cost_micro,
    fx_rate_usd_eur, detail)
  values (p_job_id, j.user_id,
    coalesce((p_costs ->> 'transcription_cost_micro')::bigint, 0), coalesce((p_costs ->> 'llm_cost_micro')::bigint, 0),
    coalesce((p_costs ->> 'generation_cost_micro')::bigint, 0), coalesce((p_costs ->> 'render_compute_cost_micro')::bigint, 0),
    coalesce((p_costs ->> 'storage_cost_micro')::bigint, 0), coalesce((p_costs ->> 'music_cost_micro')::bigint, 0),
    coalesce((p_costs ->> 'external_api_cost_micro')::bigint, 0), coalesce((p_costs ->> 'other_cost_micro')::bigint, 0),
    p_fx_usd_eur, coalesce(p_costs -> 'detail', '{}'::jsonb))
  on conflict (job_id) do update set
    transcription_cost_micro = excluded.transcription_cost_micro, llm_cost_micro = excluded.llm_cost_micro,
    generation_cost_micro = excluded.generation_cost_micro, render_compute_cost_micro = excluded.render_compute_cost_micro,
    storage_cost_micro = excluded.storage_cost_micro, music_cost_micro = excluded.music_cost_micro,
    external_api_cost_micro = excluded.external_api_cost_micro, other_cost_micro = excluded.other_cost_micro,
    fx_rate_usd_eur = coalesce(excluded.fx_rate_usd_eur, public.usage_costs.fx_rate_usd_eur), detail = excluded.detail;
end $$;

-- ── Paiements (webhooks Stripe / vérification Apple & Google) ──────────
create or replace function public.svc_payment_upsert(
  p_provider text, p_provider_ref text, p_wallet_id uuid, p_kind text, p_amount_cents bigint,
  p_status text, p_platform text default null, p_idempotency_key text default null,
  p_metadata jsonb default '{}'::jsonb, p_failure_code text default null,
  p_failure_detail text default null, p_receipt_url text default null, p_id uuid default null)
returns public.payments language plpgsql security definer set search_path = '' as $$
declare w public.wallets; pay public.payments;
begin
  select * into w from public.wallets where id = p_wallet_id;
  if not found then raise exception 'wallet_not_found' using errcode = 'P0002'; end if;
  insert into public.payments (id, user_id, organization_id, wallet_id, provider, provider_ref, kind, amount_cents,
    status, platform, idempotency_key, metadata, failure_code, failure_detail_internal, receipt_url)
  values (coalesce(p_id, gen_random_uuid()), w.user_id, w.organization_id, w.id, p_provider, p_provider_ref, p_kind, p_amount_cents,
    p_status, p_platform, p_idempotency_key, p_metadata, p_failure_code, left(p_failure_detail, 1000), p_receipt_url)
  on conflict (provider, provider_ref) where provider_ref is not null do update set
    -- Jamais de régression d'un paiement déjà abouti/remboursé.
    status = case when public.payments.status in ('succeeded', 'refunded', 'partially_refunded')
                  then public.payments.status else excluded.status end,
    failure_code = coalesce(excluded.failure_code, public.payments.failure_code),
    failure_detail_internal = coalesce(excluded.failure_detail_internal, public.payments.failure_detail_internal),
    receipt_url = coalesce(excluded.receipt_url, public.payments.receipt_url),
    metadata = public.payments.metadata || excluded.metadata
  returning * into pay;
  return pay;
end $$;

-- Crédit du wallet : idempotent par paiement (clé « payment:<id> »).
create or replace function public.svc_payment_settle(p_payment_id uuid, p_receipt_url text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pay public.payments; t public.wallet_transactions;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found then raise exception 'payment_not_found' using errcode = 'P0002'; end if;
  if pay.status in ('failed', 'canceled') then
    -- Un paiement échoué ne peut pas être crédité (sauf nouvel événement succeeded explicite).
    null;
  end if;
  t := private.wallet_apply(pay.wallet_id, 'topup', pay.amount_cents, 'payment:' || pay.id, pay.id, null, null, null,
    'Recharge', jsonb_build_object('provider', pay.provider, 'kind', pay.kind), null);
  update public.payments
     set status = case when status in ('refunded', 'partially_refunded') then status else 'succeeded' end,
         succeeded_at = coalesce(succeeded_at, now()), receipt_url = coalesce(p_receipt_url, receipt_url)
   where id = pay.id;
  if pay.user_id is not null then
    perform private.notify(pay.user_id, 'topup_done', 'Une recharge a été effectuée',
      private.fmt_eur(pay.amount_cents) || ' ont été ajoutés à votre solde.',
      jsonb_build_object('deep_link', 'account/wallet', 'payment_id', pay.id), 'payment:' || pay.id);
  end if;
  return jsonb_build_object('ok', true, 'transaction_id', t.id, 'balance_after_cents', t.balance_after_cents);
end $$;

create or replace function public.svc_payment_fail(p_payment_id uuid, p_failure_code text, p_detail text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare pay public.payments;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if not found or pay.status in ('succeeded', 'refunded', 'partially_refunded') then return; end if;
  update public.payments set status = 'failed', failure_code = left(p_failure_code, 80),
    failure_detail_internal = left(p_detail, 1000) where id = pay.id;
  if pay.user_id is not null then
    perform private.notify(pay.user_id, 'payment_failed', 'Le paiement n''a pas pu être validé',
      'Votre solde n''a pas été modifié.', jsonb_build_object('deep_link', 'account/wallet'), 'payfail:' || pay.id);
  end if;
end $$;

-- Remboursement fournisseur : on retire les fonds du wallet (dans la limite du
-- disponible — jamais de solde négatif ; l'écart est tracé pour l'admin).
create or replace function public.svc_payment_refund(p_provider text, p_provider_ref text, p_refunded_total_cents bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pay public.payments; w public.wallets; v_delta bigint; v_debit bigint; v_avail bigint;
begin
  select * into pay from public.payments where provider = p_provider and provider_ref = p_provider_ref for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'payment_not_found'); end if;
  p_refunded_total_cents := least(p_refunded_total_cents, pay.amount_cents);
  v_delta := p_refunded_total_cents - pay.refunded_cents;
  if v_delta <= 0 then return jsonb_build_object('ok', true, 'replayed', true); end if;
  select * into w from public.wallets where id = pay.wallet_id for update;
  v_avail := w.balance_cents - w.held_cents;
  v_debit := least(v_delta, v_avail);
  if v_debit > 0 then
    perform private.wallet_apply(pay.wallet_id, 'manual_adjustment', -v_debit, 'payrefund:' || pay.id || ':' || p_refunded_total_cents,
      pay.id, null, null, null, 'Remboursement du paiement',
      jsonb_build_object('reason', 'payment_refund', 'refund_total_cents', p_refunded_total_cents, 'uncollectable_cents', v_delta - v_debit), null);
  end if;
  update public.payments set refunded_cents = p_refunded_total_cents,
    status = case when p_refunded_total_cents >= amount_cents then 'refunded' else 'partially_refunded' end
  where id = pay.id;
  insert into public.audit_logs (actor_role, action, entity, entity_id, after_data)
  values ('system', 'payment.refunded', 'payment', pay.id::text,
    jsonb_build_object('refunded_total_cents', p_refunded_total_cents, 'debited_cents', v_debit, 'uncollectable_cents', v_delta - v_debit));
  return jsonb_build_object('ok', true, 'debited_cents', v_debit, 'uncollectable_cents', v_delta - v_debit);
end $$;

-- Déduplication des webhooks : renvoie true si l'événement est NOUVEAU.
create or replace function public.svc_webhook_begin(p_provider text, p_event_id text, p_type text, p_payload jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_row public.webhook_events;
begin
  insert into public.webhook_events (provider, event_id, event_type, payload)
  values (p_provider, p_event_id, p_type, p_payload)
  on conflict (provider, event_id) do update set attempts = public.webhook_events.attempts + 1
  returning * into v_row;
  -- Rejoué : on ne retraite que s'il avait échoué.
  return v_row.attempts = 1 or v_row.status = 'failed';
end $$;

create or replace function public.svc_webhook_end(p_provider text, p_event_id text, p_status text, p_error text default null)
returns void language sql security definer set search_path = '' as $$
  update public.webhook_events set status = p_status, error = left(p_error, 1000), processed_at = now()
  where provider = p_provider and event_id = p_event_id;
$$;

-- ── Recharge automatique : sélection + garde-fous anti double débit ────
create or replace function public.svc_due_auto_reloads()
returns table (rule_id uuid, wallet_id uuid, user_id uuid, amount_cents integer, provider_pm_id text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.wallet_id, r.user_id, r.amount_cents, pm.provider_pm_id
  from public.auto_reload_rules r
  join public.wallets w on w.id = r.wallet_id and w.status = 'active'
  join public.payment_methods pm on pm.id = r.payment_method_id
  where r.enabled and r.failure_count < 3
    and (w.balance_cents - w.held_cents) < r.threshold_cents
    and coalesce((select sum(p.amount_cents) from public.payments p
                   where p.wallet_id = r.wallet_id and p.kind = 'auto_reload'
                     and p.status in ('succeeded', 'pending', 'requires_action')
                     and p.created_at >= date_trunc('month', now())), 0) + r.amount_cents <= r.monthly_cap_cents;
$$;

create or replace function public.svc_auto_reload_begin(p_rule_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.auto_reload_attempts (rule_id, window_key)
  values (p_rule_id, to_char(now() at time zone 'utc', 'YYYYMMDDHH24'))
  on conflict (rule_id, window_key) do nothing returning id into v_id;
  return v_id;   -- null = une tentative existe déjà dans cette heure
end $$;

create or replace function public.svc_auto_reload_finish(p_attempt_id uuid, p_status text, p_payment_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.auto_reload_attempts; r public.auto_reload_rules;
begin
  update public.auto_reload_attempts set status = p_status, payment_id = p_payment_id
   where id = p_attempt_id returning * into a;
  if not found then return; end if;
  select * into r from public.auto_reload_rules where id = a.rule_id for update;
  if p_status = 'succeeded' then
    update public.auto_reload_rules set failure_count = 0, last_status = 'succeeded', last_triggered_at = now() where id = r.id;
  else
    update public.auto_reload_rules
       set failure_count = failure_count + 1, last_status = p_status, last_triggered_at = now(),
           enabled = enabled and (failure_count + 1 < 3)
     where id = r.id;
    perform private.notify(r.user_id, 'payment_failed', 'La recharge automatique n''a pas pu être effectuée',
      'Votre solde n''a pas été modifié. Vérifiez votre moyen de paiement.',
      jsonb_build_object('deep_link', 'account/wallet'), 'autoreload-fail:' || a.id);
  end if;
end $$;

-- ── Notifications push à expédier ───────────────────────────────────────
create or replace function public.svc_pending_pushes(p_limit integer default 50)
returns table (notification_id uuid, user_id uuid, title text, body text, data jsonb, token text, platform text)
language sql security definer set search_path = '' as $$
  select n.id, n.user_id, n.title, n.body, n.data, t.token, t.platform
  from public.notifications n join public.push_tokens t on t.user_id = n.user_id
  where n.push_sent_at is null and n.created_at > now() - interval '1 day'
  order by n.created_at limit p_limit;
$$;

create or replace function public.svc_mark_push_sent(p_ids uuid[])
returns void language sql security definer set search_path = '' as $$
  update public.notifications set push_sent_at = now() where id = any (p_ids);
$$;

create or replace function public.svc_drop_push_token(p_token text)
returns void language sql security definer set search_path = '' as $$
  delete from public.push_tokens where token = p_token;
$$;

-- ── Suppression de compte : préparation (la suppression Auth suit côté Edge) ─
-- Conserve (anonymisés) paiements/ledger/coûts : obligation comptable.
create or replace function public.svc_prepare_account_deletion(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_email text; v_paths jsonb; v_blocking int;
begin
  select email into v_email from public.profiles where id = p_user_id;
  -- Jobs actifs : on annule (RELEASE) avant de supprimer.
  perform private.finish_job(id, 'cancelled', 'account_deleted', 'Compte supprimé')
    from public.video_jobs where user_id = p_user_id and status not in ('completed', 'failed', 'cancelled');
  select count(*) into v_blocking from public.organization_members m
   where m.user_id = p_user_id and m.role = 'owner'
     and exists (select 1 from public.organization_members o where o.organization_id = m.organization_id and o.user_id <> p_user_id);
  if v_blocking > 0 then return jsonb_build_object('ok', false, 'code', 'transfer_ownership_first'); end if;

  select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket, 'path', path)), '[]'::jsonb) into v_paths
    from public.assets where owner_user_id = p_user_id and status <> 'deleted';
  update public.wallets set status = 'closed' where user_id = p_user_id;
  update public.profiles set status = 'deleted' where id = p_user_id;
  insert into public.account_deletion_requests (user_id, email_hash, retained)
  values (p_user_id, encode(extensions.digest(coalesce(lower(v_email), ''), 'sha256'), 'hex'),
    jsonb_build_object('wallet_transactions', 'anonymisé, conservé (obligation comptable)',
                       'payments', 'anonymisé, conservé (obligation comptable)',
                       'usage_costs', 'anonymisé, conservé (comptabilité analytique)',
                       'audit_logs', 'conservé (sécurité)'));
  insert into public.audit_logs (actor_role, action, entity, entity_id) values ('system', 'account.deletion.prepared', 'user', p_user_id::text);
  return jsonb_build_object('ok', true, 'storage_objects', v_paths);
end $$;

create or replace function public.svc_complete_account_deletion(p_user_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.account_deletion_requests set status = 'completed', completed_at = now()
  where user_id = p_user_id and status = 'requested';
$$;

-- ── Housekeeping : assets marqués supprimés à purger du Storage ────────
create or replace function public.svc_assets_to_purge(p_limit integer default 100)
returns table (asset_id uuid, bucket text, path text) language sql security definer set search_path = '' as $$
  select id, bucket, path from public.assets where status = 'deleted' order by created_at limit p_limit;
$$;

create or replace function public.svc_asset_purged(p_asset_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.assets where id = p_asset_id and status = 'deleted';
$$;
