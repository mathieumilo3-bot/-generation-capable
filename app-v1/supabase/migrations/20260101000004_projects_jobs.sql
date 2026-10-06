-- ════════════════════════════════════════════════════════════════════════
-- 0004 — Projets, assets, versions, jobs vidéo, coûts, notifications,
--        support, invitations commerciales, audit
-- ════════════════════════════════════════════════════════════════════════

-- ── Projets ─────────────────────────────────────────────────────────────
create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  owner_user_id    uuid not null references auth.users(id) on delete cascade,
  organization_id  uuid references public.organizations(id) on delete set null,
  wallet_id        uuid references public.wallets(id) on delete set null,
  title            text not null default 'Sans titre' check (char_length(title) between 1 and 160),
  status           text not null default 'draft' check (status in ('draft', 'processing', 'ready', 'failed', 'archived')),
  source_mode      text not null default 'edit_rushes' check (source_mode in ('edit_rushes', 'autonomous')),
  current_version_id uuid,
  thumbnail_path   text,
  brief            jsonb not null default '{}'::jsonb,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index projects_owner_idx on public.projects (owner_user_id, created_at desc) where deleted_at is null;
create index projects_org_idx on public.projects (organization_id) where organization_id is not null;
create trigger projects_updated before update on public.projects
  for each row execute function private.set_updated_at();
alter table public.projects enable row level security;

create or replace function private.can_read_project(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and (
      p.owner_user_id = (select auth.uid())
      or (p.organization_id is not null and private.org_role(p.organization_id) is not null)
      or private.is_staff())
  );
$$;

create or replace function private.can_write_project(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project and (
      p.owner_user_id = (select auth.uid())
      or (p.organization_id is not null and private.has_org_role(p.organization_id, 'editor')))
  );
$$;

create policy projects_select on public.projects
  for select to authenticated using (deleted_at is null and private.can_read_project(id));
create policy projects_staff_select on public.projects
  for select to authenticated using (private.is_staff());
-- Aucune écriture directe : renommage / suppression / duplication passent par RPC.

-- ── Assets (rushs, références, images…) ─────────────────────────────────
create table public.assets (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  kind          text not null check (kind in ('raw', 'reference', 'image', 'logo', 'audio_note')),
  bucket        text not null check (bucket in ('raw', 'processed')),
  path          text not null unique,
  filename      text not null check (char_length(filename) between 1 and 255),
  mime_type     text not null,
  size_bytes    bigint not null check (size_bytes > 0),
  duration_sec  numeric(10, 2) check (duration_sec is null or duration_sec >= 0),
  status        text not null default 'pending' check (status in ('pending', 'uploaded', 'failed', 'deleted')),
  created_at    timestamptz not null default now(),
  uploaded_at   timestamptz
);
create index assets_project_idx on public.assets (project_id);
alter table public.assets enable row level security;
create policy assets_select on public.assets
  for select to authenticated using (status <> 'deleted' and private.can_read_project(project_id));

-- ── Versions ────────────────────────────────────────────────────────────
create table public.project_versions (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects(id) on delete cascade,
  version_number    integer not null check (version_number >= 1),
  parent_version_id uuid references public.project_versions(id) on delete set null,
  job_id            uuid,
  status            text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  instructions      text,
  render_path       text,       -- bucket renders
  thumbnail_path    text,       -- bucket thumbnails
  duration_sec      numeric(10, 2),
  width             integer,
  height            integer,
  size_bytes        bigint,
  created_at        timestamptz not null default now(),
  ready_at          timestamptz,
  unique (project_id, version_number)
);
alter table public.project_versions enable row level security;
create policy project_versions_select on public.project_versions
  for select to authenticated using (private.can_read_project(project_id));

alter table public.projects
  add constraint projects_current_version_fk foreign key (current_version_id)
  references public.project_versions(id) on delete set null;

-- ── Jobs vidéo (contrat app ⇄ moteur, §21) ──────────────────────────────
create table public.video_jobs (
  id                   uuid primary key default gen_random_uuid(),
  correlation_id       uuid not null default gen_random_uuid(),
  kind                 text not null default 'create' check (kind in ('create', 'revision')),
  project_id           uuid not null references public.projects(id) on delete cascade,
  version_id           uuid not null references public.project_versions(id) on delete cascade,
  user_id              uuid not null references auth.users(id) on delete cascade,
  organization_id      uuid references public.organizations(id) on delete set null,
  wallet_id            uuid not null references public.wallets(id) on delete restrict,
  source_mode          text not null check (source_mode in ('edit_rushes', 'autonomous')),
  editing_method_id    uuid references public.editing_methods(id) on delete set null,
  editing_method_slug  text,
  requested_duration_sec integer not null check (requested_duration_sec > 0),
  aspect_ratio         text not null default '9:16' check (aspect_ratio in ('9:16', '1:1', '16:9')),
  instructions         text check (char_length(instructions) <= 4000),
  pricing_rule_id      uuid not null references public.pricing_rules(id),
  price_cents          integer not null check (price_cents >= 0),
  wallet_hold_id       uuid,
  status               text not null default 'created' check (status in (
    'created', 'uploading', 'queued', 'preparing', 'analyzing', 'editing',
    'rendering', 'quality_check', 'completed', 'failed', 'cancelled')),
  progress             smallint not null default 0 check (progress between 0 and 100),
  current_stage        text,
  priority             integer not null default 0,
  attempt_count        integer not null default 0,
  max_attempts         integer not null default 3,
  next_attempt_at      timestamptz not null default now(),
  locked_until         timestamptz,
  cancel_requested     boolean not null default false,
  error_code           text,
  idempotency_key      text not null check (char_length(idempotency_key) between 8 and 200),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  started_at           timestamptz,
  completed_at         timestamptz,
  unique (user_id, idempotency_key)
);
create index video_jobs_claim_idx on public.video_jobs (priority desc, next_attempt_at)
  where status in ('queued');
