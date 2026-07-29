-- GC AI OS — schéma initial (phase 1)
-- Reflète docs/gc-ai-os/04-memoire.md et docs/gc-ai-os/06-securite.md.
-- Toute évolution structurante de ce schéma doit être répercutée dans
-- ces documents d'architecture.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tâches (cycle de vie décrit dans 02-architecture-globale.md)
-- ---------------------------------------------------------------------

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  status text not null default 'received'
    check (status in ('received', 'qualified', 'planned', 'in_progress', 'awaiting_validation', 'completed', 'failed')),
  assigned_agent_id text,
  parent_task_id uuid references tasks (id),
  risk_level text not null default 'low'
    check (risk_level in ('low', 'medium', 'high', 'critical')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists tasks_parent_task_id_idx on tasks (parent_task_id);
create index if not exists tasks_status_idx on tasks (status);

-- ---------------------------------------------------------------------
-- Mémoire (04-memoire.md) — versionnée, jamais éditée en place
-- ---------------------------------------------------------------------

create table if not exists memory_entries (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('global', 'project', 'agent', 'technical', 'business')),
  project_id text,
  agent_id text,
  title text not null,
  content text not null,
  embedding vector(1536),
  created_by text not null,
  created_at timestamptz not null default now(),
  version int not null default 1,
  superseded_by uuid references memory_entries (id)
);

create index if not exists memory_entries_scope_idx on memory_entries (scope);
create index if not exists memory_entries_project_id_idx on memory_entries (project_id);
create index if not exists memory_entries_embedding_idx
  on memory_entries using ivfflat (embedding vector_cosine_ops);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  context text not null,
  decision text not null,
  consequences text not null,
  scope text not null check (scope in ('global', 'project', 'agent', 'technical', 'business')),
  related_task_id uuid references tasks (id),
  decided_by text not null,
  decided_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks (id),
  agent_id text,
  role text not null check (role in ('user', 'agent', 'orchestrator', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists conversations_task_id_idx on conversations (task_id);

-- ---------------------------------------------------------------------
-- Sécurité (06-securite.md) — RBAC deny-by-default + audit immuable
-- ---------------------------------------------------------------------

create table if not exists role_permissions (
  role_id text not null,
  capability text not null,
  allowed boolean not null default false,
  requires_human_validation boolean not null default false,
  primary key (role_id, capability)
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_agent_id text not null,
  capability text not null,
  params_hash text not null,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  decision text not null check (decision in ('allowed', 'denied', 'escalated')),
  task_id uuid references tasks (id),
  executed_at timestamptz not null default now()
);

create index if not exists audit_log_actor_agent_id_idx on audit_log (actor_agent_id);
create index if not exists audit_log_task_id_idx on audit_log (task_id);

-- audit_log est append-only : pas de politique update/delete définie ici,
-- et RLS devra explicitement refuser toute écriture hors du chemin
-- applicatif du service d'autorisation (voir packages/security).
alter table audit_log enable row level security;
alter table role_permissions enable row level security;
alter table memory_entries enable row level security;
alter table decisions enable row level security;
alter table conversations enable row level security;
alter table tasks enable row level security;

-- Aucune politique permissive n'est créée dans cette migration initiale :
-- tant qu'une politique RLS n'est pas explicitement ajoutée pour un rôle,
-- l'accès est refusé par défaut (cohérent avec le principe deny-by-default
-- du RBAC applicatif).
