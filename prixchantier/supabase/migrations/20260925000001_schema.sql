-- PrixChantier — schéma initial.
--
-- Règles structurantes :
--  * toute table contenant des données client porte organization_id ;
--  * les clés étrangères entre tables métier sont COMPOSITES
--    (id, organization_id) : une ligne ne peut jamais référencer une donnée
--    d'une autre organisation, même si la RLS était mal écrite ;
--  * organization_id vaut par défaut l'organisation de l'utilisateur connecté.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Organisations & utilisateurs
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  full_name text check (full_name is null or length(full_name) <= 200),
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);
create index users_organization_id_idx on public.users (organization_id);

-- Organisation de l'utilisateur courant. SECURITY DEFINER pour éviter la
-- récursion RLS sur public.users ; ne renvoie jamais que la ligne de auth.uid().
create function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organization_id from public.users where id = auth.uid()
$$;
revoke all on function public.current_org_id() from public, anon;
grant execute on function public.current_org_id() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Connexions boîtes mail (tokens chiffrés, jamais lisibles côté client)
-- ---------------------------------------------------------------------------

create table public.mail_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'microsoft', 'test')),
  email text not null,
  display_name text,
  status text not null default 'active' check (status in ('active', 'expired', 'error')),
  access_token_enc text,
  refresh_token_enc text,
  token_expires_at timestamptz,
  scopes text,
  last_polled_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, provider, email)
);

-- ---------------------------------------------------------------------------
-- Dossiers & documents
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  reference text check (reference is null or length(reference) <= 100),
  client text check (client is null or length(client) <= 200),
  response_deadline date,
  analysis_status text not null default 'idle'
    check (analysis_status in ('idle', 'pending', 'running', 'done', 'failed')),
  analysis_error text,
  analysis_summary jsonb,
  closed_at timestamptz,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create index projects_org_created_idx on public.projects (organization_id, created_at desc);

create table public.project_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id(),
  project_id uuid not null,
  kind text not null default 'other' check (kind in ('dpgf', 'cctp', 'other')),
  file_name text not null check (length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null check (size_bytes > 0),
  status text not null default 'uploaded'
    check (status in ('uploaded', 'processing', 'processed', 'failed', 'skipped')),
  error text,
  page_count int,
  text_chars int,
  used_ocr boolean not null default false,
  lines_count int,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade
);
create index project_documents_project_idx on public.project_documents (project_id);

create table public.project_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id(),
  project_id uuid not null,
  document_id uuid,
  source_document text,
  source_sheet text,
  source_row int,
  source_page int,
  position int not null default 0,
  lot text,
  code text,
  designation text not null check (length(btrim(designation)) > 0),
  description text,
  quantity numeric,
  unit text,
  category text,
  supplier_required boolean not null default true,
  subcontractor_required boolean not null default false,
  confidence numeric(3, 2) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  user_validated boolean not null default false,
  user_modified boolean not null default false,
  -- Valeurs brutes telles que lues dans le document. Jamais modifiées.
  original jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (document_id, organization_id) references public.project_documents (id, organization_id) on delete set null (document_id)
);
create index project_lines_project_idx on public.project_lines (project_id, position);

-- ---------------------------------------------------------------------------
-- Fournisseurs
-- ---------------------------------------------------------------------------

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id() references public.organizations (id) on delete cascade,
  company_name text not null check (length(btrim(company_name)) between 1 and 200),
  contact_name text check (contact_name is null or length(contact_name) <= 200),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  phone text check (phone is null or length(phone) <= 50),
  categories text[] not null default '{}',
  notes text check (notes is null or length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id)
);
create unique index suppliers_org_email_uidx on public.suppliers (organization_id, lower(email));

