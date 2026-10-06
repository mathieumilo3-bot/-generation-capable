create or replace function public.svc_payment_lookup(p_provider text, p_ref text)
returns table (id uuid, wallet_id uuid, status text)
language sql stable security definer set search_path = '' as $$
  select id, wallet_id, status from public.payments where provider = p_provider and provider_ref = p_ref;
$$;
revoke execute on function public.svc_payment_lookup(text, text) from public, anon, authenticated;
grant execute on function public.svc_payment_lookup(text, text) to service_role;
