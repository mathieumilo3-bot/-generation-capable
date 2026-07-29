-- GC AI OS — étage objectifs et exécutif
--
-- Rattrape l'écart relevé par l'audit du 29/07/2026 : la migration
-- initiale portait 6 tables quand le schéma réel en compte 15. Migrer
-- vers Supabase sans celle-ci perdrait tout le moteur d'objectifs et
-- tout l'étage exécutif.
--
-- Voir docs/gc-ai-os/10-moteur-objectifs.md, 12-competences.md,
-- 13-directeur-general.md, 14-executive-brain.md, 15-human-brain.md.

-- ---------------------------------------------------------------------
-- Moteur d'objectifs
-- ---------------------------------------------------------------------

create table if not exists objectives (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  statement text not null default '',
  horizon text not null default 'monthly'
    check (horizon in ('annual', 'quarterly', 'monthly', 'weekly', 'daily')),
  parent_objective_id uuid references objectives (id),
  status text not null default 'draft'
    check (status in ('draft', 'planning', 'executing', 'awaiting_validation', 'achieved', 'halted', 'failed')),
  budget_micros bigint not null default 0,
  spent_micros bigint not null default 0 check (spent_micros >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deadline timestamptz
);

create index if not exists objectives_status_idx on objectives (status);

create table if not exists key_results (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references objectives (id) on delete cascade,
  metric text not null,
  unit text not null default '',
  baseline double precision not null default 0,
  target double precision not null default 0,
  current double precision not null default 0
);

create index if not exists key_results_objective_idx on key_results (objective_id);

create table if not exists missions (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references objectives (id) on delete cascade,
  title text not null,
  brief text not null default '',
  domain text not null,
  required_skill text not null,
  status text not null default 'pending'
    check (status in ('pending', 'blocked', 'in_progress', 'self_correcting', 'awaiting_validation', 'completed', 'failed')),
  depends_on jsonb not null default '[]'::jsonb,
  attempt int not null default 0,
  max_attempts int not null default 2,
  assigned_agent_id text,
  risk_level text not null default 'low'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  acceptance_criteria text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists missions_objective_idx on missions (objective_id);
create index if not exists missions_status_idx on missions (status);

create table if not exists deliverables (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references missions (id) on delete cascade,
  objective_id uuid not null references objectives (id) on delete cascade,
  filename text not null,
  media_type text not null default 'text/markdown',
  content text not null,
  bytes int not null default 0,
  produced_by_agent_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists deliverables_objective_idx on deliverables (objective_id);

-- ---------------------------------------------------------------------
-- Télémétrie et arbitrages
-- ---------------------------------------------------------------------

create table if not exists agent_skills (
  agent_id text not null,
  skill text not null,
  level int not null default 50 check (level between 0 and 100),
  runs int not null default 0,
  successes int not null default 0 check (successes <= runs),
  avg_duration_ms int not null default 0,
  avg_cost_micros int not null default 0,
  last_used_at timestamptz,
  primary key (agent_id, skill)
);

create table if not exists executive_decisions (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid references objectives (id) on delete cascade,
  mission_id uuid references missions (id) on delete cascade,
  kind text not null
    check (kind in ('agent_selection', 'budget_halt', 'escalation', 'retry', 'abandon')),
  rationale text not null default '',
  chosen_agent_id text,
  alternatives jsonb not null default '[]'::jsonb,
  score double precision,
  decided_at timestamptz not null default now()
);

create index if not exists executive_decisions_objective_idx on executive_decisions (objective_id);

-- ---------------------------------------------------------------------
-- Étage exécutif : métriques
-- ---------------------------------------------------------------------

create table if not exists metric_readings (
  metric_id text primary key,
  -- NULL = non mesuré. C'est un état de premier ordre : ne jamais
  -- remplacer par 0 (voir 14-executive-brain.md).
  value double precision,
  source text not null default 'unmeasured'
    check (source in ('stripe', 'supabase', 'github', 'social', 'manual', 'derived', 'unmeasured')),
  measured_at timestamptz
);

-- ---------------------------------------------------------------------
-- GC AI Factory
-- ---------------------------------------------------------------------

create table if not exists published_agents (
  agent_id text primary key,
  blueprint jsonb not null,
  status text not null default 'candidate'
    check (status in ('candidate', 'published', 'revoked')),
  version int not null default 1,
  evaluation_score double precision,
  created_by text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Direction humaine — données personnelles (voir 15-human-brain.md)
-- ---------------------------------------------------------------------

create table if not exists people (
  id text primary key,
  display_name text not null,
  role text not null check (role in ('ambassador', 'seller', 'director', 'staff')),
  status text not null default 'active'
    check (status in ('active', 'at_risk', 'inactive', 'left')),
  joined_at timestamptz not null default now(),
  -- Préférences OBSERVÉES uniquement. Aucun trait de caractère inféré
  -- n'est stocké ici, et ce n'est pas un oubli : voir 15-human-brain.md.
  channel text not null default 'unknown'
    check (channel in ('email', 'sms', 'voice', 'chat', 'unknown')),
  window_pref text not null default 'unknown'
    check (window_pref in ('morning', 'afternoon', 'evening', 'unknown')),
  prefers_short boolean not null default false,
  locale text not null default 'fr',
  activity_count int not null default 0,
  days_since_last_activity int,
  revenue_generated double precision not null default 0,
  conversion_rate double precision,
  -- Sans consentement, aucune relance personnalisée n'est produite.
  consents_personalisation boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists people_role_idx on people (role);

-- ---------------------------------------------------------------------
-- RLS — deny-by-default, avec un accès service explicite
-- ---------------------------------------------------------------------

alter table objectives enable row level security;
alter table key_results enable row level security;
alter table missions enable row level security;
alter table deliverables enable row level security;
alter table agent_skills enable row level security;
alter table executive_decisions enable row level security;
alter table metric_readings enable row level security;
alter table published_agents enable row level security;
alter table people enable row level security;

-- La migration 0001 activait RLS sans créer la moindre politique, ce qui
-- rendait la base inutilisable — également relevé par l'audit.
--
-- Politique retenue : le rôle `service_role` (backend GC AI OS, jamais
-- exposé au navigateur) a un accès complet ; aucun accès anonyme ou
-- authentifié n'est accordé par défaut. Les agents n'atteignent jamais
-- la base directement — ils passent par l'API, qui applique le RBAC
-- applicatif (voir 06-securite.md).
do $$
declare
  t text;
begin
  foreach t in array array[
    'objectives', 'key_results', 'missions', 'deliverables', 'agent_skills',
    'executive_decisions', 'metric_readings', 'published_agents', 'people',
    'tasks', 'memory_entries', 'decisions', 'conversations', 'role_permissions'
  ]
  loop
    execute format(
      'create policy %I on %I for all to service_role using (true) with check (true)',
      'service_role_all_' || t, t
    );
  end loop;
end $$;

-- `audit_log` est traité à part : append-only. Le service peut insérer
-- et lire, jamais modifier ni supprimer — une trace d'audit modifiable
-- ne vaut rien.
alter table audit_log enable row level security;
create policy audit_log_service_insert on audit_log for insert to service_role with check (true);
create policy audit_log_service_select on audit_log for select to service_role using (true);
