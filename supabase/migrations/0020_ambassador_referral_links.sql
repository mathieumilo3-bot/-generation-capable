-- 0020_ambassador_referral_links.sql
--
-- Système de liens de parrainage ambassadeurs, de bout en bout.
--
-- CONSTAT AVANT CETTE MIGRATION
--   La colonne subscribers.referred_by_ambassador_id existait depuis 0003
--   mais AUCUN code ne l'écrivait jamais : aucune vente n'était donc
--   attribuée à un ambassadeur. En parallèle, ambassadors.state (jsonb)
--   contenait un faux bloc "revenue" et un code "GC-AMB###" tiré au hasard,
--   sans aucun lien avec la réalité des paiements Stripe.
--
-- CE QUE POSE CETTE MIGRATION
--   1. Un slug unique par ambassadeur  → generationcapable.fr/<slug>
--   2. referral_clicks : chaque clic sur un lien de parrainage
--   3. ambassador_earnings : le registre des gains, avec des index uniques
--      qui rendent tout double-comptage IMPOSSIBLE au niveau du moteur SQL
--      (et pas seulement au niveau applicatif).
--
-- MODÈLE DE RÉMUNÉRATION (source : brief ambassadeurs, ne pas approximer)
--   • 15 €/mois par abonné apporté, tant que cet abonné reste actif.
--   • 50 € par vente réalisée par un vendeur que l'ambassadeur a apporté.
--   Les deux découlent de la MÊME attribution
--   (subscribers.referred_by_ambassador_id) : un seul maillon à sécuriser.

-- ---------------------------------------------------------------------------
-- 1. Identité publique de l'ambassadeur : le slug de son lien
-- ---------------------------------------------------------------------------

alter table public.ambassadors
  add column if not exists slug        text,
  add column if not exists first_name  text,
  add column if not exists last_name   text;

-- Format volontairement strict : ce slug devient un chemin d'URL public.
-- Minuscules, chiffres et tirets ; 2 à 40 caractères ; ni tiret initial ni
-- tiret final. Empêche toute collision avec un fichier réel du site et tout
-- caractère nécessitant un encodage.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.ambassadors'::regclass
      and conname  = 'ambassadors_slug_format'
  ) then
    alter table public.ambassadors
      add constraint ambassadors_slug_format
      check (slug is null or slug ~ '^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$');
  end if;
end $$;

create unique index if not exists ambassadors_slug_uk
  on public.ambassadors (slug)
  where slug is not null;

-- ---------------------------------------------------------------------------
-- 2. Slugs réservés — ne doivent jamais être attribués à un ambassadeur
-- ---------------------------------------------------------------------------
-- Un ambassadeur qui obtiendrait le slug "admin" ou "index" masquerait une
-- vraie route du site. La liste est en table (et non en dur dans le code)
-- pour pouvoir être complétée sans redéploiement.

create table if not exists public.reserved_slugs (
  slug text primary key
);

insert into public.reserved_slugs (slug) values
  ('index'), ('admin'), ('administration'), ('ambassadors'), ('ambassadeur'),
  ('ambassadeurs'), ('api'), ('app'), ('assets'), ('static'), ('public'),
  ('netlify'), ('sw'), ('manifest'), ('favicon'), ('robots'), ('sitemap'),
  ('docs'), ('doc'), ('login'), ('logout'), ('signup'), ('signin'),
  ('account'), ('compte'), ('dashboard'), ('checkout'), ('paiement'),
  ('payment'), ('stripe'), ('support'), ('aide'), ('help'), ('contact'),
  ('cgv'), ('cgu'), ('mentions-legales'), ('confidentialite'), ('privacy'),
  ('r'), ('ref'), ('parrainage'), ('gc'), ('generation-capable'),
  ('unsubscribe'), ('desabonnement'), ('test'), ('www')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Génération automatique d'un slug à partir du nom
-- ---------------------------------------------------------------------------

