-- Remboursement résolu par identifiant interne de paiement (le webhook a déjà retrouvé la ligne via le PaymentIntent).
create or replace function public.svc_payment_refund_by_id(p_payment_id uuid, p_refunded_total_cents bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pay public.payments;
begin
  select * into pay from public.payments where id = p_payment_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'payment_not_found'); end if;
  return public.svc_payment_refund(pay.provider, pay.provider_ref, p_refunded_total_cents);
end $$;
revoke execute on function public.svc_payment_refund_by_id(uuid, bigint) from public, anon, authenticated;
grant execute on function public.svc_payment_refund_by_id(uuid, bigint) to service_role;
