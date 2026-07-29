/**
 * Adaptation SQLite du schéma Supabase (voir
 * ../../supabase/migrations/0001_init.sql). Utilisée pour le
 * fonctionnement local en phase 1, sans provisionner d'infrastructure
 * cloud. Les mêmes interfaces (TaskStore, MemoryRepository,
 * PermissionStore, AuditSink) seront réimplémentées contre Supabase
 * Postgres sans changer le reste du système — voir
 * docs/gc-ai-os/08-stack-technique.md.
 */
export const SCHEMA_SQL = `
create table if not exists tasks (
  id text primary key,
  title text not null,
  description text not null default '',
  status text not null default 'received',
  assigned_agent_id text,
  parent_task_id text,
  risk_level text not null default 'low',
  created_at text not null,
  updated_at text not null,
  closed_at text
);

create table if not exists memory_entries (
  id text primary key,
  scope text not null,
  kind text not null default 'note',
  objective_id text,
  project_id text,
  agent_id text,
  title text not null,
  content text not null,
  embedding text not null,
  created_by text not null,
  created_at text not null,
  version integer not null default 1,
  superseded_by text
);

create index if not exists memory_entries_scope_idx on memory_entries (scope);

create table if not exists decisions (
  id text primary key,
  title text not null,
  context text not null,
  decision text not null,
  consequences text not null,
  scope text not null,
  related_task_id text,
  decided_by text not null,
  decided_at text not null
);

create table if not exists conversations (
  id text primary key,
  task_id text,
  agent_id text,
  role text not null,
  content text not null,
  created_at text not null
);

create table if not exists role_permissions (
  role_id text not null,
  capability text not null,
  allowed integer not null default 0,
  requires_human_validation integer not null default 0,
  primary key (role_id, capability)
);

create table if not exists audit_log (
  id text primary key,
  actor_agent_id text not null,
  capability text not null,
  params_hash text not null,
  risk_level text not null,
  decision text not null,
  task_id text,
  executed_at text not null
);

-- ---------------------------------------------------------------------
-- Moteur d'objectifs (voir docs/gc-ai-os/10-moteur-objectifs.md)
-- ---------------------------------------------------------------------

create table if not exists objectives (
  id text primary key,
  title text not null,
  statement text not null default '',
  horizon text not null default 'monthly',
  parent_objective_id text,
  status text not null default 'draft',
  budget_micros integer not null default 0,
  spent_micros integer not null default 0,
  created_at text not null,
  updated_at text not null,
  deadline text
);

create table if not exists key_results (
  id text primary key,
  objective_id text not null,
  metric text not null,
  unit text not null default '',
  baseline real not null default 0,
  target real not null default 0,
  current real not null default 0
);

create index if not exists key_results_objective_idx on key_results (objective_id);

create table if not exists missions (
  id text primary key,
  objective_id text not null,
  title text not null,
  brief text not null default '',
  domain text not null,
  required_skill text not null,
  status text not null default 'pending',
  depends_on text not null default '[]',
  attempt integer not null default 0,
  max_attempts integer not null default 2,
  assigned_agent_id text,
  risk_level text not null default 'low',
  acceptance_criteria text not null default '',
  created_at text not null,
  updated_at text not null
);

create index if not exists missions_objective_idx on missions (objective_id);

create table if not exists deliverables (
  id text primary key,
  mission_id text not null,
  objective_id text not null,
  filename text not null,
  media_type text not null default 'text/markdown',
  content text not null,
  bytes integer not null default 0,
  produced_by_agent_id text not null,
  created_at text not null
);

create index if not exists deliverables_objective_idx on deliverables (objective_id);

-- ---------------------------------------------------------------------
-- Télémétrie et arbitrages (voir 12-competences.md, 13-directeur-general.md)
-- ---------------------------------------------------------------------

create table if not exists agent_skills (
  agent_id text not null,
  skill text not null,
  level integer not null default 50,
  runs integer not null default 0,
  successes integer not null default 0,
  avg_duration_ms integer not null default 0,
  avg_cost_micros integer not null default 0,
  last_used_at text,
  primary key (agent_id, skill)
);

create table if not exists executive_decisions (
  id text primary key,
  objective_id text,
  mission_id text,
  kind text not null,
  rationale text not null default '',
  chosen_agent_id text,
  alternatives text not null default '[]',
  score real,
  decided_at text not null
);

create index if not exists executive_decisions_objective_idx on executive_decisions (objective_id);

-- ---------------------------------------------------------------------
-- GC AI Factory (voir 11-factory.md) — agents déclaratifs, pas de code
-- ---------------------------------------------------------------------

create table if not exists published_agents (
  agent_id text primary key,
  blueprint text not null,
  status text not null default 'candidate',
  version integer not null default 1,
  evaluation_score real,
  created_by text not null,
  created_at text not null
);
`;
