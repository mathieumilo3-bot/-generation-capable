-- ══════════════════════════════════════════════════════════════════════════
-- Résolution des litiges Stripe — la moitié manquante du gel de commission
-- ══════════════════════════════════════════════════════════════════════════
-- freezeCommissionForDispute() (stripe-webhook.js, migration 0007) gèle une
-- commission "pending" en "disputed" à la réception de charge.dispute.created
-- — mais aucune fonction ne permettait ensuite de la faire ressortir de cet
-- état : une fois en litige, une commission y restait pour toujours, quelle
-- que soit l'issue réelle du litige chez Stripe. Trouvé en construisant le
-- tableau de bord admin, avant qu'il soit trop tard pour le corriger.
--
-- Stripe ne notifie pas de façon fiable/automatisable l'issue d'un litige
-- (dispute.closed existe mais son "outcome" n'est pas toujours exploitable
-- automatiquement) : résolution manuelle par l'admin, au vu du dashboard
-- Stripe, comme documenté dans la migration 0007.
create or replace function public.admin_resolve_dispute(p_commission_id uuid, p_seller_wins boolean)
returns void
language plpgsql security definer set search_path to 'public'
as $$
declare v_status text;
begin
  if not is_current_user_admin() then raise exception 'Accès refusé'; end if;

  select status into v_status from public.commissions where id = p_commission_id;
  if v_status is null then raise exception 'Commission introuvable'; end if;
  if v_status != 'disputed' then raise exception 'Cette commission n''est pas en litige (statut actuel: %)', v_status; end if;

  if p_seller_wins then
    -- Litige gagné (rejeté par Stripe / preuves acceptées) : la commission
    -- reprend son cours normal — available_at n'a jamais bougé pendant le
    -- gel, la maturation continue exactement comme si le litige n'avait pas eu lieu.
    update public.commissions set status = 'pending', updated_at = now() where id = p_commission_id;
  else
    -- Litige perdu (chargeback confirmé) : la commission était encore
    -- "pending" au moment du gel (freezeCommissionForDispute ne gèle que les
    -- commissions pending) donc rien n'a jamais été versé au vendeur — simple
    -- annulation, jamais de dette (le pattern "dette" est réservé aux
    -- commissions déjà "withdrawn", voir handleOrderRefund()).
    update public.commissions set status = 'cancelled', updated_at = now() where id = p_commission_id;
  end if;
end;
$$;
revoke all on function public.admin_resolve_dispute(uuid, boolean) from public;
revoke all on function public.admin_resolve_dispute(uuid, boolean) from anon;
grant execute on function public.admin_resolve_dispute(uuid, boolean) to authenticated;

-- Vue admin dédiée : sans elle, un litige gelé était invisible partout dans
-- l'app (ni get_my_commissions() ne l'affiche de façon actionnable côté
-- vendeur, ni admin_get_orders_overview() qui porte sur les commandes, pas
-- les commissions).
create or replace function public.admin_get_disputed_commissions()
returns table(id uuid, seller_email text, amount numeric, product_name text, created_at timestamptz)
language sql security definer set search_path to 'public' stable
as $$
  select c.id, u.email, (c.amount::numeric / 100.0), s.product_name, c.created_at
  from public.commissions c
  join auth.users u on u.id = c.seller_id
  left join public.sales s on s.id = c.sale_id
  where c.status = 'disputed'
    and exists (select 1 from public.admins a where a.email = auth.jwt()->>'email')
  order by c.created_at;
$$;
revoke all on function public.admin_get_disputed_commissions() from public;
revoke all on function public.admin_get_disputed_commissions() from anon;
grant execute on function public.admin_get_disputed_commissions() to authenticated;
