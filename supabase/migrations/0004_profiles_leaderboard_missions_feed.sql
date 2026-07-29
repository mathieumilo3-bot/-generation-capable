-- ══════════════════════════════════════════════════════════════════════════
-- Génération Capable — V2 : profils publics, classement, missions, feed
-- ══════════════════════════════════════════════════════════════════════════
-- Ajoute le backend réel pour 4 des onglets qui n'étaient jusqu'ici que des
-- coquilles HTML statiques (audit 2026-07-29) : Profil, Classement,
-- Missions/Challenges, Feed communautaire.
--
-- Principe de conception : "subscribers" reste strictement privé (is_active/
-- stripe_customer_id ne doivent jamais être lisibles par un autre membre).
-- Les informations volontairement publiques-entre-membres (nom affiché,
-- avatar, objectifs) vivent dans une table séparée "profiles", lisible par
-- tout abonné actif mais jamais écrite directement (seule la fonction
-- update_my_profile() peut y écrire, comme le reste des écritures
-- sensibles de ce schéma qui passent par des fonctions dédiées plutôt que
-- par des policies insert/update ouvertes).

-- ──────────────────────────────────────────────────────────────────────────
-- 1. PROFILES — informations publiques entre membres (jamais de données
--    financières ni d'état d'abonnement ici)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_emoji text not null default '🙂',
  objectives   jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Tout abonné actif peut lire le profil de n'importe quel autre membre
-- (nécessaire pour afficher un nom sur le feed / le classement) — mais
-- seulement s'il est lui-même un abonné actif, comme pour "modules".
drop policy if exists profiles_select_active_subscribers on public.profiles;
create policy profiles_select_active_subscribers
  on public.profiles for select
  using (
    exists (select 1 from public.subscribers where subscribers.user_id = auth.uid() and subscribers.is_active = true)
  );

-- Aucune policy insert/update pour anon/authenticated : toute écriture passe
-- par update_my_profile() ci-dessous, qui restreint strictement les colonnes
-- modifiables et l'identité du modifieur (jamais is_active/stripe côté membre).

