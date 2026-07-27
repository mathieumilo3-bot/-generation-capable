-- GC Shield v2 foundation: signatures, immutable audit, anomaly events,
-- platform payments and role-based permissions.

create extension if not exists pgcrypto;

create table if not exists public.gc_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('admin','manager','vendeur','ambassadeur','client')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gc_site_signatures (
  id uuid primary key default gen_random_uuid(),
  signature_id text not null unique,
  site_url text,
  owner_email text,
  owner_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active','revoked','pending','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  verified_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.gc_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_email text,
  actor_role text,
  action text not null,
  resource_type text not null,
  resource_id text,
  ip_hash text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  previous_hash text,
  event_hash text not null unique
);

create table if not exists public.gc_anomaly_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_email text,
  signal text not null,
  severity text not null default 'low' check (severity in ('low','medium','high','critical')),
  score numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create table if not exists public.gc_platform_payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  provider text not null default 'stripe',
  provider_session_id text unique,
  buyer_email text not null,
  seller_email text,
  ambassador_code text,
  product_code text not null,
  amount_cents integer,
  currency text not null default 'eur',
  status text not null default 'initiated' check (status in ('initiated','paid','failed','refunded','disputed')),
  platform_enforced boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists gc_audit_log_created_at_idx on public.gc_audit_log(created_at desc);
create index if not exists gc_site_signatures_owner_idx on public.gc_site_signatures(owner_email);
create index if not exists gc_anomaly_events_actor_idx on public.gc_anomaly_events(actor_email, created_at desc);
create index if not exists gc_platform_payments_buyer_idx on public.gc_platform_payments(buyer_email, created_at desc);

alter table public.gc_user_roles enable row level security;
alter table public.gc_site_signatures enable row level security;
alter table public.gc_audit_log enable row level security;
alter table public.gc_anomaly_events enable row level security;
alter table public.gc_platform_payments enable row level security;

create or replace function public.gc_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.gc_user_roles where user_id = auth.uid() limit 1), 'client')
$$;

create or replace function public.gc_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.gc_current_role() in ('admin','manager')
$$;

drop policy if exists "users can read own role" on public.gc_user_roles;
create policy "users can read own role" on public.gc_user_roles
  for select using (user_id = auth.uid() or public.gc_is_staff());

drop policy if exists "staff can read site signatures" on public.gc_site_signatures;
create policy "staff can read site signatures" on public.gc_site_signatures
  for select using (public.gc_is_staff() or owner_user_id = auth.uid());

drop policy if exists "public can verify active signatures" on public.gc_site_signatures;
create policy "public can verify active signatures" on public.gc_site_signatures
  for select using (status = 'active');

drop policy if exists "staff can read audit log" on public.gc_audit_log;
create policy "staff can read audit log" on public.gc_audit_log
  for select using (public.gc_is_staff());

drop policy if exists "staff can read anomalies" on public.gc_anomaly_events;
create policy "staff can read anomalies" on public.gc_anomaly_events
  for select using (public.gc_is_staff());

drop policy if exists "users can read own payments" on public.gc_platform_payments;
create policy "users can read own payments" on public.gc_platform_payments
  for select using (buyer_email = auth.email() or seller_email = auth.email() or public.gc_is_staff());

create or replace function public.gc_prevent_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'gc_audit_log is immutable';
end;
$$;

drop trigger if exists gc_audit_log_no_update on public.gc_audit_log;
create trigger gc_audit_log_no_update
before update or delete on public.gc_audit_log
for each row execute function public.gc_prevent_audit_mutation();
