-- Journal de consommation IA (suivi des coûts par entreprise).
-- Principe repris de video-editor/packages/cost-ledger : c'est de la
-- télémétrie, jamais un prérequis — un échec d'écriture ne bloque aucune analyse.
-- Aucune policy : lecture réservée à l'exploitant (clé service).

create table public.ai_usage (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  task text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  duration_ms int not null default 0,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index ai_usage_org_created_idx on public.ai_usage (organization_id, created_at desc);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
