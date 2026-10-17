-- Superteam Earn autonomous agent: state for the earn-agent Edge Function.
-- Lives in its own schema, which is NOT exposed through the Data API; the
-- function talks to Postgres directly (SUPABASE_DB_URL). Secrets (Earn API key,
-- claim code, cron token) live in Supabase Vault, never in these tables.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create schema if not exists earn_agent;
revoke all on schema earn_agent from public, anon, authenticated;

create table if not exists earn_agent.config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists earn_agent.locks (
  name text primary key,
  until timestamptz not null
);

create table if not exists earn_agent.listings (
  id text primary key,
  slug text not null unique,
  title text not null,
  type text not null,
  token text,
  deadline timestamptz,
  live jsonb not null,
  details jsonb,
  details_fetched_at timestamptz,
  assessment jsonb,
  score double precision,
  decision text,
  decision_reason text,
  is_live boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists listings_live_score_idx on earn_agent.listings (is_live, score desc);

create table if not exists earn_agent.jobs (
  id uuid primary key default gen_random_uuid(),
  listing_id text not null unique references earn_agent.listings (id),
  slug text not null,
  status text not null default 'queued'
    check (status in ('queued', 'rejected_qa', 'delivered', 'approved', 'submitted', 'submit_failed', 'abandoned', 'expired')),
  priority double precision not null default 0,
  queued_at timestamptz not null default now(),
  delivered_at timestamptz,
  submitted_at timestamptz,
  commit_sha text,
  deliverable_url text,
  manifest_hash text,
  qa_report jsonb,
  submission_id text,
  submission_response jsonb,
  attempts integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);
create index if not exists jobs_status_idx on earn_agent.jobs (status);

create table if not exists earn_agent.ledger (
  listing_id text primary key references earn_agent.listings (id),
  slug text not null,
  title text not null,
  submission_id text,
  submitted_at timestamptz not null,
  link text,
  token text,
  prize_pool double precision,
  first_prize double precision,
  expected_usd double precision,
  outcome text not null default 'pending' check (outcome in ('pending', 'won', 'lost', 'unknown')),
  winner_position integer,
  amount_won double precision,
  amount_won_usd double precision,
  payout_status text,
  checked_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists earn_agent.runs (
  id bigserial primary key,
  kind text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  ok boolean,
  stats jsonb,
  error text
);

alter table earn_agent.config enable row level security;
alter table earn_agent.locks enable row level security;
alter table earn_agent.listings enable row level security;
alter table earn_agent.jobs enable row level security;
alter table earn_agent.ledger enable row level security;
alter table earn_agent.runs enable row level security;

-- Shared secret the cron job presents to the function's protected routes.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'earn_agent_cron_token') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'earn_agent_cron_token',
      'Header x-earn-agent-token for earn-agent /tick and /register');
  end if;
end $$;

-- Keep 30 days of run history.
create or replace function earn_agent.prune_runs() returns void
language sql security definer set search_path = '' as $$
  delete from earn_agent.runs where started_at < now() - interval '30 days';
$$;
revoke all on function earn_agent.prune_runs() from public, anon, authenticated;
