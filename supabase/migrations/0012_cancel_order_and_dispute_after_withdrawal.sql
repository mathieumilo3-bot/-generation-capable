-- ══════════════════════════════════════════════════════════════════════════
-- 1. cancel_order() — 'cancelled' était un statut défini mais jamais atteignable
-- ══════════════════════════════════════════════════════════════════════════
-- Aucune fonction ne faisait jamais passer une commande à 'cancelled' :
-- create_order_for_prospect()/sign_and_lock_order()/admin_set_order_status()
-- ne l'atteignent jamais, et le webhook Stripe met 'refunded', pas
-- 'cancelled'. Une commande créée par erreur restait donc bloquée en
-- brouillon/attente de paiement pour toujours, sans qu'aucune action ne
-- soit possible dessus.
create or replace function public.cancel_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_seller_id uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select seller_user_id, status into v_seller_id, v_status from public.orders where id = p_order_id;
  if v_seller_id is null then raise exception 'Commande introuvable'; end if;
  if v_seller_id != auth.uid() then raise exception 'Accès refusé'; end if;
  if v_status not in ('draft','awaiting_payment') then
    raise exception 'Cette commande ne peut plus être annulée (statut actuel: %)', v_status;
  end if;
  update public.orders set status = 'cancelled', updated_at = now() where id = p_order_id;
end;
$$;
revoke all on function public.cancel_order(uuid) from public;
revoke all on function public.cancel_order(uuid) from anon;
grant execute on function public.cancel_order(uuid) to authenticated;


-- ══════════════════════════════════════════════════════════════════════════
-- 2. Litige Stripe sur une commission déjà retirée — trou identifié en
--    audit après coup (migration 0007/0011 ne couvrait que le cas "pending")
-- ══════════════════════════════════════════════════════════════════════════
-- freezeCommissionForDispute() (stripe-webhook.js) ne touchait que les
-- commissions encore "pending" — si un litige Stripe arrivait après qu'un
-- vendeur ait déjà retiré sa commission (statut "withdrawn"), rien ne se
-- passait : ni gel, ni dette, ni visibilité admin. Le vendeur gardait
-- l'argent sans aucune trace du litige en cours, même si Stripe finissait
-- par confirmer le chargeback contre Génération Capable.
--
-- Le webhook (voir stripe-webhook.js) crée désormais, dans ce cas précis,
-- une ligne "disputed" MIROIR (nouvelle ligne, même montant, la ligne
-- "withdrawn" originale n'est jamais modifiée — même principe que la dette
-- de remboursement : jamais de réécriture silencieuse d'une ligne
-- historique déjà versée). Cette ligne miroir est purement informative :
-- get_my_wallet() ne compte "disputed" dans AUCUN total (pending/
-- available/withdrawn/debt), donc son insertion n'a aucun effet sur le
-- solde tant qu'elle n'est pas résolue.
create or replace function public.admin_resolve_dispute(p_commission_id uuid, p_seller_wins boolean)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare
  v_status text;
  v_sale_id uuid;
  v_is_shadow_of_withdrawn boolean;
begin
  if not is_current_user_admin() then raise exception 'Accès refusé'; end if;

  select status, sale_id into v_status, v_sale_id from public.commissions where id = p_commission_id;
  if v_status is null then raise exception 'Commission introuvable'; end if;
  if v_status != 'disputed' then raise exception 'Cette commission n''est pas en litige (statut actuel: %)', v_status; end if;

  -- Une ligne "miroir" se reconnaît par la présence d'une AUTRE ligne
  -- "withdrawn" pour la même vente (la commission originale réellement versée).
  select exists(
    select 1 from public.commissions
    where sale_id = v_sale_id and status = 'withdrawn' and id != p_commission_id
  ) into v_is_shadow_of_withdrawn;

  if v_is_shadow_of_withdrawn then
    if p_seller_wins then
      -- Litige gagné sur une commission déjà versée : rien à récupérer,
      -- on efface juste le marqueur de risque, sans aucun effet sur le solde.
      update public.commissions set status = 'cancelled', updated_at = now() where id = p_commission_id;
    else
      -- Litige perdu sur une commission déjà versée : dette réelle, exactement
      -- comme pour un remboursement classique (handleOrderRefund) — la ligne
      -- miroir porte déjà la bonne magnitude positive, on la convertit en dette.
      update public.commissions set status = 'debt', updated_at = now() where id = p_commission_id;
    end if;
  else
    if p_seller_wins then
      update public.commissions set status = 'pending', updated_at = now() where id = p_commission_id;
    else
      update public.commissions set status = 'cancelled', updated_at = now() where id = p_commission_id;
    end if;
  end if;
end;
$$;
revoke all on function public.admin_resolve_dispute(uuid, boolean) from public;
revoke all on function public.admin_resolve_dispute(uuid, boolean) from anon;
grant execute on function public.admin_resolve_dispute(uuid, boolean) to authenticated;