create or replace function public.update_my_profile(p_display_name text, p_avatar_emoji text, p_objectives jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;
  if p_display_name is not null and length(trim(p_display_name)) = 0 then
    p_display_name := null;
  end if;
  if p_display_name is not null and length(p_display_name) > 60 then
    raise exception 'Nom trop long (60 caractères max)';
  end if;
  if p_avatar_emoji is not null and length(p_avatar_emoji) > 8 then
    raise exception 'Avatar invalide';
  end if;

  insert into public.profiles (user_id, display_name, avatar_emoji, objectives, updated_at)
  values (auth.uid(), p_display_name, coalesce(p_avatar_emoji, '🙂'), coalesce(p_objectives, '{}'::jsonb), now())
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        avatar_emoji = excluded.avatar_emoji,
        objectives = excluded.objectives,
        updated_at = now();
end;
$$;

revoke all on function public.update_my_profile(text, text, jsonb) from public;
revoke all on function public.update_my_profile(text, text, jsonb) from anon;
grant execute on function public.update_my_profile(text, text, jsonb) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- 2. CLASSEMENT — calculé en direct depuis "sales" (jamais de table figée)
-- ──────────────────────────────────────────────────────────────────────────
-- plpgsql (pas "language sql") : nécessaire pour vérifier explicitement
-- l'identité de l'appelant avant de renvoyer les données d'autres membres.
-- Sans ce garde-fou, "revoke ... from public" ne suffit PAS à bloquer un
-- appel anonyme : Supabase accorde EXECUTE à anon par défaut sur toute
-- nouvelle fonction via les privilèges par défaut du schéma "public", donc
-- un simple "from public" ne retire pas ce droit explicite à "anon" — il
-- faut le révoquer nommément (voir plus bas) ET vérifier auth.uid() ici.
create or replace function public.get_leaderboard(p_limit integer default 20)
returns table(rank_pos bigint, user_id uuid, display_name text, avatar_emoji text, total_amount numeric, sales_count bigint)
language plpgsql
security definer
set search_path to 'public'
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;
  if not exists (select 1 from public.subscribers where subscribers.user_id = auth.uid() and subscribers.is_active = true) then
    raise exception 'Abonnement actif requis';
  end if;

  return query
    select
      row_number() over (order by sum(s.amount) desc) as rank_pos,
      s.seller_user_id as user_id,
      coalesce(p.display_name, 'Vendeur Génération Capable') as display_name,
      coalesce(p.avatar_emoji, '🙂') as avatar_emoji,
      sum(s.amount)::numeric / 100.0 as total_amount,
      count(*) as sales_count
    from public.sales s
    join public.subscribers sub on sub.user_id = s.seller_user_id and sub.is_active = true
    left join public.profiles p on p.user_id = s.seller_user_id
    where s.seller_user_id is not null and s.status = 'completed'
    group by s.seller_user_id, p.display_name, p.avatar_emoji
    order by sum(s.amount) desc
    limit greatest(least(coalesce(p_limit, 20), 100), 1);
end;
$$;

revoke all on function public.get_leaderboard(integer) from public;
revoke all on function public.get_leaderboard(integer) from anon;
grant execute on function public.get_leaderboard(integer) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- 3. MISSIONS — définitions figées, progression TOUJOURS calculée en direct
--    depuis "sales" (jamais de compteur dupliqué qui pourrait désynchroniser)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.missions (
  id           integer primary key,
  title        text not null,
  description  text not null,
  target_type  text not null check (target_type in ('sales_count_total','sales_count_month','revenue_total','revenue_month')),
  target_value numeric not null check (target_value > 0),
  reward_label text,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.missions enable row level security;
drop policy if exists missions_select_active_subscribers on public.missions;
create policy missions_select_active_subscribers
  on public.missions for select
  using (
    active = true
    and exists (select 1 from public.subscribers where subscribers.user_id = auth.uid() and subscribers.is_active = true)
  );

insert into public.missions (id, title, description, target_type, target_value, reward_label) values
  (1, 'Première vente', 'Réalise ta toute première vente sur la plateforme.', 'sales_count_total', 1, 'Badge Premier Closing'),
  (2, '3 ventes ce mois-ci', 'Réalise 3 ventes sur le mois en cours.', 'sales_count_month', 3, 'Badge Régularité'),
  (3, '500€ de chiffre d''affaires', 'Atteins 500€ de ventes cumulées.', 'revenue_total', 500, 'Badge Performeur'),
  (4, '2000€ de chiffre d''affaires', 'Atteins 2000€ de ventes cumulées.', 'revenue_total', 2000, 'Badge Expert')
on conflict (id) do update set
  title = excluded.title, description = excluded.description,
  target_type = excluded.target_type, target_value = excluded.target_value,
  reward_label = excluded.reward_label;

create or replace function public.get_my_missions()
returns table(id integer, title text, description text, target_type text, target_value numeric, reward_label text, progress numeric, completed boolean)
language plpgsql
security definer
set search_path to 'public'
stable
as $$
declare
  v_sales_count_total bigint;
  v_sales_count_month bigint;
  v_revenue_total numeric;
  v_revenue_month numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select count(*), coalesce(sum(amount),0)::numeric / 100.0
    into v_sales_count_total, v_revenue_total
    from public.sales where seller_user_id = auth.uid() and status = 'completed';

  select count(*), coalesce(sum(amount),0)::numeric / 100.0
    into v_sales_count_month, v_revenue_month
    from public.sales
    where seller_user_id = auth.uid() and status = 'completed'
      and created_at >= date_trunc('month', now());

  return query
    select
      m.id, m.title, m.description, m.target_type, m.target_value, m.reward_label,
      least(
        case m.target_type
          when 'sales_count_total' then v_sales_count_total
          when 'sales_count_month' then v_sales_count_month
          when 'revenue_total' then v_revenue_total
          when 'revenue_month' then v_revenue_month
        end, m.target_value
      ) as progress,
      (case m.target_type
        when 'sales_count_total' then v_sales_count_total >= m.target_value
        when 'sales_count_month' then v_sales_count_month >= m.target_value
        when 'revenue_total' then v_revenue_total >= m.target_value
        when 'revenue_month' then v_revenue_month >= m.target_value
      end) as completed
    from public.missions m
    where m.active = true
    order by m.target_value asc;
end;
$$;

revoke all on function public.get_my_missions() from public;
revoke all on function public.get_my_missions() from anon;
grant execute on function public.get_my_missions() to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- 4. FEED COMMUNAUTAIRE — posts / likes / commentaires, réservé aux abonnés
--    actifs (même garde-fou que "modules")
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.feed_posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.feed_posts enable row level security;
drop policy if exists feed_posts_select_active_subscribers on public.feed_posts;
create policy feed_posts_select_active_subscribers
  on public.feed_posts for select
  using (exists (select 1 from public.subscribers where subscribers.user_id = auth.uid() and subscribers.is_active = true));
drop policy if exists feed_posts_insert_own on public.feed_posts;
create policy feed_posts_insert_own
  on public.feed_posts for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.subscribers where subscribers.user_id = auth.uid() and subscribers.is_active = true)
  );
