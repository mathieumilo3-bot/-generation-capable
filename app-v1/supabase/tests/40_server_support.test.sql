do $$
declare u uuid; w uuid; pay public.payments; n int; r jsonb; ok boolean;
begin
  u := test.mkuser('srv@test.test', '{"given_name":"Zoé"}');
  select id into w from public.wallets where user_id = u;
  perform test.as_service();

  -- Rate limit côté serveur
  for n in 1..3 loop ok := public.svc_rate_limit('k:' || u, 3, 60); end loop;
  perform test.ok(ok, '3e appel autorisé');
  perform test.ok(not public.svc_rate_limit('k:' || u, 3, 60), '4e appel bloqué');

  -- Checkout : provider_ref = session ; PI lié ensuite ; remboursement retrouvé par PI
  pay := public.svc_payment_upsert('stripe', 'cs_test_1', w, 'topup', 2500, 'pending', 'web', 'k-1', jsonb_build_object('checkout', true));
  perform public.svc_payment_link_intent(pay.id, 'pi_test_1', 'https://receipt.example/1');
  perform test.eq(public.svc_payment_find_by_intent('pi_test_1'), pay.id, 'retrouve le paiement par PaymentIntent');
  perform public.svc_payment_settle(pay.id);
  perform test.eq((select balance_cents from public.wallets where id = w), 2500::bigint, 'crédit');
  r := public.svc_payment_refund('stripe', 'cs_test_1', 2500);
  perform test.eq((select balance_cents from public.wallets where id = w), 0::bigint, 'remboursement total retire les fonds');
  perform test.eq((select status from public.payments where id = pay.id), 'refunded', 'statut refunded');

  -- Session expirée → annulé (jamais crédité)
  pay := public.svc_payment_upsert('stripe', 'cs_test_2', w, 'topup', 1000, 'pending', 'web');
  perform public.svc_payment_cancel(pay.id);
  perform test.eq((select status from public.payments where id = pay.id), 'canceled', 'session expirée = annulé');

  -- File d'e-mails
  perform test.ok((select count(*) from public.svc_pending_emails() where kind = 'welcome' and ref_id = u) = 1, 'e-mail de bienvenue en attente');
  perform public.svc_mark_email_sent('welcome', u);
  perform test.ok((select count(*) from public.svc_pending_emails() where kind = 'welcome' and ref_id = u) = 0, 'bienvenue envoyé une seule fois');
  perform test.ok((select count(*) from public.svc_pending_emails() where kind = 'notification' and user_id = u) >= 1, 'e-mail de recharge en attente');

  -- Les clients n'accèdent pas aux jetons Apple ni aux RPC serveur
  perform test.login(u);
  perform test.throws('select * from public.apple_tokens', 'permission denied', 'apple_tokens fermé');
  perform test.throws('select public.svc_rate_limit(''x'', 1, 1)', 'permission denied', 'RPC serveur fermée');
  perform test.logout();
end $$;
