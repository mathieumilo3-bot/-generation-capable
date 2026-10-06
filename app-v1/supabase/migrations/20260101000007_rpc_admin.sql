-- ════════════════════════════════════════════════════════════════════════
-- 0007 — RPC back-office. Lecture : staff (support + admin). Écriture : admin.
-- Toute action financière passe par le ledger ET écrit un audit_log :
-- JAMAIS de modification silencieuse d'un solde.
-- ════════════════════════════════════════════════════════════════════════

create table public.customer_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  author_id  uuid references auth.users(id) on delete set null,
  note       text not null check (char_length(note) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index customer_notes_user_idx on public.customer_notes (user_id, created_at desc);
alter table public.customer_notes enable row level security;
create policy customer_notes_staff on public.customer_notes
  for select to authenticated using (private.is_staff());

create or replace function private.audit(
  p_action text, p_entity text, p_entity_id text, p_before jsonb, p_after jsonb, p_reason text)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, actor_role, action, entity, entity_id, before_data, after_data, reason)
  values ((select auth.uid()), private.staff_role(), p_action, p_entity, p_entity_id, p_before, p_after, p_reason);
$$;

-- ── Finances : ajustement / bonus / promo / crédit commercial / refund ──
create or replace function public.admin_adjust_wallet(
  p_wallet_id uuid, p_kind text, p_amount_cents bigint, p_reason text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := private.require_admin();
  w public.wallets; t public.wallet_transactions; v_user uuid; v_replay boolean;
begin
  if p_kind not in ('manual_adjustment', 'bonus', 'promotion', 'commercial_credit', 'refund') then
    raise exception 'invalid_kind' using errcode = '22023';
  end if;
  if p_kind <> 'manual_adjustment' and p_amount_cents <= 0 then raise exception 'invalid_amount' using errcode = '22023'; end if;
  if coalesce(char_length(trim(p_reason)), 0) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then raise exception 'idempotency_key_required' using errcode = '22023'; end if;
  perform private.check_rate_limit('adminadj:' || v_admin, 120, 3600);

  select * into w from public.wallets where id = p_wallet_id;
  if not found then raise exception 'wallet_not_found' using errcode = 'P0002'; end if;
  select exists (select 1 from public.wallet_transactions
                  where wallet_id = p_wallet_id and idempotency_key = 'admin:' || p_idempotency_key) into v_replay;
  t := private.wallet_apply(p_wallet_id, p_kind, p_amount_cents, 'admin:' || p_idempotency_key, null, null, null, null,
    left(p_reason, 200), jsonb_build_object('admin_reason', left(p_reason, 500)), v_admin);
  if v_replay then   -- rejeu : ni nouvel audit ni nouvelle notification
    return jsonb_build_object('ok', true, 'replayed', true, 'transaction_id', t.id, 'balance_after_cents', t.balance_after_cents);
  end if;
  perform private.audit('wallet.' || p_kind, 'wallet', p_wallet_id::text,
    jsonb_build_object('balance_cents', t.balance_before_cents),
    jsonb_build_object('balance_cents', t.balance_after_cents, 'amount_cents', p_amount_cents, 'transaction_id', t.id), p_reason);
  v_user := w.user_id;
  if v_user is not null and p_amount_cents > 0 then
    perform private.notify(v_user, 'topup_done', 'Votre solde a été crédité',
      private.fmt_eur(p_amount_cents) || ' ont été ajoutés à votre solde.', '{}'::jsonb, 'admin:' || p_idempotency_key);
  end if;
  return jsonb_build_object('ok', true, 'transaction_id', t.id, 'balance_after_cents', t.balance_after_cents);
end $$;

create or replace function public.admin_refund_job(p_job_id uuid, p_reason text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := private.require_admin(); j public.video_jobs; h public.wallet_holds; t public.wallet_transactions; v_replay boolean;
begin
  if coalesce(char_length(trim(p_reason)), 0) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  select * into j from public.video_jobs where id = p_job_id for update;
  if not found then raise exception 'job_not_found' using errcode = 'P0002'; end if;
  select * into h from public.wallet_holds where job_id = p_job_id for update;
  if not found or h.status <> 'captured' then return jsonb_build_object('ok', false, 'code', 'nothing_to_refund'); end if;
  select exists (select 1 from public.wallet_transactions where wallet_id = h.wallet_id and idempotency_key = 'jobrefund:' || p_job_id) into v_replay;
  t := private.wallet_apply(h.wallet_id, 'refund', h.amount_cents, 'jobrefund:' || p_job_id, null, j.project_id, p_job_id, h.id,
    'Remboursement', jsonb_build_object('admin_reason', left(p_reason, 500), 'client_key', p_idempotency_key), v_admin);
  if v_replay then return jsonb_build_object('ok', true, 'replayed', true, 'transaction_id', t.id); end if;
  update public.usage_costs set revenue_cents = 0 where job_id = p_job_id;
  perform private.audit('job.refund', 'video_job', p_job_id::text, null,
    jsonb_build_object('refunded_cents', h.amount_cents, 'transaction_id', t.id), p_reason);
  perform private.notify(j.user_id, 'info', 'Remboursement effectué',
    private.fmt_eur(h.amount_cents) || ' ont été remis sur votre solde.', '{}'::jsonb, 'jobrefund:' || p_job_id);
  return jsonb_build_object('ok', true, 'transaction_id', t.id);
end $$;

-- ── Clients ─────────────────────────────────────────────────────────────
create or replace function public.admin_set_user_status(p_user_id uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_before text;
begin
  perform private.require_admin();
  if p_status not in ('active', 'suspended') then raise exception 'invalid_status' using errcode = '22023'; end if;
  if coalesce(char_length(trim(p_reason)), 0) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  select status into v_before from public.profiles where id = p_user_id for update;
  if not found or v_before = 'deleted' then raise exception 'user_not_found' using errcode = 'P0002'; end if;
  update public.profiles set status = p_status where id = p_user_id;
  update public.wallets set status = case when p_status = 'suspended' then 'frozen' else 'active' end
   where user_id = p_user_id and status <> 'closed';
  perform private.audit('user.' || p_status, 'user', p_user_id::text, jsonb_build_object('status', v_before),
    jsonb_build_object('status', p_status), p_reason);
end $$;

create or replace function public.admin_add_note(p_user_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_staff uuid := private.require_admin();
begin
  insert into public.customer_notes (user_id, author_id, note) values (p_user_id, v_staff, p_note);
  perform private.audit('user.note', 'user', p_user_id::text, null, null, 'note interne');
end $$;

-- Création d'un client « signé hors application » + lien d'invitation (§36).
-- Le jeton clair n'est retourné QU'À cet appel ; seul son hash est stocké.
create or replace function public.admin_create_client_invitation(
  p_client_name text, p_email text, p_company text, p_source_name text, p_campaign text,
  p_salesperson text, p_deal_ref text, p_paid_cents bigint, p_gifted_credit_cents bigint,
  p_notes text, p_expires_days integer default 14)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := private.require_admin();
  v_src uuid; v_deal uuid; v_inv uuid; v_token text;
begin
  if coalesce(trim(p_client_name), '') = '' then raise exception 'client_name_required' using errcode = '22023'; end if;
  if p_paid_cents < 0 or p_gifted_credit_cents < 0 then raise exception 'invalid_amount' using errcode = '22023'; end if;
  if p_source_name is not null and trim(p_source_name) <> '' then
    select id into v_src from public.sales_sources
     where name = trim(p_source_name) and coalesce(campaign, '') = coalesce(p_campaign, '') and coalesce(salesperson, '') = coalesce(p_salesperson, '');
    if v_src is null then
      insert into public.sales_sources (name, campaign, salesperson) values (trim(p_source_name), p_campaign, p_salesperson)
      returning id into v_src;
    end if;
  end if;
  insert into public.commercial_deals (deal_ref, client_name, email, company, sales_source_id, paid_cents,
    gifted_credit_cents, notes, created_by)
  values (nullif(trim(p_deal_ref), ''), trim(p_client_name), lower(nullif(trim(p_email), '')), p_company, v_src,
    p_paid_cents, p_gifted_credit_cents, p_notes, v_admin)
  returning id into v_deal;

  -- Crédit initial = montant payé + solde offert (l'admin les saisit séparément pour la compta).
  v_token := translate(rtrim(encode(extensions.gen_random_bytes(24), 'base64'), '='), '+/', '-_');
  insert into public.invitations (token_hash, kind, email, deal_id, credit_cents, expires_at, created_by)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), 'client', lower(nullif(trim(p_email), '')), v_deal,
    p_paid_cents + p_gifted_credit_cents, now() + make_interval(days => greatest(p_expires_days, 1)), v_admin)
  returning id into v_inv;
  perform private.audit('deal.created', 'commercial_deal', v_deal::text, null,
    jsonb_build_object('paid_cents', p_paid_cents, 'gifted_credit_cents', p_gifted_credit_cents, 'invitation_id', v_inv), 'création client');
  return jsonb_build_object('ok', true, 'deal_id', v_deal, 'invitation_id', v_inv, 'token', v_token);
end $$;

create or replace function public.admin_revoke_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin();
  update public.invitations set status = 'revoked' where id = p_invitation_id and status = 'pending';
  perform private.audit('invitation.revoked', 'invitation', p_invitation_id::text, null, null, 'révocation');
end $$;

-- ── Jobs ────────────────────────────────────────────────────────────────
-- Relance « sûre » : uniquement un job FAILED dont le montant a été libéré.
-- Un nouveau HOLD est pris (le client doit avoir le solde), jamais de double encaissement.
create or replace function public.admin_retry_job(p_job_id uuid, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := private.require_admin();
  j public.video_jobs; h public.wallet_holds; v_hold uuid; v_avail bigint; w public.wallets; v_has_hold boolean;
begin
  if coalesce(char_length(trim(p_reason)), 0) < 5 then raise exception 'reason_required' using errcode = '22023'; end if;
  select * into j from public.video_jobs where id = p_job_id for update;
  if not found then raise exception 'job_not_found' using errcode = 'P0002'; end if;
  if j.status <> 'failed' then return jsonb_build_object('ok', false, 'code', 'not_retryable'); end if;
  if exists (select 1 from public.video_jobs where project_id = j.project_id and id <> j.id
             and status not in ('completed', 'failed', 'cancelled')) then
    return jsonb_build_object('ok', false, 'code', 'job_in_progress');
  end if;
  perform 1 from public.projects where id = j.project_id for update;
  select * into h from public.wallet_holds where job_id = p_job_id for update;
  v_has_hold := found;
  if v_has_hold and h.status = 'captured' then return jsonb_build_object('ok', false, 'code', 'already_captured'); end if;
  select * into w from public.wallets where id = j.wallet_id;
  if j.price_cents > 0 then
    v_avail := w.balance_cents - w.held_cents;
    if v_avail < j.price_cents then
      return jsonb_build_object('ok', false, 'code', 'insufficient_funds', 'shortfall_cents', j.price_cents - v_avail);
    end if;
    if v_has_hold then
      update public.wallet_holds set status = 'held', resolved_at = null where id = h.id;
      v_hold := h.id;
    else
      v_hold := gen_random_uuid();
      insert into public.wallet_holds (id, wallet_id, job_id, amount_cents) values (v_hold, w.id, j.id, j.price_cents);
    end if;
    perform private.wallet_apply(w.id, 'hold', j.price_cents, 'hold:' || j.id || ':retry:' || (j.attempt_count + 1000), null,
      j.project_id, j.id, v_hold, 'Relance technique', jsonb_build_object('retried_by', v_admin), v_admin);
    update public.video_jobs set wallet_hold_id = v_hold where id = j.id;
  end if;
  update public.video_jobs set status = 'queued', error_code = null, progress = 0, current_stage = 'queued', attempt_count = 0,
    cancel_requested = false, completed_at = null, next_attempt_at = now(), locked_until = null where id = j.id;
  update public.project_versions set status = 'pending' where id = j.version_id;
  update public.projects set status = 'processing' where id = j.project_id;
  perform private.log_job_event(j.id, 'admin', 'info', 'retry', 'Relance technique par un administrateur',
    jsonb_build_object('reason', p_reason));
  perform private.audit('job.retry', 'video_job', j.id::text, jsonb_build_object('status', 'failed'), jsonb_build_object('status', 'queued'), p_reason);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_job_detail(p_job_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_staff();
  return (select jsonb_build_object(
    'job', to_jsonb(j), 'internals', to_jsonb(i),
    'costs', (select to_jsonb(c) from public.usage_costs c where c.job_id = j.id),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.job_events e where e.job_id = j.id), '[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from public.wallet_transactions t where t.job_id = j.id), '[]'::jsonb))
    from public.video_jobs j left join public.video_job_internals i on i.job_id = j.id where j.id = p_job_id);
end $$;

create or replace function public.admin_list_jobs(p_status text default null, p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_staff();
  return coalesce((select jsonb_agg(row_to_json(x)) from (
    select j.id, j.correlation_id, j.status, j.kind, j.progress, j.current_stage, j.price_cents, j.error_code,
           j.attempt_count, j.created_at, j.completed_at, j.user_id, p.email, c.total_actual_cost_micro, c.gross_margin_cents
    from public.video_jobs j
    left join public.profiles p on p.id = j.user_id
    left join public.usage_costs c on c.job_id = j.id
    where p_status is null or j.status = p_status
    order by j.created_at desc limit least(p_limit, 200) offset greatest(p_offset, 0)) x), '[]'::jsonb);
end $$;

-- ── Tableau de bord ─────────────────────────────────────────────────────
-- CA = montants CAPTURÉS (consommés) ; « rechargé » = trésorerie entrante (topups).
create or replace function public.admin_dashboard(p_tz text default 'Europe/Paris')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_day timestamptz := date_trunc('day', now() at time zone p_tz) at time zone p_tz;
  v_month timestamptz := date_trunc('month', now() at time zone p_tz) at time zone p_tz;
begin
  perform private.require_staff();
  return jsonb_build_object(
    'revenue_today_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_transactions where type = 'capture' and created_at >= v_day),
    'revenue_month_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_transactions where type = 'capture' and created_at >= v_month),
    'refunded_month_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_transactions where type = 'refund' and created_at >= v_month),
    'wallet_recharged_month_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_transactions where type = 'topup' and created_at >= v_month),
    'wallet_consumed_month_cents', (select coalesce(sum(amount_cents), 0) from public.wallet_transactions where type = 'capture' and created_at >= v_month),
    'outstanding_wallet_cents', (select coalesce(sum(balance_cents), 0) from public.wallets where status <> 'closed'),
    'videos_month', (select count(*) from public.video_jobs where created_at >= v_month),
    'jobs_completed_month', (select count(*) from public.video_jobs where status = 'completed' and completed_at >= v_month),
    'jobs_failed_month', (select count(*) from public.video_jobs where status = 'failed' and completed_at >= v_month),
    'jobs_active', (select count(*) from public.video_jobs where status not in ('completed', 'failed', 'cancelled')),
    'engine_cost_month_micro', (select coalesce(sum(c.total_actual_cost_micro), 0) from public.usage_costs c
                                  join public.video_jobs j on j.id = c.job_id where j.created_at >= v_month),
    'gross_margin_month_cents', (select coalesce(sum(c.gross_margin_cents), 0) from public.usage_costs c
                                   join public.video_jobs j on j.id = c.job_id where j.status = 'completed' and j.completed_at >= v_month),
    'customers_total', (select count(*) from public.profiles where status <> 'deleted'));
end $$;

create or replace function public.admin_customers(p_search text default null, p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_q text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform private.require_staff();
  return coalesce((select jsonb_agg(row_to_json(x)) from (
    select p.id, trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) as name, p.email, p.company, p.status,
           w.id as wallet_id, w.balance_cents - w.held_cents as available_cents,
           coalesce((select sum(t.amount_cents) from public.wallet_transactions t where t.wallet_id = w.id and t.type = 'capture'), 0) as spent_cents,
           (select count(*) from public.video_jobs j where j.user_id = p.id) as video_count,
           greatest(p.last_seen_at, (select max(j.created_at) from public.video_jobs j where j.user_id = p.id)) as last_activity,
           p.created_at
    from public.profiles p left join public.wallets w on w.user_id = p.id
    where p.status <> 'deleted'
      and (v_q is null or p.email ilike '%' || replace(replace(v_q, '%', ''), '_', '') || '%'
           or coalesce(p.company, '') ilike '%' || replace(replace(v_q, '%', ''), '_', '') || '%'
           or (coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) ilike '%' || replace(replace(v_q, '%', ''), '_', '') || '%')
    order by p.created_at desc limit least(p_limit, 200) offset greatest(p_offset, 0)) x), '[]'::jsonb);
end $$;

create or replace function public.admin_customer_detail(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_staff();
  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = p_user_id),
    'wallet', (select to_jsonb(w) from public.wallets w where w.user_id = p_user_id),
    'transactions', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at desc) from (
        select t.* from public.wallet_transactions t join public.wallets w on w.id = t.wallet_id
         where w.user_id = p_user_id order by t.created_at desc limit 100) t), '[]'::jsonb),
    'payments', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select * from public.payments where user_id = p_user_id order by created_at desc limit 50) x), '[]'::jsonb),
    'projects', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select id, title, status, source_mode, created_at from public.projects where owner_user_id = p_user_id and deleted_at is null
         order by created_at desc limit 50) x), '[]'::jsonb),
    'jobs', coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
        select j.id, j.status, j.kind, j.price_cents, j.error_code, j.created_at, c.total_actual_cost_micro, c.gross_margin_cents, c.revenue_cents
          from public.video_jobs j left join public.usage_costs c on c.job_id = j.id
         where j.user_id = p_user_id order by j.created_at desc limit 50) x), '[]'::jsonb),
    'totals', (select jsonb_build_object(
        'revenue_cents', coalesce(sum(c.revenue_cents), 0),
        'cost_micro', coalesce(sum(c.total_actual_cost_micro), 0),
        'margin_cents', coalesce(sum(c.gross_margin_cents), 0))
       from public.usage_costs c where c.user_id = p_user_id),
    'notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from public.customer_notes n where n.user_id = p_user_id), '[]'::jsonb),
    'support_requests', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at desc) from public.support_requests s where s.user_id = p_user_id), '[]'::jsonb));
