-- ════════════════════════════════════════════════════════════════════════
-- 0008 — Storage privé (buckets + policies) et Realtime
-- Convention de chemin : {user_id}/{project_id}/... dans CHAQUE bucket.
-- Aucun bucket public. Lecture = URL signée émise APRÈS vérification RLS.
-- Les écritures client sont limitées à `raw` et ne passent que si un asset
-- « pending » a été enregistré par register_asset (chemin choisi par le serveur).
-- ════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('raw',        'raw',        false, 2147483648, array['video/mp4','video/quicktime','video/x-m4v','video/webm','image/jpeg','image/png','image/webp','image/heic','audio/mp4','audio/m4a','audio/x-m4a','audio/mpeg','audio/wav','audio/webm']),
  ('processed',  'processed',  false, null, null),
  ('renders',    'renders',    false, null, array['video/mp4']),
  ('thumbnails', 'thumbnails', false, 10485760, array['image/jpeg','image/webp','image/png']),
  ('temporary',  'temporary',  false, null, null)
on conflict (id) do update set public = false;

-- Le chemin d'un objet référence-t-il un projet lisible par l'utilisateur ?
create or replace function private.can_read_object(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.try_uuid((storage.foldername(p_name))[2]) is not null
     and private.can_read_project(private.try_uuid((storage.foldername(p_name))[2]));
$$;

create policy storage_raw_insert on storage.objects
  for insert to authenticated with check (
    bucket_id = 'raw'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.assets a
                where a.bucket = 'raw' and a.path = name and a.owner_user_id = (select auth.uid()) and a.status = 'pending'));

create policy storage_read_by_project on storage.objects
  for select to authenticated using (
    bucket_id in ('raw', 'processed', 'renders', 'thumbnails') and private.can_read_object(name));

-- Pas de policy update/delete pour les clients : tout passe par le serveur (service_role).

-- Realtime : seules les tables dont l'app a besoin en direct (RLS appliquée par Realtime).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.video_jobs, public.notifications, public.wallets,
      public.projects, public.project_versions;
  end if;
end $$;