drop policy if exists feed_posts_delete_own on public.feed_posts;
create policy feed_posts_delete_own
  on public.feed_posts for delete
  using (auth.uid() = user_id);

create table if not exists public.feed_likes (
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.feed_likes enable row level security;
drop policy if exists feed_likes_select_active_subscribers on public.feed_likes;
create policy feed_likes_select_active_subscribers
  on public.feed_likes for select
  using (exists (select 1 from public.subscribers where subscribers.user_id = auth.uid() and subscribers.is_active = true));
drop policy if exists feed_likes_insert_own on public.feed_likes;
create policy feed_likes_insert_own
  on public.feed_likes for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.subscribers where subscribers.user_id = auth.uid() and subscribers.is_active = true)
  );
drop policy if exists feed_likes_delete_own on public.feed_likes;
create policy feed_likes_delete_own
  on public.feed_likes for delete
  using (auth.uid() = user_id);

create table if not exists public.feed_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.feed_posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

alter table public.feed_comments enable row level security;
drop policy if exists feed_comments_select_active_subscribers on public.feed_comments;
create policy feed_comments_select_active_subscribers
  on public.feed_comments for select
  using (exists (select 1 from public.subscribers where subscribers.user_id = auth.uid() and subscribers.is_active = true));
drop policy if exists feed_comments_insert_own on public.feed_comments;
create policy feed_comments_insert_own
  on public.feed_comments for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.subscribers where subscribers.user_id = auth.uid() and subscribers.is_active = true)
  );
drop policy if exists feed_comments_delete_own on public.feed_comments;
create policy feed_comments_delete_own
  on public.feed_comments for delete
  using (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────────────────
-- 5. DURCISSEMENT (trouvé pendant ce travail, hors périmètre initial) —
--    is_current_user_admin()/admin_cancel_commission()/
--    admin_mark_commission_paid() s'auto-protègent déjà (elles vérifient
--    auth.jwt()->>'email' contre "admins" et lèvent une exception sinon),
--    mais restaient exécutables par le rôle "anon" (EXECUTE accordé par
--    défaut par Supabase à toute nouvelle fonction). Retirer explicitement
--    cet accès ferme le lint de sécurité sans changer leur comportement.
-- ──────────────────────────────────────────────────────────────────────────
revoke all on function public.is_current_user_admin() from anon;
revoke all on function public.admin_cancel_commission(uuid, text) from anon;
revoke all on function public.admin_mark_commission_paid(uuid) from anon;


-- ──────────────────────────────────────────────────────────────────────────
-- Vérification rapide après exécution :
--   select tablename, rowsecurity from pg_tables
--   where schemaname='public' and tablename in
--   ('profiles','missions','feed_posts','feed_likes','feed_comments');
-- ──────────────────────────────────────────────────────────────────────────
