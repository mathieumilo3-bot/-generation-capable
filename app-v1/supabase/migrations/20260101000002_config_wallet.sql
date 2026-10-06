-- ════════════════════════════════════════════════════════════════════════
-- 0002 — Configuration centrale, tarification, méthodes de montage,
--        capacités du moteur, wallets + ledger
-- ════════════════════════════════════════════════════════════════════════

-- ── Réglages applicatifs (source de vérité unique, §52) ────────────────
create table public.app_settings (
  key         text primary key check (key ~ '^[a-z0-9_.]+$'),
  value       jsonb not null,
  is_public   boolean not null default false,  -- lisible sans connexion (maintenance, version min…)
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users(id) on delete set null
);
create trigger app_settings_updated before update on public.app_settings
  for each row execute function private.set_updated_at();
alter table public.app_settings enable row level security;
create policy app_settings_public_read on public.app_settings
  for select to anon, authenticated using (is_public);
create policy app_settings_staff_read on public.app_settings
  for select to authenticated using (private.is_staff());

create or replace function private.setting(p_key text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select value from public.app_settings where key = p_key;
$$;

-- ── Tarification (§9) — montants en CENTIMES ENTIERS ────────────────────
create table public.pricing_rules (
  id               uuid primary key default gen_random_uuid(),
  mode             text not null check (mode in ('edit_rushes', 'autonomous', 'revision')),
  bucket_key       text not null check (bucket_key ~ '^[a-z0-9_]+$'),
  label            text not null,
  -- Bornes en secondes. Convention : durée > min et <= max (0–30 s, 30–60 s…).
  duration_min_sec integer not null check (duration_min_sec >= 0),
  duration_max_sec integer not null check (duration_max_sec > duration_min_sec),
  price_cents      integer not null check (price_cents >= 0),
  currency         char(3) not null default 'EUR' check (currency = 'EUR'),
  active           boolean not null default true,
  effective_from   timestamptz not null default now(),
  effective_to     timestamptz,
  sort_order       integer not null default 0,
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (mode, bucket_key, effective_from),
  check (effective_to is null or effective_to > effective_from)
);
alter table public.pricing_rules enable row level security;
create policy pricing_rules_read on public.pricing_rules
  for select to authenticated using (active or private.is_staff());

-- Règle tarifaire valide à l'instant T (utilisée par le serveur, jamais par le client).
create or replace function private.pricing_rule_is_current(r public.pricing_rules)
returns boolean language sql stable as $$
  select r.active and r.effective_from <= now() and (r.effective_to is null or r.effective_to > now());
$$;

-- ── Méthodes de montage pilotées par la donnée (§50) ───────────────────
create table public.editing_methods (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name          text not null,
  description   text not null default '',
  cover_asset   text,
  version       integer not null default 1,
  active        boolean not null default true,
  advanced      boolean not null default false,   -- rangé dans « Plus d'options »
  recommended   boolean not null default false,
  sort_order    integer not null default 0,
  -- {modes:[edit_rushes], requires_references:bool, requires_instructions:bool}
  capabilities  jsonb not null default '{}'::jsonb,
  configuration jsonb not null default '{}'::jsonb,   -- visible côté app
  engine_config jsonb not null default '{}'::jsonb,   -- JAMAIS exposé au client (voir vue)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger editing_methods_updated before update on public.editing_methods
  for each row execute function private.set_updated_at();
alter table public.editing_methods enable row level security;
-- Pas de policy client directe : la configuration moteur ne doit pas fuiter.
create policy editing_methods_staff on public.editing_methods
  for select to authenticated using (private.is_staff());

create view public.editing_methods_public
  with (security_invoker = false, security_barrier = true) as
  select id, slug, name, description, cover_asset, version, advanced, recommended,
         sort_order, capabilities, configuration
  from public.editing_methods
  where active;

-- ── Capacités du moteur (§51) ───────────────────────────────────────────
create table public.engine_capabilities (
  id             uuid primary key default gen_random_uuid(),
  engine_version text not null,
  capabilities   jsonb not null,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create unique index engine_capabilities_one_active on public.engine_capabilities ((true)) where active;
alter table public.engine_capabilities enable row level security;
create policy engine_capabilities_read on public.engine_capabilities
  for select to authenticated using (active or private.is_staff());

create or replace function private.engine_supports(p_path text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select (capabilities #>> p_path)::boolean from public.engine_capabilities where active), false);
$$;

-- ── Wallets ─────────────────────────────────────────────────────────────
create table public.wallets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  currency        char(3) not null default 'EUR' check (currency = 'EUR'),
  -- Fonds totaux (incluant la part réservée) et part réservée par des HOLD.
  -- Disponible = balance_cents - held_cents. Ces colonnes ne sont écrites QUE
  -- par private.wallet_apply (aucun GRANT UPDATE pour les rôles API).
  balance_cents   bigint not null default 0 check (balance_cents >= 0),
  held_cents      bigint not null default 0 check (held_cents >= 0),
  status          text not null default 'active' check (status in ('active', 'frozen', 'closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (held_cents <= balance_cents),
  check (num_nonnulls(user_id, organization_id) = 1 or status = 'closed')
);
create unique index wallets_user_uidx on public.wallets (user_id) where user_id is not null;
create unique index wallets_org_uidx on public.wallets (organization_id) where organization_id is not null;
create trigger wallets_updated before update on public.wallets
  for each row execute function private.set_updated_at();
alter table public.wallets enable row level security;

create or replace function private.can_read_wallet(p_wallet public.wallets)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_wallet.user_id = (select auth.uid())
      or (p_wallet.organization_id is not null and private.org_role(p_wallet.organization_id) is not null);
$$;

create policy wallets_select on public.wallets
  for select to authenticated using (private.can_read_wallet(wallets) or private.is_staff());

-- Ledger append-only (§11).
create table public.wallet_transactions (
  id                    uuid primary key default gen_random_uuid(),
  wallet_id             uuid not null references public.wallets(id) on delete restrict,
  user_id               uuid references auth.users(id) on delete set null,
  organization_id       uuid references public.organizations(id) on delete set null,
  type                  text not null check (type in (
    'topup', 'purchase', 'hold', 'capture', 'release', 'refund',
    'bonus', 'manual_adjustment', 'commercial_credit', 'promotion')),
  -- Magnitude positive ; signée uniquement pour manual_adjustment.
  amount_cents          bigint not null,
  -- Effet sur le solde DISPONIBLE (ce que l'utilisateur voit) : hold −a, release +a,
  -- capture 0 (déjà déduit au hold), crédits +a.
  available_delta_cents bigint not null,
  currency              char(3) not null default 'EUR',
  balance_before_cents  bigint not null,
  balance_after_cents   bigint not null,
  held_before_cents     bigint not null,
  held_after_cents      bigint not null,
  payment_id            uuid,
  project_id            uuid,
  job_id                uuid,
  hold_id               uuid,
  reference             text,
  idempotency_key       text not null check (char_length(idempotency_key) between 8 and 200),
  metadata              jsonb not null default '{}'::jsonb,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  check ((type = 'manual_adjustment' and amount_cents <> 0) or (type <> 'manual_adjustment' and amount_cents > 0)),
  unique (wallet_id, idempotency_key)
);
create index wallet_transactions_wallet_idx on public.wallet_transactions (wallet_id, created_at desc);
create index wallet_transactions_job_idx on public.wallet_transactions (job_id) where job_id is not null;
create index wallet_transactions_payment_idx on public.wallet_transactions (payment_id) where payment_id is not null;
-- Append-only : seule exception, l'anonymisation (suppression de compte) qui met
-- user_id / organization_id / created_by à NULL via ON DELETE SET NULL.
create or replace function private.ledger_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'append_only: wallet_transactions is immutable' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'user_id' - 'organization_id' - 'created_by')
     is distinct from (to_jsonb(old) - 'user_id' - 'organization_id' - 'created_by')
     or new.user_id is not null and new.user_id is distinct from old.user_id
     or new.organization_id is not null and new.organization_id is distinct from old.organization_id
     or new.created_by is not null and new.created_by is distinct from old.created_by then
    raise exception 'append_only: wallet_transactions is immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger wallet_transactions_immutable before update or delete on public.wallet_transactions
  for each row execute function private.ledger_guard();
alter table public.wallet_transactions enable row level security;
create policy wallet_transactions_select on public.wallet_transactions
  for select to authenticated using (
    exists (select 1 from public.wallets w where w.id = wallet_id and private.can_read_wallet(w))
    or private.is_staff());

-- Réservations (HOLD) : une par job. Le statut garantit capture/release uniques.
create table public.wallet_holds (
  id           uuid primary key default gen_random_uuid(),
  wallet_id    uuid not null references public.wallets(id) on delete restrict,
  job_id       uuid,
  amount_cents bigint not null check (amount_cents > 0),
  status       text not null default 'held' check (status in ('held', 'captured', 'released')),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create unique index wallet_holds_job_uidx on public.wallet_holds (job_id) where job_id is not null;
alter table public.wallet_holds enable row level security;
create policy wallet_holds_select on public.wallet_holds
  for select to authenticated using (
    exists (select 1 from public.wallets w where w.id = wallet_id and private.can_read_wallet(w))
    or private.is_staff());

-- Historique tel que l'utilisateur doit le voir (capture = 0 € → masquée).
create view public.wallet_history with (security_invoker = true) as
  select t.id, t.wallet_id, t.type, t.available_delta_cents, t.amount_cents, t.currency,
         t.reference, t.project_id, t.job_id, t.payment_id, t.metadata, t.created_at
  from public.wallet_transactions t
  where t.available_delta_cents <> 0;

-- Vue « solde » : disponible calculé côté serveur.
create view public.wallet_balances with (security_invoker = true) as
  select w.id as wallet_id, w.user_id, w.organization_id, w.currency, w.status,
         w.balance_cents, w.held_cents, (w.balance_cents - w.held_cents) as available_cents
  from public.wallets w;

-- ── Cœur comptable : TOUTE écriture de solde passe ici ─────────────────
-- Atomique (verrou de ligne), idempotente (clé unique par wallet), auditable.
-- Retourne la transaction ; `metadata->>'replayed'` n'est pas stocké : on
-- renvoie un 2e champ via la fonction wrapper `wallet_apply_ex` si besoin.
create or replace function private.wallet_apply(
  p_wallet_id       uuid,
  p_type            text,
  p_amount_cents    bigint,
  p_idempotency_key text,
  p_payment_id      uuid default null,
  p_project_id      uuid default null,
  p_job_id          uuid default null,
  p_hold_id         uuid default null,
  p_reference       text default null,
  p_metadata        jsonb default '{}'::jsonb,
  p_actor           uuid default null
) returns public.wallet_transactions
language plpgsql security definer set search_path = '' as $$
declare
  w        public.wallets;
  existing public.wallet_transactions;
  v_bal    bigint;
  v_held   bigint;
  v_delta_bal  bigint := 0;
  v_delta_held bigint := 0;
  v_avail_delta bigint := 0;
  out_row  public.wallet_transactions;
begin
  if p_amount_cents is null or p_amount_cents = 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_type <> 'manual_adjustment' and p_amount_cents < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;

  -- Verrou de ligne : sérialise toutes les opérations d'un même wallet.
  select * into w from public.wallets where id = p_wallet_id for update;
  if not found then raise exception 'wallet_not_found' using errcode = 'P0002'; end if;

  -- Rejeu idempotent : même clé → même transaction, aucun effet.
  select * into existing from public.wallet_transactions
    where wallet_id = p_wallet_id and idempotency_key = p_idempotency_key;
  if found then
    if existing.type <> p_type or existing.amount_cents <> p_amount_cents then
      raise exception 'idempotency_key_reused_with_different_payload' using errcode = '22023';
    end if;
    return existing;
  end if;

  if w.status = 'closed' then raise exception 'wallet_closed' using errcode = '42501'; end if;

  v_bal := w.balance_cents;
  v_held := w.held_cents;

  case p_type
    when 'topup', 'bonus', 'commercial_credit', 'promotion', 'refund' then
      v_delta_bal := p_amount_cents;
      v_avail_delta := p_amount_cents;
    when 'purchase' then
      if w.status <> 'active' then raise exception 'wallet_frozen' using errcode = '42501'; end if;
      if v_bal - v_held < p_amount_cents then raise exception 'insufficient_funds' using errcode = 'P0001'; end if;
      v_delta_bal := -p_amount_cents;
      v_avail_delta := -p_amount_cents;
    when 'hold' then
      if w.status <> 'active' then raise exception 'wallet_frozen' using errcode = '42501'; end if;
      if v_bal - v_held < p_amount_cents then raise exception 'insufficient_funds' using errcode = 'P0001'; end if;
      v_delta_held := p_amount_cents;
      v_avail_delta := -p_amount_cents;
    when 'release' then
      if v_held < p_amount_cents then raise exception 'hold_underflow' using errcode = 'P0001'; end if;
      v_delta_held := -p_amount_cents;
      v_avail_delta := p_amount_cents;
    when 'capture' then
      if v_held < p_amount_cents then raise exception 'hold_underflow' using errcode = 'P0001'; end if;
      v_delta_bal := -p_amount_cents;
      v_delta_held := -p_amount_cents;
      v_avail_delta := 0;
    when 'manual_adjustment' then
      if v_bal + p_amount_cents < v_held then raise exception 'adjustment_below_held' using errcode = 'P0001'; end if;
      v_delta_bal := p_amount_cents;
      v_avail_delta := p_amount_cents;
    else
      raise exception 'invalid_type' using errcode = '22023';
  end case;

  update public.wallets
     set balance_cents = v_bal + v_delta_bal, held_cents = v_held + v_delta_held
   where id = p_wallet_id;

  insert into public.wallet_transactions (
    wallet_id, user_id, organization_id, type, amount_cents, available_delta_cents, currency,
    balance_before_cents, balance_after_cents, held_before_cents, held_after_cents,
    payment_id, project_id, job_id, hold_id, reference, idempotency_key, metadata, created_by)
  values (
    p_wallet_id, w.user_id, w.organization_id, p_type, p_amount_cents, v_avail_delta, w.currency,
    v_bal, v_bal + v_delta_bal, v_held, v_held + v_delta_held,
    p_payment_id, p_project_id, p_job_id, p_hold_id, p_reference, p_idempotency_key, p_metadata, p_actor)
  returning * into out_row;
  return out_row;
end $$;
