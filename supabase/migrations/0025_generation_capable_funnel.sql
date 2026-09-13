-- 0025_generation_capable_funnel.sql
--
-- Tunnel d'acquisition "VSL" (vsl.html) : candidature interactive en 5
-- questions qui débouche sur une prise de rendez-vous Calendly. Calendly
-- reste l'unique moteur de réservation (créneaux, confirmation, rappels
-- email/SMS, Google Meet) — ces tables ne font que conserver les réponses
-- de candidature et un journal d'événements pour le tracking, côté serveur.
--
-- ACCÈS : comme rate_limits (0024), ces tables ne sont accessibles qu'en
-- service_role, via les Netlify Functions submit-application.js et
-- track-funnel-event.js. Aucune policy anon/authenticated : le navigateur
-- n'écrit jamais directement dans Supabase depuis vsl.html.

create table if not exists public.gc_applications (
  id              uuid        primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  q1_situation    text,
  q2_acquisition  text[]      not null default '{}',
  q3_offre        text,
  q4_objectif     text[]      not null default '{}',
  q5_vision       text,
  video_completed boolean     not null default false,
  utm_source      text,
  utm_medium      text,
  utm_campaign    text,
  utm_content     text,
  utm_term        text,
  page_url        text,
  user_agent      text
);

create index if not exists gc_applications_created_at_idx on public.gc_applications (created_at desc);

alter table public.gc_applications enable row level security;
revoke all on public.gc_applications from anon, authenticated;

-- Journal d'événements du tunnel (visite, progression vidéo, étapes de la
-- candidature, affichage Calendly, réservation...). application_id est
-- l'identifiant généré côté navigateur dès le chargement de la page (avant
-- même que la candidature existe en base) : volontairement pas de contrainte
-- de clé étrangère, pour ne jamais perdre un événement arrivé avant l'écriture
-- de la candidature (ex: "page_view", "video_start").
create table if not exists public.gc_funnel_events (
  id             bigint      generated always as identity primary key,
  created_at     timestamptz not null default now(),
  application_id uuid        not null,
  event_name     text        not null,
  event_props    jsonb,
  utm_source     text,
  utm_medium     text,
  utm_campaign   text,
  utm_content    text,
  utm_term       text,
  page_url       text,
  user_agent     text
);

create index if not exists gc_funnel_events_application_id_idx on public.gc_funnel_events (application_id);
create index if not exists gc_funnel_events_created_at_idx on public.gc_funnel_events (created_at desc);
create index if not exists gc_funnel_events_event_name_idx on public.gc_funnel_events (event_name);

alter table public.gc_funnel_events enable row level security;
revoke all on public.gc_funnel_events from anon, authenticated;
