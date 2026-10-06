-- ════════════════════════════════════════════════════════════════════════
-- 0003 — Paiements, moyens de paiement, recharge automatique, webhooks
-- ════════════════════════════════════════════════════════════════════════

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,  -- conservé (anonymisé) pour obligations comptables
  organization_id uuid references public.organizations(id) on delete set null,
  wallet_id       uuid not null references public.wallets(id) on delete restrict,
  provider        text not null check (provider in ('stripe', 'apple', 'google', 'manual')),
  provider_ref    text,                       -- payment_intent / transaction id côté fournisseur
  kind            text not null default 'topup' check (kind in ('topup', 'auto_reload')),
  amount_cents    bigint not null check (amount_cents > 0),
  currency        char(3) not null default 'EUR',
  status          text not null default 'pending' check (status in (
    'pending', 'requires_action', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded')),
  refunded_cents  bigint not null default 0 check (refunded_cents >= 0 and refunded_cents <= amount_cents),
  failure_code    text,                       -- code normalisé (card_declined, insufficient_funds…)
  failure_detail_internal text,               -- jamais exposé au client
  receipt_url     text,
  invoice_url     text,
  platform        text check (platform in ('ios', 'android', 'web')),
  idempotency_key text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  succeeded_at    timestamptz,
  updated_at      timestamptz not null default now()
);
create unique index payments_provider_ref_uidx on public.payments (provider, provider_ref) where provider_ref is not null;
create unique index payments_user_idem_uidx on public.payments (user_id, idempotency_key) where idempotency_key is not null;
create index payments_wallet_idx on public.payments (wallet_id, created_at desc);
create trigger payments_updated before update on public.payments
  for each row execute function private.set_updated_at();
alter table public.payments enable row level security;
create policy payments_select on public.payments
  for select to authenticated using (
    exists (select 1 from public.wallets w where w.id = wallet_id and private.can_read_wallet(w))
    or private.is_staff());

-- Vue client : sans détails internes.
create view public.payments_public with (security_invoker = true) as
  select id, wallet_id, provider, kind, amount_cents, currency, status, refunded_cents,
         failure_code, receipt_url, invoice_url, platform, created_at, succeeded_at
  from public.payments;

-- Client chez le fournisseur (jamais lisible côté client).
create table public.billing_customers (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references auth.users(id) on delete cascade,
  organization_id      uuid references public.organizations(id) on delete cascade,
  provider             text not null check (provider in ('stripe')),
  provider_customer_id text not null,
  created_at           timestamptz not null default now(),
  check (num_nonnulls(user_id, organization_id) = 1),
  unique (provider, provider_customer_id)
);
create unique index billing_customers_user_uidx on public.billing_customers (user_id, provider) where user_id is not null;
create unique index billing_customers_org_uidx on public.billing_customers (organization_id, provider) where organization_id is not null;
alter table public.billing_customers enable row level security;   -- aucune policy : service_role uniquement

create table public.payment_methods (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  wallet_id       uuid not null references public.wallets(id) on delete cascade,
  provider        text not null check (provider in ('stripe')),
  provider_pm_id  text not null,
  brand           text,
  last4           text check (last4 ~ '^[0-9]{4}$'),
  exp_month       smallint check (exp_month between 1 and 12),
  exp_year        smallint,
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (provider, provider_pm_id)
);
create index payment_methods_wallet_idx on public.payment_methods (wallet_id);
alter table public.payment_methods enable row level security;
create policy payment_methods_select on public.payment_methods
  for select to authenticated using (user_id = (select auth.uid()) or private.is_staff());

create table public.auto_reload_rules (
  id                uuid primary key default gen_random_uuid(),
  wallet_id         uuid not null unique references public.wallets(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  enabled           boolean not null default false,
  threshold_cents   integer not null check (threshold_cents >= 0),
  amount_cents      integer not null check (amount_cents >= 1000),
  monthly_cap_cents integer not null check (monthly_cap_cents >= amount_cents),
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  provider          text not null default 'stripe' check (provider in ('stripe')),
  failure_count     smallint not null default 0,
  last_triggered_at timestamptz,
  last_status       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create trigger auto_reload_rules_updated before update on public.auto_reload_rules
  for each row execute function private.set_updated_at();
alter table public.auto_reload_rules enable row level security;
create policy auto_reload_rules_select on public.auto_reload_rules
  for select to authenticated using (user_id = (select auth.uid()) or private.is_staff());

-- Une tentative de recharge auto par (règle, heure) : empêche les doubles débits.
create table public.auto_reload_attempts (
  id          uuid primary key default gen_random_uuid(),
  rule_id     uuid not null references public.auto_reload_rules(id) on delete cascade,
  window_key  text not null,
  payment_id  uuid references public.payments(id) on delete set null,
  status      text not null default 'started' check (status in ('started', 'succeeded', 'failed', 'requires_action')),
  created_at  timestamptz not null default now(),
  unique (rule_id, window_key)
);
alter table public.auto_reload_attempts enable row level security;
create policy auto_reload_attempts_staff on public.auto_reload_attempts
  for select to authenticated using (private.is_staff());

-- Journal des webhooks (déduplication + traçabilité §47).
create table public.webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null,
  event_id     text not null,
  event_type   text not null,
  status       text not null default 'received' check (status in ('received', 'processed', 'ignored', 'failed')),
  attempts     integer not null default 1,
  payload      jsonb,
  error        text,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, event_id)
);
alter table public.webhook_events enable row level security;
create policy webhook_events_staff on public.webhook_events
  for select to authenticated using (private.is_staff());

-- Limitation de débit générique (RPC sensibles + fonctions Edge).
create table public.rate_limits (
  key          text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;

create or replace function private.check_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, v_start, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  if v_count > p_max then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  -- Nettoyage opportuniste (1 % des appels).
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
end $$;
