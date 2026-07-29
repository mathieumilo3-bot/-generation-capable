-- ══════════════════════════════════════════════════════════════════════════
-- Génération Capable — CRM commercial + moteur financier marketplace
-- ══════════════════════════════════════════════════════════════════════════
-- Implémente le pipeline vendeur (prospects → commande → paiement Stripe →
-- production → livraison) et le système financier (wallet, commissions,
-- retraits) demandés : source de vérité unique par vente, chaque commande a
-- un identifiant unique, toute action est horodatée et attribuée, tout
-- changement financier vient exclusivement d'un événement Stripe vérifié
-- (jamais d'action manuelle sur un solde), piste d'audit complète.
--
-- Principe clé sur la maturation PENDING → DISPONIBLE : pas de tâche cron
-- (pg_cron n'est pas installé sur ce projet). Comme pour get_leaderboard()/
-- get_my_missions(), le solde disponible est CALCULÉ EN DIRECT à partir de
-- available_at <= now() — jamais un statut qu'un job périodique devrait
-- faire progresser (donc jamais de risque de job qui ne tourne pas / en retard).

-- ──────────────────────────────────────────────────────────────────────────
-- 1. PROSPECTS — un vendeur = ses propres prospects, jamais ceux des autres
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.prospects (
  id             uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null references auth.users(id),
  first_name     text not null,
  last_name      text not null,
  phone          text,
  email          text,
  company        text,
  siret          text,
  needs          jsonb not null default '{}'::jsonb,
  notes          text,
  stage          text not null default 'created' check (stage in
                   ('created','contacted','rdv','quote_sent','paid','production','delivered','done')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.prospects enable row level security;
drop policy if exists prospects_select_own on public.prospects;
create policy prospects_select_own on public.prospects for select
  using (auth.uid() = seller_user_id or is_current_user_admin());
drop policy if exists prospects_insert_own on public.prospects;
create policy prospects_insert_own on public.prospects for insert
  with check (auth.uid() = seller_user_id);
drop policy if exists prospects_update_own on public.prospects;
create policy prospects_update_own on public.prospects for update
  using (auth.uid() = seller_user_id)
  with check (auth.uid() = seller_user_id);

create or replace function public.prospects_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_prospects_touch on public.prospects;
create trigger trg_prospects_touch before update on public.prospects
  for each row execute function prospects_touch_updated_at();


-- ──────────────────────────────────────────────────────────────────────────
-- 2. HISTORIQUE DE PIPELINE — piste d'audit : qui a changé quoi, quand
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.prospect_stage_history (
  id             uuid primary key default gen_random_uuid(),
  prospect_id    uuid not null references public.prospects(id) on delete cascade,
  seller_user_id uuid not null references auth.users(id),
  from_stage     text,
  to_stage       text not null,
  justification  text,
  created_at     timestamptz not null default now()
);

alter table public.prospect_stage_history enable row level security;
drop policy if exists prospect_stage_history_select_own on public.prospect_stage_history;
create policy prospect_stage_history_select_own on public.prospect_stage_history for select
  using (auth.uid() = seller_user_id or is_current_user_admin());
-- Aucune policy insert/update : uniquement via advance_prospect_stage() ci-dessous.

-- Ordre officiel du pipeline — un saut d'étape (vers l'avant comme en arrière,
-- au-delà de l'étape adjacente) exige une justification, tracée.
create or replace function public.advance_prospect_stage(p_prospect_id uuid, p_new_stage text, p_justification text default null)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_seller_id uuid;
  v_current_stage text;
  v_stages text[] := array['created','contacted','rdv','quote_sent','paid','production','delivered','done'];
  v_current_idx int;
  v_new_idx int;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;

  select seller_user_id, stage into v_seller_id, v_current_stage
    from public.prospects where id = p_prospect_id;
  if v_seller_id is null then raise exception 'Prospect introuvable'; end if;
  if v_seller_id != auth.uid() and not is_current_user_admin() then
    raise exception 'Accès refusé';
  end if;

  v_current_idx := array_position(v_stages, v_current_stage);
  v_new_idx := array_position(v_stages, p_new_stage);
  if v_new_idx is null then raise exception 'Étape inconnue: %', p_new_stage; end if;

  -- Un saut de plus d'une étape (dans un sens ou l'autre) exige une justification.
  if abs(v_new_idx - v_current_idx) > 1 and (p_justification is null or length(trim(p_justification)) = 0) then
    raise exception 'Justification requise pour sauter de "%" à "%"', v_current_stage, p_new_stage;
  end if;

  -- L'étape "paid" ne peut JAMAIS être déclarée manuellement — uniquement
  -- par le webhook Stripe (voir create_order_for_prospect / webhook).
  if p_new_stage = 'paid' then
    raise exception 'L''étape "Payé" ne peut pas être déclarée manuellement — elle est automatique dès confirmation Stripe.';
  end if;

  update public.prospects set stage = p_new_stage where id = p_prospect_id;
  insert into public.prospect_stage_history (prospect_id, seller_user_id, from_stage, to_stage, justification)
  values (p_prospect_id, v_seller_id, v_current_stage, p_new_stage, p_justification);
end;
$$;
revoke all on function public.advance_prospect_stage(uuid, text, text) from public;
revoke all on function public.advance_prospect_stage(uuid, text, text) from anon;
grant execute on function public.advance_prospect_stage(uuid, text, text) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- 3. ORDERS (commandes) — un identifiant unique par commande, jamais de doublon
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  prospect_id       uuid not null references public.prospects(id),
  seller_user_id    uuid not null references auth.users(id),
  product_type      text not null check (product_type in ('site_internet','ia','generation_capable','accompagnement','autre')),
  price             integer not null check (price >= 0), -- centimes
  commission_rate   numeric not null default 0.40 check (commission_rate >= 0 and commission_rate <= 1),
  commande_details  jsonb not null default '{}'::jsonb,
  stripe_session_id text unique,
  status            text not null default 'draft' check (status in
                       ('draft','awaiting_payment','paid','production','delivered','cancelled','refunded')),
  signed_at         timestamptz,
  locked            boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.orders enable row level security;
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders for select
  using (auth.uid() = seller_user_id or is_current_user_admin());
-- Pas de policy insert/update directe : tout passe par les fonctions ci-
-- dessous (jamais de prix/statut modifiable à la main depuis le client).

drop trigger if exists trg_orders_touch on public.orders;
create trigger trg_orders_touch before update on public.orders
  for each row execute function prospects_touch_updated_at();

create or replace function public.create_order_for_prospect(
  p_prospect_id uuid, p_product_type text, p_price integer, p_commande_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_seller_id uuid;
  v_order_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select seller_user_id into v_seller_id from public.prospects where id = p_prospect_id;
  if v_seller_id is null then raise exception 'Prospect introuvable'; end if;
  if v_seller_id != auth.uid() then raise exception 'Accès refusé'; end if;
  if p_price < 0 then raise exception 'Prix invalide'; end if;

  insert into public.orders (prospect_id, seller_user_id, product_type, price, commande_details)
  values (p_prospect_id, v_seller_id, p_product_type, p_price, coalesce(p_commande_details, '{}'::jsonb))
  returning id into v_order_id;

  return v_order_id;
end;
$$;
revoke all on function public.create_order_for_prospect(uuid, text, integer, jsonb) from public;
revoke all on function public.create_order_for_prospect(uuid, text, integer, jsonb) from anon;
grant execute on function public.create_order_for_prospect(uuid, text, integer, jsonb) to authenticated;

-- Le vendeur "signe" la commande côté client (confirmation horodatée, pas
-- une vraie signature électronique légale — hors périmètre) puis l'envoie
-- au studio, ce qui verrouille définitivement les détails de la commande.
create or replace function public.sign_and_lock_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_seller_id uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select seller_user_id, status into v_seller_id, v_status from public.orders where id = p_order_id;
  if v_seller_id is null then raise exception 'Commande introuvable'; end if;
  if v_seller_id != auth.uid() then raise exception 'Accès refusé'; end if;
  if v_status != 'paid' then raise exception 'La commande doit être payée avant d''être envoyée au studio (statut actuel: %)', v_status; end if;

  update public.orders set signed_at = now(), locked = true, status = 'production' where id = p_order_id;
  update public.prospects set stage = 'production' where id = (select prospect_id from public.orders where id = p_order_id);
end;
$$;
revoke all on function public.sign_and_lock_order(uuid) from public;
revoke all on function public.sign_and_lock_order(uuid) from anon;
grant execute on function public.sign_and_lock_order(uuid) to authenticated;

-- Progression production → livré : action admin/équipe, jamais le vendeur
-- (et jamais Stripe pour cette partie — c'est un statut opérationnel, pas financier).
create or replace function public.admin_set_order_status(p_order_id uuid, p_new_status text)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not is_current_user_admin() then raise exception 'Accès refusé'; end if;
  if p_new_status not in ('production','delivered') then
    raise exception 'admin_set_order_status ne gère que production/delivered — les autres statuts sont automatiques (Stripe) ou définis à la création';
  end if;
  update public.orders set status = p_new_status where id = p_order_id;
  if p_new_status = 'delivered' then
    update public.prospects set stage = 'delivered' where id = (select prospect_id from public.orders where id = p_order_id);
  end if;
end;
$$;
revoke all on function public.admin_set_order_status(uuid, text) from public;
revoke all on function public.admin_set_order_status(uuid, text) from anon;
grant execute on function public.admin_set_order_status(uuid, text) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- 4. SALES — lien vers la commande (order_id) + payment_intent (nécessaire
--    pour retrouver la vente depuis un événement charge.refunded)
-- ──────────────────────────────────────────────────────────────────────────
alter table public.sales add column if not exists order_id uuid references public.orders(id);


-- ──────────────────────────────────────────────────────────────────────────
-- 5. WALLETS — un par vendeur
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.wallets (
  id             uuid primary key default gen_random_uuid(),
  seller_user_id uuid not null unique references auth.users(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- Pas de colonnes de solde stockées : le solde est TOUJOURS recalculé en
-- direct depuis "commissions" (voir get_my_wallet()) — jamais un nombre
-- qui pourrait désynchroniser de la réalité des commissions individuelles.

alter table public.wallets enable row level security;
drop policy if exists wallets_select_own on public.wallets;
create policy wallets_select_own on public.wallets for select
  using (auth.uid() = seller_user_id or is_current_user_admin());

create or replace function public.ensure_wallet(p_seller_id uuid)
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare v_id uuid;
begin
  select id into v_id from public.wallets where seller_user_id = p_seller_id;
  if v_id is null then
    insert into public.wallets (seller_user_id) values (p_seller_id)
    on conflict (seller_user_id) do update set seller_user_id = excluded.seller_user_id
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke all on function public.ensure_wallet(uuid) from public;
revoke all on function public.ensure_wallet(uuid) from anon;
-- Pas de grant à authenticated : appelée uniquement en interne (webhook via
-- service_role, ou par les autres fonctions SECURITY DEFINER de ce fichier).


-- ──────────────────────────────────────────────────────────────────────────
-- 6. COMMISSIONS — colonnes complémentaires pour le nouveau moteur financier
-- ──────────────────────────────────────────────────────────────────────────
alter table public.commissions add column if not exists order_id uuid references public.orders(id);
alter table public.commissions add column if not exists wallet_id uuid references public.wallets(id);
alter table public.commissions add column if not exists available_at timestamptz;
alter table public.commissions add column if not exists paid_at timestamptz;
alter table public.commissions add column if not exists payout_id uuid; -- FK ajoutée après création de "payouts" plus bas

-- Élargit les statuts possibles : 'debt' (dette suite à remboursement d'une
-- commission déjà disponible/versée) et 'withdrawn' (incluse dans un retrait).
alter table public.commissions drop constraint if exists commissions_status_check;
alter table public.commissions add constraint commissions_status_check
  check (status in ('pending','validated','paid','cancelled','refunded','debt','withdrawn'));


-- ──────────────────────────────────────────────────────────────────────────
-- 7. PAYOUTS (retraits)
-- ──────────────────────────────────────────────────────────────────────────
create table if not exists public.payouts (
  id             uuid primary key default gen_random_uuid(),
  wallet_id      uuid not null references public.wallets(id),
  seller_user_id uuid not null references auth.users(id),
  amount         integer not null check (amount >= 0), -- centimes
  status         text not null default 'requested' check (status in ('requested','paid','failed','cancelled')),
  requested_at   timestamptz not null default now(),
  paid_at        timestamptz
);

alter table public.payouts enable row level security;
drop policy if exists payouts_select_own on public.payouts;
create policy payouts_select_own on public.payouts for select
  using (auth.uid() = seller_user_id or is_current_user_admin());

alter table public.commissions add constraint commissions_payout_id_fkey
  foreign key (payout_id) references public.payouts(id);


-- ──────────────────────────────────────────────────────────────────────────
-- 8. LE COEUR DU MOTEUR FINANCIER — jamais d'action manuelle, tout calculé
--    en direct depuis les commissions individuelles
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.get_my_wallet()
returns table(
  pending_balance numeric,      -- commissions pas encore mûres (available_at futur)
  available_balance numeric,    -- commissions mûres, pas encore retirées
  in_progress_balance numeric,  -- commandes payées en attente de confirmation Stripe (awaiting_payment)
  withdrawn_total numeric,      -- déjà retiré (historique)
  debt_total numeric            -- dettes suite remboursement (négatif)
)
language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;

  -- FIX (trouvé en testant réellement la fonction, pas en la relisant) :
  -- "coalesce(a + b, 0)" ne protège PAS contre une propagation de NULL — si
  -- UNE SEULE des deux sous-requêtes ne matche aucune ligne (NULL), la somme
  -- entière devient NULL et coalesce() la remplace par 0, effaçant l'autre
  -- moitié du solde. Reproduit : un vendeur avec une commission mûre mais
  -- aucune dette voyait un solde disponible à 0€ au lieu du bon montant.
  -- Chaque sous-requête a maintenant son propre coalesce avant l'addition.
  return query
    select
      coalesce((select sum(amount) from public.commissions
                where seller_id = auth.uid() and status = 'pending' and available_at > now()), 0)::numeric / 100.0,
      (
        coalesce((select sum(amount) from public.commissions
          where seller_id = auth.uid() and status = 'pending' and available_at <= now()), 0)
        + coalesce((select sum(amount) from public.commissions where seller_id = auth.uid() and status = 'debt'), 0)
      )::numeric / 100.0,
      coalesce((select sum(o.price * o.commission_rate) from public.orders o
                where o.seller_user_id = auth.uid() and o.status = 'awaiting_payment'), 0)::numeric / 100.0,
      coalesce((select sum(amount) from public.commissions
                where seller_id = auth.uid() and status = 'withdrawn'), 0)::numeric / 100.0,
      coalesce((select sum(amount) from public.commissions
                where seller_id = auth.uid() and status = 'debt'), 0)::numeric / 100.0;
end;
$$;
revoke all on function public.get_my_wallet() from public;
revoke all on function public.get_my_wallet() from anon;
grant execute on function public.get_my_wallet() to authenticated;

create or replace function public.get_my_commissions()
returns table(id uuid, order_id uuid, amount numeric, status text, effective_status text, created_at timestamptz, available_at timestamptz)
language sql security definer set search_path to 'public' stable
as $$
  select
    c.id, c.order_id, (c.amount::numeric / 100.0),
    c.status,
    case
      when c.status = 'pending' and c.available_at <= now() then 'available'
      else c.status
    end as effective_status,
    c.created_at, c.available_at
  from public.commissions c
  where c.seller_id = auth.uid()
  order by c.created_at desc;
$$;
revoke all on function public.get_my_commissions() from public;
revoke all on function public.get_my_commissions() from anon;
grant execute on function public.get_my_commissions() to authenticated;

create or replace function public.get_my_payouts()
returns table(id uuid, amount numeric, status text, requested_at timestamptz, paid_at timestamptz)
language sql security definer set search_path to 'public' stable
as $$
  select id, (amount::numeric / 100.0), status, requested_at, paid_at
  from public.payouts where seller_user_id = auth.uid()
  order by requested_at desc;
$$;
revoke all on function public.get_my_payouts() from public;
revoke all on function public.get_my_payouts() from anon;
grant execute on function public.get_my_payouts() to authenticated;

-- Retrait : prend l'INTÉGRALITÉ du solde disponible (pas de saisie de
-- montant côté vendeur, conforme à "Retirer mes gains"). N'ouvre la fenêtre
-- de retrait qu'à partir du 5 du mois (recommandation explicite du
-- fondateur : ne jamais libérer automatiquement au 5, seulement AUTORISER
-- la demande à partir du 5 — la maturation 15 jours reste indépendante).
create or replace function public.request_payout()
returns uuid
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_available integer;
  v_wallet_id uuid;
  v_payout_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if extract(day from now()) < 5 then
    raise exception 'Les retraits ne sont ouverts qu''à partir du 5 de chaque mois.';
  end if;

  select coalesce(sum(amount),0) into v_available
    from public.commissions
    where seller_id = auth.uid() and status = 'pending' and available_at <= now();
  v_available := v_available + coalesce((select sum(amount) from public.commissions where seller_id = auth.uid() and status = 'debt'), 0);

  if v_available <= 0 then raise exception 'Aucun solde disponible à retirer.'; end if;

  v_wallet_id := ensure_wallet(auth.uid());

  insert into public.payouts (wallet_id, seller_user_id, amount, status)
  values (v_wallet_id, auth.uid(), v_available, 'requested')
  returning id into v_payout_id;

  update public.commissions set status = 'withdrawn', paid_at = now(), payout_id = v_payout_id
  where seller_id = auth.uid() and status = 'pending' and available_at <= now();
  -- Les lignes de dette (status='debt') sont soldées dans ce retrait : on les
  -- marque aussi 'withdrawn' pour qu'elles ne soient plus comptées deux fois.
  update public.commissions set status = 'withdrawn', paid_at = now(), payout_id = v_payout_id
  where seller_id = auth.uid() and status = 'debt';

  return v_payout_id;
end;
$$;
revoke all on function public.request_payout() from public;
revoke all on function public.request_payout() from anon;
grant execute on function public.request_payout() to authenticated;

create or replace function public.admin_mark_payout_paid(p_payout_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
begin
  if not is_current_user_admin() then raise exception 'Accès refusé'; end if;
  update public.payouts set status = 'paid', paid_at = now() where id = p_payout_id;
end;
$$;
revoke all on function public.admin_mark_payout_paid(uuid) from public;
revoke all on function public.admin_mark_payout_paid(uuid) from anon;
grant execute on function public.admin_mark_payout_paid(uuid) to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- 9. VUES ADMIN — suivi production + vue d'ensemble commandes/commissions
-- ──────────────────────────────────────────────────────────────────────────
create or replace function public.admin_get_orders_overview()
returns table(
  id uuid, prospect_id uuid, seller_email text, client_name text, product_type text,
  price numeric, status text, stripe_session_id text, signed_at timestamptz,
  locked boolean, created_at timestamptz
)
language sql security definer set search_path to 'public' stable
as $$
  select o.id, o.prospect_id, u.email, (p.first_name || ' ' || p.last_name), o.product_type,
    (o.price::numeric/100.0), o.status, o.stripe_session_id, o.signed_at, o.locked, o.created_at
  from public.orders o
  join public.prospects p on p.id = o.prospect_id
  join auth.users u on u.id = o.seller_user_id
  where exists (select 1 from public.admins a where a.email = auth.jwt()->>'email')
  order by o.created_at desc;
$$;
revoke all on function public.admin_get_orders_overview() from public;
revoke all on function public.admin_get_orders_overview() from anon;
grant execute on function public.admin_get_orders_overview() to authenticated;

create or replace function public.admin_get_payouts_overview()
returns table(id uuid, seller_email text, amount numeric, status text, requested_at timestamptz, paid_at timestamptz)
language sql security definer set search_path to 'public' stable
as $$
  select po.id, u.email, (po.amount::numeric/100.0), po.status, po.requested_at, po.paid_at
  from public.payouts po
  join auth.users u on u.id = po.seller_user_id
  where exists (select 1 from public.admins a where a.email = auth.jwt()->>'email')
  order by po.requested_at desc;
$$;
revoke all on function public.admin_get_payouts_overview() from public;
revoke all on function public.admin_get_payouts_overview() from anon;
grant execute on function public.admin_get_payouts_overview() to authenticated;


-- ──────────────────────────────────────────────────────────────────────────
-- Vérification rapide après exécution :
--   select tablename, rowsecurity from pg_tables where schemaname='public'
--   and tablename in ('prospects','prospect_stage_history','orders','wallets','payouts');
-- ──────────────────────────────────────────────────────────────────────────
