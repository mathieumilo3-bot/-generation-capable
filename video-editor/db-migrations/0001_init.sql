-- Schéma cible de production (Supabase/Postgres). Non exécuté par le
-- MVP local (voir packages/db/src/schema.sql pour l'équivalent SQLite
-- utilisé en développement) — c'est la référence pour la migration
-- quand le produit passe en hébergé. Toute divergence entre ce fichier
-- et packages/db/src/schema.sql doit être résolue explicitement, jamais
-- laissée en silence (même règle que gc-ai-os, docs/gc-ai-os/README.md).

create extension if not exists vector;
create extension if not exists pgcrypto;

create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  status text not null default 'draft' check (status in ('draft','processing','ready','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table rushes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  original_filename text not null,
  storage_path text not null,
  container text not null,
  codec text not null,
  duration_sec double precision not null,
  has_audio boolean not null,
  proxy_path text,
  proxy_ready boolean not null default false,
  created_at timestamptz not null default now()
);

create table reference_videos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  storage_path text not null,
  duration_sec double precision not null,
  created_at timestamptz not null default now()
);

create table segments (
  id uuid primary key default gen_random_uuid(),
  rush_id uuid not null references rushes(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  start_sec double precision not null,
  end_sec double precision not null check (end_sec > start_sec),
  transcript text not null,
  energy double precision not null check (energy between 0 and 1),
  clarity double precision not null check (clarity between 0 and 1),
  relevance double precision not null check (relevance between 0 and 1),
  hook_potential double precision not null check (hook_potential between 0 and 1),
  visual_quality double precision not null check (visual_quality between 0 and 1),
  narrative_interest double precision not null check (narrative_interest between 0 and 1),
  created_at timestamptz not null default now()
);
create index on segments(project_id);

create table style_profiles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  source text not null check (source in ('preset','reference_videos')),
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table briefs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  raw_text text not null,
  spec jsonb,
  created_at timestamptz not null default now()
);

create table story_blueprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  version int not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create table edit_blueprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  story_blueprint_id uuid not null references story_blueprints(id),
  version int not null,
  style_profile_id uuid not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create table renders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  edit_blueprint_id uuid not null references edit_blueprints(id),
  edit_blueprint_version int not null,
  kind text not null check (kind in ('proxy','final')),
  status text not null default 'queued' check (status in ('queued','rendering','done','failed')),
  file_path text,
  duration_ms int,
  error text,
  created_at timestamptz not null default now()
);

create table qc_reports (
  id uuid primary key default gen_random_uuid(),
  render_id uuid not null references renders(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  scores jsonb not null,
  corrections jsonb not null default '[]',
  passed boolean not null,
  threshold double precision not null,
  human_score double precision,
  human_notes text,
  created_at timestamptz not null default now()
);

-- pgvector : recherche sémantique de médias (Agent 05) et de style
-- (Agent 10). Dimension 1024 par défaut (Voyage AI multimodal) — ajuster
-- à la dimension réelle du modèle d'embedding retenu en prod.
create table media_library (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('stock','generated','user')),
  project_id uuid references projects(id) on delete cascade,
  storage_path text not null,
  tags jsonb not null default '[]',
  embedding vector(1024),
  created_at timestamptz not null default now()
);
create index on media_library using ivfflat (embedding vector_cosine_ops);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage text not null,
  status text not null check (status in ('pending','running','completed','failed','skipped')),
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index on jobs(project_id);

create table feedback_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  render_id uuid,
  type text not null,
  command text,
  note text,
  created_at timestamptz not null default now()
);

create table cost_ledger (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  agent text not null,
  provider text not null,
  model text not null,
  stage text not null,
  call_type text not null,
  input_units double precision not null,
  input_unit_type text not null,
  output_units double precision not null,
  output_unit_type text not null,
  duration_ms int not null,
  cost_micro_usd bigint not null,
  is_stub boolean not null default false,
  created_at timestamptz not null default now()
);
create index on cost_ledger(project_id);

-- Row Level Security : chaque table liée à un projet doit être filtrée
-- par propriétaire avant tout accès depuis le client. Politique exacte
-- (auth.uid() = projects.user_id via jointure) à écrire au moment du
-- passage en prod — non activée ici pour ne pas bloquer le dev local sur
-- une base Postgres de test sans auth configurée.
