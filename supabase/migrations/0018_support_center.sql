-- 0015_support_center.sql
--
-- Remplace le fil "Communauté" (posts/likes/commentaires entre vendeurs —
-- table "feed_posts" etc., migration 0004) par un vrai Centre de Support :
-- les vendeurs/ambassadeurs ne discutent plus jamais entre eux, ils envoient
-- des tickets (bug, question, demande, suggestion, problème) qui n'arrivent
-- que dans l'espace administrateur (le nouveau site admin dissocié). Les
-- tables "feed_*" ne sont PAS supprimées ici par prudence (ce sont des
-- données existantes, une suppression de table est irréversible) — elles
-- restent en base, inutilisées, le front-end ne les affiche plus.

create table if not exists public.support_tickets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  category     text not null check (category in ('bug','question','demande','suggestion','probleme')),
  priority     text not null default 'normale' check (priority in ('basse','normale','haute','urgente')),
  subject      text not null check (char_length(subject) between 1 and 200),
  message      text not null check (char_length(message) between 1 and 4000),
  status       text not null default 'nouveau' check (status in ('nouveau','en_cours','resolu','ferme')),
  attachment_path text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists support_tickets_user_id_idx on public.support_tickets(user_id);
create index if not exists support_tickets_status_idx on public.support_tickets(status);

-- Historique : chaque changement de statut et chaque message (vendeur ou
-- admin) après la création du ticket. La création elle-même n'a pas besoin
-- de ligne ici : subject/message/category/priority sont déjà sur le ticket.
create table if not exists public.support_ticket_events (
  id           uuid primary key default gen_random_uuid(),
  ticket_id    uuid not null references public.support_tickets(id) on delete cascade,
  author       text not null check (author in ('user','admin')),
  author_email text,
  note         text check (note is null or char_length(note) <= 4000),
  new_status   text check (new_status is null or new_status in ('nouveau','en_cours','resolu','ferme')),
  attachment_path text,
  created_at   timestamptz not null default now()
);

create index if not exists support_ticket_events_ticket_id_idx on public.support_ticket_events(ticket_id);

alter table public.support_tickets enable row level security;
alter table public.support_ticket_events enable row level security;

-- Un vendeur voit / crée uniquement ses propres tickets ; l'admin voit tout.
-- Aucune policy update/delete pour authenticated : tout changement de statut
-- ou réponse passe par les RPC SECURITY DEFINER ci-dessous (validation,
-- traçabilité, et pour l'admin : vérification is_current_user_admin()).
drop policy if exists support_tickets_select on public.support_tickets;
create policy support_tickets_select on public.support_tickets
  for select using (auth.uid() = user_id or is_current_user_admin());

drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
  for insert with check (auth.uid() = user_id);

drop policy if exists support_ticket_events_select on public.support_ticket_events;
create policy support_ticket_events_select on public.support_ticket_events
  for select using (
    is_current_user_admin()
    or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid())
  );

-- Bucket de stockage pour les captures d'écran / pièces jointes. Privé
-- (public=false) : accès exclusivement via URL signée générée après
-- vérification RLS/policy ci-dessous, jamais d'URL publique directe.
insert into storage.buckets (id, name, public)
values ('support-attachments', 'support-attachments', false)
on conflict (id) do nothing;

