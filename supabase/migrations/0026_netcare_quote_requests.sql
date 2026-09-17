-- 0026_netcare_quote_requests.sql
--
-- Demandes de devis du site Net & Care (net-and-care/).
--
-- Le simulateur de devis envoie chaque demande à la Netlify Function
-- netcare-devis.js, qui (1) notifie Net & Care par email — chemin critique —
-- et (2) archive ici. Cette table sert au suivi commercial : savoir combien de
-- demandes arrivent, d'où, sur quelles prestations, et lesquelles ont été
-- rappelées. L'email peut se perdre dans une boîte de réception ; la base,
-- non.
--
-- ACCÈS : service_role uniquement, comme gc_applications (0025) et
-- rate_limits (0024). Aucune policy anon/authenticated — le navigateur
-- n'écrit jamais directement dans Supabase depuis le site Net & Care. Les
-- données sont nominatives (nom, téléphone, email, photos d'un domicile) :
-- toute ouverture d'accès doit être décidée explicitement, jamais héritée.

create table if not exists public.netcare_quote_requests (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  -- Référence affichée au prospect et reprise dans le message WhatsApp.
  -- Générée côté navigateur : c'est le seul identifiant commun entre l'écran
  -- du prospect, l'email reçu par Net & Care et cette ligne.
  reference         text        not null,

  prestation        text,
  prestation_label  text,
  detail            text,
  etat              text,
  options           text[]      not null default '{}',

  ville             text,
  hors_zone         boolean     not null default false,
  delai             text,

  -- Fourchette affichée au prospect au moment de l'envoi. Conservée telle
  -- quelle : c'est ce qu'il a vu, et donc ce à quoi il compare le devis final.
  estimation_basse  integer,
  estimation_haute  integer,

  nom               text        not null,
  telephone         text        not null,
  email             text,
  message           text,

  -- Chemins des photos dans le bucket netcare-photos (jamais des URL signées :
  -- elles expirent, le chemin non).
  photos            text[]      not null default '{}',

  page              text,
  source            text,

  -- Toutes les réponses brutes du formulaire, y compris les champs qui
  -- n'ont pas de colonne dédiée (dimensions, matière, type de bien...).
  -- Le jour où le simulateur gagne une question, rien n'est perdu en
  -- attendant la migration correspondante.
  reponses          jsonb       not null default '{}'::jsonb,

  -- Suivi commercial, renseigné à la main depuis Supabase.
  statut            text        not null default 'nouveau'
                    check (statut in ('nouveau', 'rappele', 'devis_envoye', 'gagne', 'perdu', 'spam')),
  note_interne      text,
  traite_at         timestamptz
);

-- Le tri par date est la seule lecture réellement fréquente (« les demandes
-- du jour »). Les deux autres index servent au pilotage : quelles villes et
-- quelles prestations génèrent des demandes (indicateurs du dossier projet).
create index if not exists netcare_quote_requests_created_at_idx
  on public.netcare_quote_requests (created_at desc);
create index if not exists netcare_quote_requests_statut_idx
  on public.netcare_quote_requests (statut, created_at desc);
create index if not exists netcare_quote_requests_ville_idx
  on public.netcare_quote_requests (ville);

alter table public.netcare_quote_requests enable row level security;
revoke all on public.netcare_quote_requests from anon, authenticated;

comment on table public.netcare_quote_requests is
  'Demandes de devis du site Net & Care. Écriture par netcare-devis.js en service_role uniquement.';

-- ---------------------------------------------------------------------------
-- Stockage des photos envoyées par les prospects.
--
-- Bucket PRIVÉ : il contient des photos de l'intérieur du domicile de
-- particuliers. Elles ne sont accessibles que par des URL signées à durée
-- limitée (30 jours), générées côté serveur et insérées dans l'email envoyé à
-- Net & Care. Aucune policy storage.objects n'est créée : sans policy, seule
-- la service_role accède au bucket, ce qui est exactement l'intention.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'netcare-photos',
  'netcare-photos',
  false,
  2097152,                                          -- 2 Mo : les photos sont compressées par le navigateur
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
