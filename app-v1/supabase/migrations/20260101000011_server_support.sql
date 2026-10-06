-- ════════════════════════════════════════════════════════════════════════
-- 0011 — Support serveur : limitation de débit pour Edge Functions, liaison
-- PaymentIntent, jetons Sign in with Apple (révocation), file d'e-mails.
-- ════════════════════════════════════════════════════════════════════════

-- Rate limit appelable depuis les Edge Functions (service_role).
create or replace function public.svc_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform private.check_rate_limit(p_key, p_max, p_window_seconds);
  return true;
exception when others then
  if sqlerrm = 'rate_limited' then return false; end if;
  raise;
end $$;

-- Stripe Checkout : provider_ref = id de session ; le PaymentIntent est lié à l'abou­tissement.
create or replace function public.svc_payment_link_intent(p_payment_id uuid, p_intent text, p_receipt_url text default null)
returns void language sql security definer set search_path = '' as $$
  update public.payments
     set metadata = metadata || jsonb_build_object('payment_intent', p_intent),
         receipt_url = coalesce(p_receipt_url, receipt_url)
   where id = p_payment_id;
$$;

create or replace function public.svc_payment_find_by_intent(p_intent text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.payments
  where provider = 'stripe' and (metadata ->> 'payment_intent' = p_intent or provider_ref = p_intent)
  order by created_at desc limit 1;
$$;

create or replace function public.svc_payment_cancel(p_payment_id uuid)
returns void language sql security definer set search_path = '' as $$
  update public.payments set status = 'canceled' where id = p_payment_id and status in ('pending', 'requires_action');
$$;

-- Jeton Apple conservé CHIFFRÉ (AES-GCM côté Edge Function) pour pouvoir le révoquer à la suppression du compte.
create table public.apple_tokens (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  refresh_token_enc text not null,
  client_id     text not null,
  created_at    timestamptz not null default now()
);
alter table public.apple_tokens enable row level security;   -- aucune policy : service_role uniquement

-- File d'e-mails transactionnels (envoyés par l'orchestrateur ; aucun e-mail marketing en V1).
alter table public.notifications add column email_sent_at timestamptz;
alter table public.profiles add column welcome_email_sent_at timestamptz;

create or replace function public.svc_pending_emails(p_limit integer default 50)
returns table (kind text, ref_id uuid, user_id uuid, email text, first_name text, title text, body text, data jsonb)
language sql security definer set search_path = '' as $$
  (select 'welcome'::text, p.id, p.id, p.email, p.first_name, ''::text, ''::text, '{}'::jsonb
     from public.profiles p
    where p.welcome_email_sent_at is null and p.email is not null and p.status = 'active'
      and p.created_at > now() - interval '2 days'
    order by p.created_at limit p_limit)
  union all
  (select 'notification'::text, n.id, n.user_id, p.email, p.first_name, n.title, n.body, n.data || jsonb_build_object('kind', n.kind)
     from public.notifications n join public.profiles p on p.id = n.user_id
    where n.email_sent_at is null and n.created_at > now() - interval '1 day' and p.email is not null and p.status = 'active'
      and n.kind in ('video_ready', 'revision_ready', 'job_failed', 'topup_done', 'payment_failed')
    order by n.created_at limit p_limit);
$$;

create or replace function public.svc_mark_email_sent(p_kind text, p_ref uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_kind = 'welcome' then update public.profiles set welcome_email_sent_at = now() where id = p_ref;
  else update public.notifications set email_sent_at = now() where id = p_ref; end if;
end $$;

-- Lecture du solde minimal d'un utilisateur pour les fonctions serveur.
create or replace function public.svc_user_wallet(p_user_id uuid)
returns table (wallet_id uuid, status text, email text, first_name text, profile_status text)
language sql stable security definer set search_path = '' as $$
  select w.id, w.status, p.email, p.first_name, p.status
  from public.wallets w join public.profiles p on p.id = w.user_id where w.user_id = p_user_id;
$$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.create_draft_project(text, text, uuid), public.register_asset(uuid, text, text, text, bigint, numeric),
  public.complete_asset(uuid), public.delete_asset(uuid), public.rename_project(uuid, text),
  public.delete_project(uuid), public.duplicate_project(uuid), public.quote_video_job(uuid, uuid, text),
  public.submit_video_job(uuid, uuid, uuid, text, text, text), public.submit_revision(uuid, uuid, text, text),
  public.cancel_video_job(uuid), public.touch_profile(text, text), public.register_push_token(text, text),
  public.mark_notifications_read(uuid[]), public.create_support_request(text, text, uuid, uuid, uuid, text, text),
  public.create_organization(text), public.set_auto_reload(boolean, integer, integer, integer, uuid),
  public.accept_invitation(text),
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