-- ---------------------------------------------------------------------------
-- Consultations
-- ---------------------------------------------------------------------------

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id(),
  project_id uuid not null,
  supplier_id uuid not null,
  mail_connection_id uuid,
  -- Référence courte présente dans l'objet du mail (ex : PC-7F3K2Q).
  reference_code text not null unique check (reference_code ~ '^PC-[A-Z0-9]{6}$'),
  status text not null default 'a_envoyer' check (status in (
    'a_envoyer', 'envoye', 'relance_prevue', 'relance', 'repondu',
    'reponse_partielle', 'refus', 'erreur', 'annulee'
  )),
  response_due_date date,
  subject text not null default '',
  body text not null default '',
  include_excel boolean not null default true,
  attached_document_ids uuid[] not null default '{}',
  auto_followup boolean not null default true,
  sent_at timestamptz,
  responded_at timestamptz,
  followup_count int not null default 0,
  last_followup_at timestamptz,
  provider_message_id text,
  provider_thread_id text,
  internet_message_id text,
  error text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (supplier_id, organization_id) references public.suppliers (id, organization_id) on delete restrict,
  foreign key (mail_connection_id, organization_id) references public.mail_connections (id, organization_id) on delete set null (mail_connection_id)
);
create index consultations_project_idx on public.consultations (project_id);
create index consultations_thread_idx on public.consultations (provider_thread_id) where provider_thread_id is not null;
create index consultations_status_idx on public.consultations (organization_id, status);

create table public.consultation_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id(),
  consultation_id uuid not null,
  project_line_id uuid not null,
  position int not null default 0,
  unique (consultation_id, project_line_id),
  foreign key (consultation_id, organization_id) references public.consultations (id, organization_id) on delete cascade,
  foreign key (project_line_id, organization_id) references public.project_lines (id, organization_id) on delete restrict
);
create index consultation_lines_line_idx on public.consultation_lines (project_line_id);

-- ---------------------------------------------------------------------------
-- E-mails & réponses
-- ---------------------------------------------------------------------------

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  mail_connection_id uuid,
  project_id uuid,
  consultation_id uuid,
  direction text not null check (direction in ('outbound', 'inbound')),
  kind text not null check (kind in ('consultation', 'followup', 'reply')),
  provider_message_id text not null,
  provider_thread_id text,
  internet_message_id text,
  in_reply_to text,
  references_header text,
  from_email text,
  from_name text,
  to_emails text[] not null default '{}',
  subject text,
  body_text text,
  attachments jsonb not null default '[]'::jsonb,
  message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (mail_connection_id, provider_message_id),
  foreign key (organization_id) references public.organizations (id) on delete cascade,
  foreign key (mail_connection_id, organization_id) references public.mail_connections (id, organization_id) on delete set null (mail_connection_id),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (consultation_id, organization_id) references public.consultations (id, organization_id) on delete cascade
);
create index email_messages_consultation_idx on public.email_messages (consultation_id, message_at);
create index email_messages_internet_id_idx on public.email_messages (internet_message_id);

create table public.supplier_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id(),
  project_id uuid,
  consultation_id uuid,
  supplier_id uuid,
  email_message_id uuid,
  source text not null check (source in ('email', 'manual')),
  match_method text check (match_method in ('thread', 'header', 'reference', 'sender', 'manual')),
  status text not null default 'pending' check (status in (
    'needs_assignment', 'pending', 'processing', 'processed', 'failed'
  )),
  classification text check (classification in ('offer', 'partial', 'refusal', 'other')),
  error text,
  files jsonb not null default '[]'::jsonb,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (organization_id) references public.organizations (id) on delete cascade,
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (consultation_id, organization_id) references public.consultations (id, organization_id) on delete cascade,
  foreign key (supplier_id, organization_id) references public.suppliers (id, organization_id) on delete set null (supplier_id),
  foreign key (email_message_id, organization_id) references public.email_messages (id, organization_id) on delete set null (email_message_id)
);
create index supplier_responses_consultation_idx on public.supplier_responses (consultation_id);
create index supplier_responses_status_idx on public.supplier_responses (organization_id, status);

