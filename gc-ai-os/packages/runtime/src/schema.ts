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
`;