-- Chemin attendu : "<user_id>/<uuid>-<nom_fichier>" — le premier segment du
-- chemin doit être l'UID de l'auteur, ce qui borne l'upload à son propre
-- dossier sans jamais faire confiance à un champ "user_id" fourni par le
-- client.
drop policy if exists support_attachments_insert on storage.objects;
create policy support_attachments_insert on storage.objects
  for insert with check (
    bucket_id = 'support-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists support_attachments_select on storage.objects;
create policy support_attachments_select on storage.objects
  for select using (
    bucket_id = 'support-attachments'
    and ((storage.foldername(name))[1] = auth.uid()::text or is_current_user_admin())
  );

-- ── RPC vendeur ──

create or replace function public.create_support_ticket(
  p_category text, p_priority text, p_subject text, p_message text, p_attachment_path text default null
)
returns uuid
language plpgsql security definer set search_path = 'public'
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  -- Si le chemin de pièce jointe est fourni, il doit appartenir à l'auteur
  -- (même contrainte que la policy de stockage) — évite qu'un ticket
  -- référence le fichier de quelqu'un d'autre.
  if p_attachment_path is not null and split_part(p_attachment_path, '/', 1) <> auth.uid()::text then
    raise exception 'Pièce jointe invalide';
  end if;

  insert into public.support_tickets (user_id, category, priority, subject, message, attachment_path)
  values (auth.uid(), p_category, coalesce(p_priority, 'normale'), p_subject, p_message, p_attachment_path)
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.create_support_ticket(text, text, text, text, text) from public;
revoke all on function public.create_support_ticket(text, text, text, text, text) from anon;
grant execute on function public.create_support_ticket(text, text, text, text, text) to authenticated;

create or replace function public.add_support_ticket_message(
  p_ticket_id uuid, p_message text, p_attachment_path text default null
)
returns void
language plpgsql security definer set search_path = 'public'
as $$
declare
  v_owner uuid;
  v_email text;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select user_id into v_owner from public.support_tickets where id = p_ticket_id;
  if v_owner is null or v_owner <> auth.uid() then raise exception 'Ticket introuvable'; end if;
  if p_attachment_path is not null and split_part(p_attachment_path, '/', 1) <> auth.uid()::text then
    raise exception 'Pièce jointe invalide';
  end if;

  v_email := auth.jwt()->>'email';
  insert into public.support_ticket_events (ticket_id, author, author_email, note, attachment_path)
  values (p_ticket_id, 'user', v_email, p_message, p_attachment_path);

  update public.support_tickets set updated_at = now() where id = p_ticket_id;
end;
$$;
revoke all on function public.add_support_ticket_message(uuid, text, text) from public;
revoke all on function public.add_support_ticket_message(uuid, text, text) from anon;
grant execute on function public.add_support_ticket_message(uuid, text, text) to authenticated;

create or replace function public.get_my_support_tickets()
returns setof public.support_tickets
language sql security definer set search_path = 'public'
as $$
  select * from public.support_tickets where user_id = auth.uid() order by created_at desc;
$$;
revoke all on function public.get_my_support_tickets() from public;
revoke all on function public.get_my_support_tickets() from anon;
grant execute on function public.get_my_support_tickets() to authenticated;

create or replace function public.get_my_support_ticket_events(p_ticket_id uuid)
returns setof public.support_ticket_events
language plpgsql security definer set search_path = 'public'
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.support_tickets where id = p_ticket_id;
  if v_owner is null or (v_owner <> auth.uid() and not is_current_user_admin()) then
    raise exception 'Ticket introuvable';
  end if;
  return query select * from public.support_ticket_events where ticket_id = p_ticket_id order by created_at asc;
end;
$$;
revoke all on function public.get_my_support_ticket_events(uuid) from public;
revoke all on function public.get_my_support_ticket_events(uuid) from anon;
grant execute on function public.get_my_support_ticket_events(uuid) to authenticated;

-- ── RPC admin (espace admin dissocié uniquement) ──

create or replace function public.admin_list_support_tickets(p_status text default null)
returns table(
  id uuid, user_id uuid, user_email text, category text, priority text,
  subject text, message text, status text, attachment_path text,
  created_at timestamptz, updated_at timestamptz
)
language plpgsql security definer set search_path = 'public'
as $$
begin
  if not is_current_user_admin() then raise exception 'Réservé aux administrateurs'; end if;
  return query
    select t.id, t.user_id, u.email::text, t.category, t.priority, t.subject, t.message,
           t.status, t.attachment_path, t.created_at, t.updated_at
    from public.support_tickets t
    join auth.users u on u.id = t.user_id
    where p_status is null or t.status = p_status
    order by
      case t.priority when 'urgente' then 0 when 'haute' then 1 when 'normale' then 2 else 3 end,
      t.created_at desc;
end;
$$;
revoke all on function public.admin_list_support_tickets(text) from public;
revoke all on function public.admin_list_support_tickets(text) from anon;
grant execute on function public.admin_list_support_tickets(text) to authenticated;

create or replace function public.admin_update_ticket_status(p_ticket_id uuid, p_new_status text, p_note text default null)
returns void
language plpgsql security definer set search_path = 'public'
as $$
declare
  v_email text;
begin
  if not is_current_user_admin() then raise exception 'Réservé aux administrateurs'; end if;
  if p_new_status not in ('nouveau','en_cours','resolu','ferme') then raise exception 'Statut invalide'; end if;

  v_email := auth.jwt()->>'email';
  update public.support_tickets set status = p_new_status, updated_at = now() where id = p_ticket_id;
  insert into public.support_ticket_events (ticket_id, author, author_email, note, new_status)
  values (p_ticket_id, 'admin', v_email, p_note, p_new_status);
end;
$$;
revoke all on function public.admin_update_ticket_status(uuid, text, text) from public;
revoke all on function public.admin_update_ticket_status(uuid, text, text) from anon;
grant execute on function public.admin_update_ticket_status(uuid, text, text) to authenticated;

create or replace function public.admin_reply_to_ticket(p_ticket_id uuid, p_message text)
returns void
language plpgsql security definer set search_path = 'public'
as $$
declare
  v_email text;
begin
  if not is_current_user_admin() then raise exception 'Réservé aux administrateurs'; end if;
  v_email := auth.jwt()->>'email';
  insert into public.support_ticket_events (ticket_id, author, author_email, note)
  values (p_ticket_id, 'admin', v_email, p_message);
  update public.support_tickets set updated_at = now() where id = p_ticket_id;
end;
$$;
revoke all on function public.admin_reply_to_ticket(uuid, text) from public;
revoke all on function public.admin_reply_to_ticket(uuid, text) from anon;
grant execute on function public.admin_reply_to_ticket(uuid, text) to authenticated;