end $$;

-- ── Configuration ───────────────────────────────────────────────────────
create or replace function public.admin_set_setting(p_key text, p_value jsonb, p_reason text default 'configuration')
returns void language plpgsql security definer set search_path = '' as $$
declare v_before jsonb;
begin
  perform private.require_admin();
  select value into v_before from public.app_settings where key = p_key;
  if not found then raise exception 'unknown_setting' using errcode = 'P0002'; end if;
  update public.app_settings set value = p_value, updated_by = (select auth.uid()) where key = p_key;
  perform private.audit('setting.updated', 'app_setting', p_key, jsonb_build_object('value', v_before), jsonb_build_object('value', p_value), p_reason);
end $$;

-- Un changement de prix ne réécrit jamais l'historique : l'ancienne règle est
-- close (effective_to) et une nouvelle prend le relais.
create or replace function public.admin_change_price(p_rule_id uuid, p_price_cents integer, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.pricing_rules; v_new uuid;
begin
  perform private.require_admin();
  if p_price_cents < 0 then raise exception 'invalid_amount' using errcode = '22023'; end if;
  select * into r from public.pricing_rules where id = p_rule_id for update;
  if not found then raise exception 'rule_not_found' using errcode = 'P0002'; end if;
  update public.pricing_rules set effective_to = now(), active = false where id = r.id;
  insert into public.pricing_rules (mode, bucket_key, label, duration_min_sec, duration_max_sec, price_cents, currency,
    active, effective_from, sort_order, metadata)
  values (r.mode, r.bucket_key, r.label, r.duration_min_sec, r.duration_max_sec, p_price_cents, r.currency,
    true, now(), r.sort_order, r.metadata) returning id into v_new;
  perform private.audit('pricing.changed', 'pricing_rule', v_new::text, jsonb_build_object('price_cents', r.price_cents),
    jsonb_build_object('price_cents', p_price_cents), p_reason);
  return v_new;
end $$;

-- Support : statut + notes internes (le staff « support » peut traiter, seul l'admin modifie finances/config).
create or replace function public.admin_update_support_request(p_id uuid, p_status text, p_staff_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_staff();
  if p_status not in ('open', 'in_progress', 'resolved') then raise exception 'invalid_status' using errcode = '22023'; end if;
  update public.support_requests set status = p_status, staff_notes = coalesce(left(p_staff_notes, 4000), staff_notes) where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform private.audit('support.updated', 'support_request', p_id::text, null, jsonb_build_object('status', p_status), 'traitement support');
end $$;
