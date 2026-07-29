-- ══════════════════════════════════════════════════════════════════════════
-- Corrige une incohérence de signe sur les commissions de type 'debt'
-- ══════════════════════════════════════════════════════════════════════════
-- Bug trouvé en TESTANT réellement (pas en relisant) le flux
-- handleOrderRefund() du webhook Stripe sur une commission déjà "withdrawn" :
-- la table commissions a "CHECK (amount >= 0)" (migration 0006), donc il est
-- IMPOSSIBLE d'insérer un montant négatif pour matérialiser une dette — alors
-- que get_my_wallet() et request_payout() (migration 0006) additionnaient la
-- dette en supposant qu'elle était déjà négative. Résultat reproduit : la
-- moindre tentative d'insérer la ligne de dette suite à un remboursement
-- aurait fait planter le webhook Stripe (23514 violates check constraint).
--
-- Convention corrigée, appliquée partout ci-dessous : une ligne 'debt'
-- stocke désormais une magnitude POSITIVE (montant dû), et est SOUSTRAITE
-- (jamais additionnée) partout où elle se combine à un solde disponible.
-- Le webhook (stripe-webhook.js / handleOrderRefund) est mis à jour en
-- parallèle pour insérer une magnitude positive au lieu de -Math.abs(...).

create or replace function public.get_my_wallet()
returns table(
  pending_balance numeric,
  available_balance numeric,
  in_progress_balance numeric,
  withdrawn_total numeric,
  debt_total numeric            -- dettes suite remboursement (affiché en négatif)
)
language plpgsql security definer set search_path to 'public'
as $$
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;

  return query
    select
      coalesce((select sum(amount) from public.commissions
                where seller_id = auth.uid() and status = 'pending' and available_at > now()), 0)::numeric / 100.0,
      (
        coalesce((select sum(amount) from public.commissions
          where seller_id = auth.uid() and status = 'pending' and available_at <= now()), 0)
        - coalesce((select sum(amount) from public.commissions where seller_id = auth.uid() and status = 'debt'), 0)
      )::numeric / 100.0,
      coalesce((select sum(o.price * o.commission_rate) from public.orders o
                where o.seller_user_id = auth.uid() and o.status = 'awaiting_payment'), 0)::numeric / 100.0,
      coalesce((select sum(amount) from public.commissions
                where seller_id = auth.uid() and status = 'withdrawn'), 0)::numeric / 100.0,
      -coalesce((select sum(amount) from public.commissions
                where seller_id = auth.uid() and status = 'debt'), 0)::numeric / 100.0;
end;
$$;
revoke all on function public.get_my_wallet() from public;
revoke all on function public.get_my_wallet() from anon;
grant execute on function public.get_my_wallet() to authenticated;

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
  v_available := v_available - coalesce((select sum(amount) from public.commissions where seller_id = auth.uid() and status = 'debt'), 0);

  if v_available <= 0 then raise exception 'Aucun solde disponible à retirer.'; end if;

  v_wallet_id := ensure_wallet(auth.uid());

  insert into public.payouts (wallet_id, seller_user_id, amount, status)
  values (v_wallet_id, auth.uid(), v_available, 'requested')
  returning id into v_payout_id;

  update public.commissions set status = 'withdrawn', paid_at = now(), payout_id = v_payout_id
  where seller_id = auth.uid() and status = 'pending' and available_at <= now();
  -- Les lignes de dette (status='debt') sont soldées dans ce retrait : on les
  -- marque aussi 'withdrawn' pour qu'elles ne soient plus jamais déduites.
  update public.commissions set status = 'withdrawn', paid_at = now(), payout_id = v_payout_id
  where seller_id = auth.uid() and status = 'debt';

  return v_payout_id;
end;
$$;
revoke all on function public.request_payout() from public;
revoke all on function public.request_payout() from anon;
grant execute on function public.request_payout() to authenticated;