-- ---------------------------------------------------------------------------
-- Offres extraites
-- ---------------------------------------------------------------------------

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id(),
  project_id uuid not null,
  consultation_id uuid not null,
  supplier_id uuid not null,
  supplier_response_id uuid,
  -- Seule l'offre la plus récente d'une consultation entre dans le comparatif.
  is_current boolean not null default true,
  quote_reference text,
  quote_date date,
  validity_date date,
  delivery_delay text,
  payment_terms text,
  delivery_cost numeric,
  delivery_included text not null default 'unknown' check (delivery_included in ('yes', 'no', 'unknown')),
  commissioning_included text not null default 'unknown' check (commissioning_included in ('yes', 'no', 'unknown', 'not_applicable')),
  total_ht numeric,
  currency text not null default 'EUR',
  exclusions text[] not null default '{}',
  reservations text[] not null default '{}',
  comments text,
  source_kind text check (source_kind in ('template', 'excel', 'pdf', 'pdf_ocr', 'csv', 'email_body', 'manual')),
  confidence numeric(3, 2),
  -- Détail brut de l'extraction (valeur / confiance / source par champ).
  extraction jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (consultation_id, organization_id) references public.consultations (id, organization_id) on delete cascade,
  foreign key (supplier_id, organization_id) references public.suppliers (id, organization_id) on delete cascade,
  foreign key (supplier_response_id, organization_id) references public.supplier_responses (id, organization_id) on delete set null (supplier_response_id)
);
create index offers_project_idx on public.offers (project_id) where is_current;
create unique index offers_one_current_per_consultation on public.offers (consultation_id) where is_current;

create table public.offer_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id(),
  offer_id uuid not null,
  project_line_id uuid,
  position int not null default 0,
  match_status text not null default 'unmatched' check (match_status in (
    'matched', 'to_verify', 'unmatched', 'user_confirmed', 'user_rejected'
  )),
  match_score numeric(3, 2),
  match_method text,
  supplier_reference text,
  supplier_designation text,
  quantity numeric,
  unit text,
  unit_price numeric,
  total_price numeric,
  discount text,
  availability text,
  delivery_delay text,
  is_alternative boolean not null default false,
  alternative_note text,
  is_fee boolean not null default false,
  confidence numeric(3, 2),
  source jsonb not null default '{}'::jsonb,
  original jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (offer_id, organization_id) references public.offers (id, organization_id) on delete cascade,
  foreign key (project_line_id, organization_id) references public.project_lines (id, organization_id) on delete set null (project_line_id)
);
create index offer_lines_offer_idx on public.offer_lines (offer_id, position);
create index offer_lines_project_line_idx on public.offer_lines (project_line_id);

-- ---------------------------------------------------------------------------
-- Journal, relances, file de tâches, rate limiting
-- ---------------------------------------------------------------------------

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_org_id(),
  project_id uuid,
  consultation_id uuid,
  type text not null,
  message text not null,
  created_at timestamptz not null default now(),
  foreign key (organization_id) references public.organizations (id) on delete cascade,
  foreign key (project_id, organization_id) references public.projects (id, organization_id) on delete cascade,
  foreign key (consultation_id, organization_id) references public.consultations (id, organization_id) on delete cascade
);
create index activity_logs_project_idx on public.activity_logs (project_id, created_at desc);

create table public.scheduled_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  consultation_id uuid not null,
  attempt int not null check (attempt between 1 and 5),
  due_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'cancelled', 'skipped', 'failed')),
  reason text,
  sent_at timestamptz,
  email_message_id uuid,
  created_at timestamptz not null default now(),
  unique (consultation_id, attempt),
  foreign key (organization_id) references public.organizations (id) on delete cascade,
  foreign key (consultation_id, organization_id) references public.consultations (id, organization_id) on delete cascade,
  foreign key (email_message_id, organization_id) references public.email_messages (id, organization_id) on delete set null (email_message_id)
);
create index scheduled_followups_due_idx on public.scheduled_followups (due_at) where status = 'scheduled';

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  dedupe_key text,
  attempts int not null default 0,
  max_attempts int not null default 3,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index jobs_ready_idx on public.jobs (run_after) where status = 'queued';
create unique index jobs_dedupe_active_uidx on public.jobs (dedupe_key)
  where dedupe_key is not null and status in ('queued', 'running');

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------------
-- updated_at automatique
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();
create trigger project_lines_touch before update on public.project_lines
  for each row execute function public.touch_updated_at();
create trigger suppliers_touch before update on public.suppliers
  for each row execute function public.touch_updated_at();
create trigger consultations_touch before update on public.consultations
  for each row execute function public.touch_updated_at();
create trigger mail_connections_touch before update on public.mail_connections
  for each row execute function public.touch_updated_at();
