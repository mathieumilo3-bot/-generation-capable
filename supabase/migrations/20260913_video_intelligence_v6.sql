-- Video Intelligence OS V6
-- Evidence-first content intelligence storage.
-- All tables are RLS-protected; client apps use the Supabase publishable key.

create extension if not exists pgcrypto;

create table if not exists public.video_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null default 'Génération Capable — Video OS',
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.video_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete cascade,
  title text,
  source_filename text,
  storage_path text,
  duration_seconds numeric(10,3),
  width integer,
  height integer,
  fps numeric(8,3),
  status text not null default 'uploaded' check (status in ('uploaded','analyzing','analyzed','published','archived','error')),
  funnel_stage text check (funnel_stage in ('discovery','trust','desire','conversion','ecosystem')),
  goal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.video_analyses (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.video_items(id) on delete cascade,
  version integer not null default 1,
  source_type text not null default 'video_observation' check (source_type in ('video_observation','official_fact','benchmark_observation','user_metric','hypothesis')),
  hook_score numeric(5,2),
  clarity_score numeric(5,2),
  retention_score numeric(5,2),
  trust_score numeric(5,2),
  differentiation_score numeric(5,2),
  commercial_score numeric(5,2),
  overall_score numeric(5,2),
  confidence numeric(5,4),
  summary text,
  findings jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.video_timeline_events (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.video_items(id) on delete cascade,
  at_seconds numeric(10,3) not null,
  event_type text not null,
  label text not null,
  evidence_level text not null check (evidence_level in ('observed','measured','official','benchmark','hypothesis')),
  detail text,
  confidence numeric(5,4),
  created_at timestamptz not null default now()
);

create table if not exists public.video_metrics (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.video_items(id) on delete cascade,
  platform text not null,
  captured_at timestamptz not null default now(),
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  follows bigint,
  profile_visits bigint,
  clicks bigint,
  leads bigint,
  sales bigint,
  avg_view_duration_seconds numeric(10,3),
  avg_percentage_viewed numeric(6,3),
  retention_3s numeric(6,3),
  raw jsonb not null default '{}'::jsonb
);

create table if not exists public.video_experiments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.video_projects(id) on delete cascade,
  hypothesis text not null,
  variable text not null,
  control text,
  variant text,
  success_metric text not null,
  result jsonb not null default '{}'::jsonb,
  status text not null default 'planned' check (status in ('planned','running','complete','inconclusive')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.video_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.video_projects(id) on delete cascade,
  video_id uuid references public.video_items(id) on delete cascade,
  evidence_type text not null check (evidence_type in ('official','benchmark','user_data','observation','hypothesis')),
  source_name text,
  source_url text,
  claim text not null,
  confidence numeric(5,4),
  captured_at timestamptz not null default now()
);

create index if not exists video_items_project_idx on public.video_items(project_id, created_at desc);
create index if not exists video_analyses_video_idx on public.video_analyses(video_id, version desc);
create index if not exists video_metrics_video_idx on public.video_metrics(video_id, captured_at desc);
create index if not exists video_timeline_video_idx on public.video_timeline_events(video_id, at_seconds);

alter table public.video_projects enable row level security;
alter table public.video_items enable row level security;
alter table public.video_analyses enable row level security;
alter table public.video_timeline_events enable row level security;
alter table public.video_metrics enable row level security;
alter table public.video_experiments enable row level security;
alter table public.video_evidence enable row level security;

create policy "video_projects_owner" on public.video_projects for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "video_items_owner" on public.video_items for all to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "video_analyses_owner" on public.video_analyses for all to authenticated
using (exists (select 1 from public.video_items v where v.id = video_id and v.owner_id = (select auth.uid())))
with check (exists (select 1 from public.video_items v where v.id = video_id and v.owner_id = (select auth.uid())));

create policy "video_timeline_owner" on public.video_timeline_events for all to authenticated
using (exists (select 1 from public.video_items v where v.id = video_id and v.owner_id = (select auth.uid())))
with check (exists (select 1 from public.video_items v where v.id = video_id and v.owner_id = (select auth.uid())));

create policy "video_metrics_owner" on public.video_metrics for all to authenticated
using (exists (select 1 from public.video_items v where v.id = video_id and v.owner_id = (select auth.uid())))
with check (exists (select 1 from public.video_items v where v.id = video_id and v.owner_id = (select auth.uid())));

create policy "video_experiments_owner" on public.video_experiments for all to authenticated
using (exists (select 1 from public.video_projects p where p.id = project_id and p.owner_id = (select auth.uid())))
with check (exists (select 1 from public.video_projects p where p.id = project_id and p.owner_id = (select auth.uid())));

create policy "video_evidence_owner" on public.video_evidence for all to authenticated
using (project_id is null or exists (select 1 from public.video_projects p where p.id = project_id and p.owner_id = (select auth.uid())))
with check (project_id is null or exists (select 1 from public.video_projects p where p.id = project_id and p.owner_id = (select auth.uid())));