create index video_jobs_project_idx on public.video_jobs (project_id, created_at desc);
create index video_jobs_user_idx on public.video_jobs (user_id, created_at desc);
create index video_jobs_active_idx on public.video_jobs (status)
  where status not in ('completed', 'failed', 'cancelled');
create trigger video_jobs_updated before update on public.video_jobs
  for each row execute function private.set_updated_at();
alter table public.video_jobs enable row level security;
create policy video_jobs_select on public.video_jobs
  for select to authenticated using (private.can_read_project(project_id));

alter table public.project_versions
  add constraint project_versions_job_fk foreign key (job_id)
  references public.video_jobs(id) on delete set null;
alter table public.wallet_holds
  add constraint wallet_holds_job_fk foreign key (job_id)
  references public.video_jobs(id) on delete set null;
alter table public.video_jobs
  add constraint video_jobs_hold_fk foreign key (wallet_hold_id)
  references public.wallet_holds(id) on delete set null;

-- Données internes du job (manifeste d'entrée, référence moteur, erreur technique,
-- worker) : AUCUN accès client — staff en lecture, service_role en écriture.
create table public.video_job_internals (
  job_id                 uuid primary key references public.video_jobs(id) on delete cascade,
  input_manifest         jsonb not null default '{}'::jsonb,
  engine_version         text,
  engine_job_ref         text,
  locked_by              text,
  error_message_internal text,
  updated_at             timestamptz not null default now()
);
alter table public.video_job_internals enable row level security;
create policy video_job_internals_staff on public.video_job_internals
  for select to authenticated using (private.is_staff());

-- Un seul job actif par projet (double clic, versions concurrentes).
create unique index video_jobs_one_active_per_project on public.video_jobs (project_id)
  where status not in ('completed', 'failed', 'cancelled');

-- Journal de job (logs app/orchestrateur/moteur) — staff uniquement.
create table public.job_events (
  id             bigint generated always as identity primary key,
  job_id         uuid not null references public.video_jobs(id) on delete cascade,
  correlation_id uuid not null,
  source         text not null check (source in ('app', 'billing', 'orchestrator', 'engine', 'admin')),
  level          text not null default 'info' check (level in ('debug', 'info', 'warn', 'error')),
  stage          text,
  message        text not null,
  data           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index job_events_job_idx on public.job_events (job_id, id);
alter table public.job_events enable row level security;
create policy job_events_staff on public.job_events
  for select to authenticated using (private.is_staff());

-- ── Coûts internes (§37) — jamais visibles du client ────────────────────
-- Unités : micro-euros (1 € = 1 000 000) → aucune perte sur des appels à 0,0003 €.
create table public.usage_costs (
  id                           uuid primary key default gen_random_uuid(),
  job_id                       uuid unique references public.video_jobs(id) on delete set null,
  user_id                      uuid references auth.users(id) on delete set null,
  transcription_cost_micro     bigint not null default 0 check (transcription_cost_micro >= 0),
  llm_cost_micro               bigint not null default 0 check (llm_cost_micro >= 0),
  generation_cost_micro        bigint not null default 0 check (generation_cost_micro >= 0),
  render_compute_cost_micro    bigint not null default 0 check (render_compute_cost_micro >= 0),
  storage_cost_micro           bigint not null default 0 check (storage_cost_micro >= 0),
  music_cost_micro             bigint not null default 0 check (music_cost_micro >= 0),
  external_api_cost_micro      bigint not null default 0 check (external_api_cost_micro >= 0),
  other_cost_micro             bigint not null default 0 check (other_cost_micro >= 0),
  total_actual_cost_micro      bigint generated always as (
    transcription_cost_micro + llm_cost_micro + generation_cost_micro + render_compute_cost_micro
    + storage_cost_micro + music_cost_micro + external_api_cost_micro + other_cost_micro) stored,
  currency                     char(3) not null default 'EUR',
  fx_rate_usd_eur              numeric(10, 6),
  revenue_cents                bigint not null default 0 check (revenue_cents >= 0),
  gross_margin_cents           bigint generated always as (
    revenue_cents - ceil((transcription_cost_micro + llm_cost_micro + generation_cost_micro
      + render_compute_cost_micro + storage_cost_micro + music_cost_micro
      + external_api_cost_micro + other_cost_micro) / 10000.0)::bigint) stored,
  detail                       jsonb not null default '{}'::jsonb,
  created_at                   timestamptz not null default now(),
  updated_at                   timestamptz not null default now()
);
create trigger usage_costs_updated before update on public.usage_costs
  for each row execute function private.set_updated_at();
alter table public.usage_costs enable row level security;
create policy usage_costs_staff on public.usage_costs
  for select to authenticated using (private.is_staff());

-- ── Notifications ───────────────────────────────────────────────────────
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in (
    'video_ready', 'revision_ready', 'job_failed', 'low_balance', 'topup_done', 'payment_failed', 'info')),
  title      text not null,
  body       text not null,
  data       jsonb not null default '{}'::jsonb,   -- {project_id, job_id, deep_link}
  read_at    timestamptz,
  push_sent_at timestamptz,
  dedupe_key text,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create unique index notifications_dedupe_uidx on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