create or replace function public.slugify(p_input text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select nullif(
    trim(both '-' from
      regexp_replace(
        regexp_replace(
          lower(
            translate(
              coalesce(p_input, ''),
              'àáâãäåÀÁÂÃÄÅèéêëÈÉÊËìíîïÌÍÎÏòóôõöÒÓÔÕÖùúûüÙÚÛÜçÇñÑÿŸ',
              'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnNyY'
            )
          ),
          '[^a-z0-9]+', '-', 'g'      -- tout le reste devient un tiret
        ),
        '-{2,}', '-', 'g'             -- pas de tirets consécutifs
      )
    ),
    ''
  );
$$;

-- Renvoie un slug libre dérivé de p_base : "dupont", puis "dupont-2",
-- "dupont-3"… si déjà pris ou réservé. p_exclude_id permet de régénérer le
-- slug d'un ambassadeur sans que son propre slug actuel compte comme pris.
create or replace function public.generate_ambassador_slug(
  p_base       text,
  p_exclude_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_base      text;
  v_candidate text;
  v_n         integer := 1;
begin
  v_base := public.slugify(p_base);

  -- Nom vide ou entièrement non-latin : on retombe sur un identifiant neutre.
  if v_base is null or length(v_base) < 2 then
    v_base := 'amb-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
  end if;

  -- Le format autorise 40 caractères ; on garde de la marge pour le suffixe.
  v_base := left(v_base, 32);
  v_base := trim(both '-' from v_base);

  v_candidate := v_base;

  loop
    exit when not exists (
      select 1 from public.ambassadors
      where slug = v_candidate
        and (p_exclude_id is null or id <> p_exclude_id)
    ) and not exists (
      select 1 from public.reserved_slugs where slug = v_candidate
    );

    v_n := v_n + 1;
    v_candidate := v_base || '-' || v_n;

    -- Garde-fou : ne jamais boucler indéfiniment.
    if v_n > 500 then
      v_candidate := 'amb-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
      exit;
    end if;
  end loop;

  return v_candidate;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Clics sur les liens de parrainage
-- ---------------------------------------------------------------------------
-- On ne stocke JAMAIS l'IP brute : seulement un hachage tronqué, suffisant
-- pour distinguer des visiteurs sur 24h sans constituer une donnée
-- personnelle directement identifiante.

create table if not exists public.referral_clicks (
  id            uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassadors(id) on delete cascade,
  slug          text not null,
  occurred_at   timestamptz not null default now(),
  visitor_hash  text,
  referrer      text,
  user_agent    text
);

create index if not exists referral_clicks_ambassador_idx
  on public.referral_clicks (ambassador_id, occurred_at desc);

create index if not exists referral_clicks_visitor_idx
  on public.referral_clicks (ambassador_id, visitor_hash, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 5. Registre des gains ambassadeurs
-- ---------------------------------------------------------------------------

create table if not exists public.ambassador_earnings (
  id                 uuid primary key default gen_random_uuid(),
  ambassador_id      uuid not null references public.ambassadors(id) on delete cascade,
  kind               text not null check (kind in ('subscription_month', 'seller_sale')),
  amount_cents       integer not null check (amount_cents > 0),
  subscriber_user_id uuid,
  order_id           uuid references public.orders(id) on delete set null,
  period_month       date,
  status             text not null default 'pending'
                       check (status in ('pending', 'available', 'paid', 'cancelled')),
  note               text,
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);

-- ⚠️ Cœur de la garantie "aucun double comptage".
-- Ces deux index uniques partiels rendent physiquement impossible :
--   • de créditer deux fois le même mois pour le même abonné apporté ;
--   • de créditer deux fois la même commande.
-- Même si un cron repasse, si un webhook Stripe est rejoué, ou si deux
-- exécutions tournent en parallèle, la seconde insertion est rejetée par
-- PostgreSQL. Les fonctions ci-dessous s'appuient dessus via ON CONFLICT.
create unique index if not exists ambassador_earnings_sub_month_uk
  on public.ambassador_earnings (ambassador_id, subscriber_user_id, period_month)
  where kind = 'subscription_month';

create unique index if not exists ambassador_earnings_order_uk
  on public.ambassador_earnings (order_id)
  where kind = 'seller_sale';

create index if not exists ambassador_earnings_ambassador_idx
  on public.ambassador_earnings (ambassador_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 6. RLS — tout passe par les fonctions Netlify en service_role
-- ---------------------------------------------------------------------------
-- Même logique que la table "ambassadors" (voir 0017) : aucun accès direct
-- depuis le navigateur avec la clé publique, sinon n'importe qui pourrait
-- lire les gains de n'importe quel ambassadeur.

alter table public.referral_clicks      enable row level security;
alter table public.ambassador_earnings  enable row level security;
alter table public.reserved_slugs       enable row level security;

revoke all on public.referral_clicks     from anon, authenticated;
revoke all on public.ambassador_earnings from anon, authenticated;
revoke all on public.reserved_slugs      from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Crédit des 50 € sur vente d'un vendeur apporté
-- ---------------------------------------------------------------------------
-- Déclenché par la base elle-même à chaque passage d'une commande au statut
-- "paid" — donc quel que soit le chemin emprunté (webhook Stripe, validation
-- manuelle en admin, import). Un crédit posé au seul niveau du webhook aurait
-- laissé passer les ventes enregistrées autrement.

create or replace function public.credit_ambassador_on_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ambassador_id uuid;
  v_old_status    text := null;
begin
  -- OLD n'existe pas sur INSERT : on le capture dans une variable plutôt que
  -- de le référencer dans une condition (accéder à OLD sur INSERT lève
  -- "record old is not assigned yet").
  if tg_op = 'UPDATE' then
    v_old_status := old.status;
  end if;

  -- Vente annulée ou remboursée après coup : le gain correspondant est
  -- neutralisé (jamais supprimé, pour garder la trace comptable).
  if new.status in ('cancelled', 'refunded')
     and coalesce(v_old_status, '') not in ('cancelled', 'refunded') then
    update public.ambassador_earnings
    set status = 'cancelled',
        note   = coalesce(note, '') || ' [annulé: commande ' || new.status || ']'
    where order_id = new.id
      and kind = 'seller_sale'
      and status in ('pending', 'available');
    return new;
  end if;

  -- Ne créditer qu'à l'entrée effective en statut payé.
  if new.status is distinct from 'paid' or coalesce(v_old_status, '') = 'paid' then
    return new;
  end if;

  -- Qui a apporté le vendeur auteur de cette vente ?
  select s.referred_by_ambassador_id
  into   v_ambassador_id
  from   public.subscribers s
  where  s.user_id = new.seller_user_id;

  if v_ambassador_id is null then
    return new;   -- vendeur non parrainé : rien à créditer
  end if;

  insert into public.ambassador_earnings
    (ambassador_id, kind, amount_cents, subscriber_user_id, order_id, status, note)
  values
    (v_ambassador_id, 'seller_sale', 5000, new.seller_user_id, new.id, 'pending',
     'Vente réalisée par un vendeur apporté')
  on conflict (order_id) where kind = 'seller_sale' do nothing;

  return new;
end $$;

drop trigger if exists trg_credit_ambassador_on_order_paid on public.orders;
create trigger trg_credit_ambassador_on_order_paid
  after insert or update of status on public.orders
  for each row
  execute function public.credit_ambassador_on_order_paid();

-- ---------------------------------------------------------------------------
-- 8. Crédit mensuel des 15 € par abonné actif apporté
-- ---------------------------------------------------------------------------
-- Appelée par la fonction planifiée notify-cron-ambassador-earnings.
-- Idempotente : relancée dix fois dans le mois, elle ne crédite qu'une fois
-- grâce à ambassador_earnings_sub_month_uk.

create or replace function public.run_ambassador_monthly_earnings(
  p_month date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_month   date;
  v_created integer;
begin
  v_month := date_trunc('month', coalesce(p_month, current_date))::date;

  with candidats as (
    select s.referred_by_ambassador_id as ambassador_id,
           s.user_id
    from   public.subscribers s
    join   public.ambassadors a on a.id = s.referred_by_ambassador_id
    where  s.referred_by_ambassador_id is not null
      and  s.is_active = true
      and  coalesce(a.is_active, true) = true
  ), inserted as (
    insert into public.ambassador_earnings
      (ambassador_id, kind, amount_cents, subscriber_user_id, period_month, status, note)
    select c.ambassador_id, 'subscription_month', 1500, c.user_id, v_month, 'pending',
           'Abonné actif apporté — ' || to_char(v_month, 'MM/YYYY')
    from   candidats c
    on conflict (ambassador_id, subscriber_user_id, period_month)
      where kind = 'subscription_month'
      do nothing
    returning 1
  )
  select count(*) into v_created from inserted;

  return jsonb_build_object(
    'month',   to_char(v_month, 'YYYY-MM'),
    'created', v_created
  );
end $$;

-- ---------------------------------------------------------------------------
-- 9. Statistiques d'un ambassadeur (son propre tableau de bord)
-- ---------------------------------------------------------------------------

create or replace function public.ambassador_dashboard(p_ambassador_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'slug', (select slug from public.ambassadors where id = p_ambassador_id),

    'clicks_total',   (select count(*) from public.referral_clicks where ambassador_id = p_ambassador_id),
    'clicks_unique',  (select count(distinct visitor_hash) from public.referral_clicks where ambassador_id = p_ambassador_id),
    'clicks_7d',      (select count(*) from public.referral_clicks where ambassador_id = p_ambassador_id and occurred_at > now() - interval '7 days'),

    'signups_total',  (select count(*) from public.subscribers where referred_by_ambassador_id = p_ambassador_id),
    'subs_active',    (select count(*) from public.subscribers where referred_by_ambassador_id = p_ambassador_id and is_active = true),
    'subs_churned',   (select count(*) from public.subscribers where referred_by_ambassador_id = p_ambassador_id and is_active = false),

    'earned_total_cents',     (select coalesce(sum(amount_cents), 0) from public.ambassador_earnings where ambassador_id = p_ambassador_id and status <> 'cancelled'),
    'earned_pending_cents',   (select coalesce(sum(amount_cents), 0) from public.ambassador_earnings where ambassador_id = p_ambassador_id and status = 'pending'),
    'earned_available_cents', (select coalesce(sum(amount_cents), 0) from public.ambassador_earnings where ambassador_id = p_ambassador_id and status = 'available'),
    'earned_paid_cents',      (select coalesce(sum(amount_cents), 0) from public.ambassador_earnings where ambassador_id = p_ambassador_id and status = 'paid'),
    'earned_month_cents',     (select coalesce(sum(amount_cents), 0) from public.ambassador_earnings where ambassador_id = p_ambassador_id and status <> 'cancelled' and created_at >= date_trunc('month', now())),

    'history', (
      select coalesce(jsonb_agg(h order by h_created desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
                 'kind',   e.kind,
                 'amount', e.amount_cents,
                 'status', e.status,
                 'label',  coalesce(e.note, e.kind),
                 'date',   e.created_at
               ) as h,
               e.created_at as h_created
        from public.ambassador_earnings e
        where e.ambassador_id = p_ambassador_id
        order by e.created_at desc
        limit 50
      ) t
    )
  );
$$;

-- ---------------------------------------------------------------------------
-- 10. Tableau de bord admin : tous les ambassadeurs, une ligne chacun
-- ---------------------------------------------------------------------------

create or replace function public.admin_ambassador_leaderboard()
returns table (
  ambassador_id         uuid,
  email                 text,
  name                  text,
  slug                  text,
  is_active             boolean,
  created_at            timestamptz,
  clicks_total          bigint,
  clicks_unique         bigint,
  signups_total         bigint,
  subs_active           bigint,
  subs_churned          bigint,
  earned_total_cents    bigint,
  earned_pending_cents  bigint,
  earned_paid_cents     bigint
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    a.id,
    a.email,
    coalesce(nullif(trim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')), ''),
             a.state->>'name',
             a.email)                                            as name,
    a.slug,
    coalesce(a.is_active, true),
    a.created_at,
    (select count(*) from public.referral_clicks c where c.ambassador_id = a.id),
    (select count(distinct c.visitor_hash) from public.referral_clicks c where c.ambassador_id = a.id),
    (select count(*) from public.subscribers s where s.referred_by_ambassador_id = a.id),
    (select count(*) from public.subscribers s where s.referred_by_ambassador_id = a.id and s.is_active = true),
    (select count(*) from public.subscribers s where s.referred_by_ambassador_id = a.id and s.is_active = false),
    (select coalesce(sum(e.amount_cents), 0) from public.ambassador_earnings e where e.ambassador_id = a.id and e.status <> 'cancelled'),
    (select coalesce(sum(e.amount_cents), 0) from public.ambassador_earnings e where e.ambassador_id = a.id and e.status = 'pending'),
    (select coalesce(sum(e.amount_cents), 0) from public.ambassador_earnings e where e.ambassador_id = a.id and e.status = 'paid')
  from public.ambassadors a
  order by (select coalesce(sum(e.amount_cents), 0) from public.ambassador_earnings e where e.ambassador_id = a.id and e.status <> 'cancelled') desc,
           a.created_at asc;
$$;

-- ---------------------------------------------------------------------------
-- 11. Droits d'exécution
-- ---------------------------------------------------------------------------
-- Ces fonctions sont SECURITY DEFINER et lisent les données de TOUS les
-- ambassadeurs : elles ne doivent être appelables que par le service_role
-- (donc uniquement depuis les fonctions Netlify, jamais depuis un navigateur).

revoke all on function public.generate_ambassador_slug(text, uuid)     from public, anon, authenticated;
revoke all on function public.run_ambassador_monthly_earnings(date)    from public, anon, authenticated;
revoke all on function public.ambassador_dashboard(uuid)               from public, anon, authenticated;
revoke all on function public.admin_ambassador_leaderboard()           from public, anon, authenticated;

grant execute on function public.generate_ambassador_slug(text, uuid)  to service_role;
grant execute on function public.run_ambassador_monthly_earnings(date) to service_role;
grant execute on function public.ambassador_dashboard(uuid)            to service_role;
grant execute on function public.admin_ambassador_leaderboard()        to service_role;

-- slugify() est pure et sans accès aux données : inoffensive à exposer, et
-- utile côté client pour prévisualiser un slug avant enregistrement.
grant execute on function public.slugify(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 12. Attribution d'un slug aux ambassadeurs déjà en base
-- ---------------------------------------------------------------------------
-- Sans cela, les ambassadeurs existants n'auraient aucun lien à partager.

do $$
declare
  r record;
begin
  for r in
    select id, email, state->>'name' as state_name
    from public.ambassadors
    where slug is null
    order by created_at
  loop
    update public.ambassadors
    set slug = public.generate_ambassador_slug(
                 coalesce(nullif(r.state_name, 'Ambassadeur'), split_part(r.email, '@', 1)),
                 r.id
               )
    where id = r.id;
  end loop;
end $$;