alter table public.notifications enable row level security;
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null unique,
  platform   text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
create policy push_tokens_own on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));

-- ── Support (§41) ───────────────────────────────────────────────────────
create table public.support_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  project_id  uuid references public.projects(id) on delete set null,
  job_id      uuid references public.video_jobs(id) on delete set null,
  version_id  uuid references public.project_versions(id) on delete set null,
  category    text not null default 'other' check (category in ('video_problem', 'payment', 'account', 'other')),
  message     text not null check (char_length(message) between 1 and 4000),
  app_version text,
  platform    text,
  status      text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  staff_notes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index support_requests_user_idx on public.support_requests (user_id, created_at desc);
create trigger support_requests_updated before update on public.support_requests
  for each row execute function private.set_updated_at();
alter table public.support_requests enable row level security;
create policy support_requests_select on public.support_requests
  for select to authenticated using (user_id = (select auth.uid()) or private.is_staff());

-- ── Ventes directes, invitations (§36) ──────────────────────────────────
create table public.sales_sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  campaign    text,
  salesperson text,
  created_at  timestamptz not null default now()
);
alter table public.sales_sources enable row level security;
create policy sales_sources_staff on public.sales_sources
  for select to authenticated using (private.is_staff());

create table public.commercial_deals (
  id                    uuid primary key default gen_random_uuid(),
  deal_ref              text unique,
  client_name           text not null,
  email                 text,
  company               text,
  sales_source_id       uuid references public.sales_sources(id) on delete set null,
  paid_cents            bigint not null default 0 check (paid_cents >= 0),
  gifted_credit_cents   bigint not null default 0 check (gifted_credit_cents >= 0),
  notes                 text,
  status                text not null default 'pending' check (status in ('pending', 'active', 'cancelled')),
  user_id               uuid references auth.users(id) on delete set null,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  activated_at          timestamptz
);
alter table public.commercial_deals enable row level security;
create policy commercial_deals_staff on public.commercial_deals
  for select to authenticated using (private.is_staff());

create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  token_hash      text not null unique,        -- sha256(token) ; le jeton clair n'est jamais stocké
  kind            text not null default 'client' check (kind in ('client', 'organization')),
  email           text,
  deal_id         uuid references public.commercial_deals(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete cascade,
  org_role        text check (org_role in ('admin', 'editor', 'viewer')),
  credit_cents    bigint not null default 0 check (credit_cents >= 0),
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at      timestamptz not null,
  accepted_by     uuid references auth.users(id) on delete set null,
  accepted_at     timestamptz,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
alter table public.invitations enable row level security;
create policy invitations_staff on public.invitations
  for select to authenticated using (private.is_staff());

-- ── Audit (§47) — append-only ───────────────────────────────────────────
create table public.audit_logs (
  id             bigint generated always as identity primary key,
  actor_id       uuid,
  actor_role     text,
  action         text not null,
  entity         text not null,
  entity_id      text,
  before_data    jsonb,
  after_data     jsonb,
  reason         text,
  correlation_id uuid,
  created_at     timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function private.forbid_mutation();
alter table public.audit_logs enable row level security;
create policy audit_logs_staff on public.audit_logs
  for select to authenticated using (private.is_staff());

-- ── Suppression de compte (§31) ─────────────────────────────────────────
create table public.account_deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid,                      -- sans FK : la ligne survit à la suppression
  email_hash   text,
  status       text not null default 'requested' check (status in ('requested', 'completed', 'failed')),
  retained     jsonb not null default '{}'::jsonb,  -- ce qui est conservé et pourquoi
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.account_deletion_requests enable row level security;
create policy account_deletion_requests_staff on public.account_deletion_requests
  for select to authenticated using (private.is_staff());
