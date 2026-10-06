-- Admin (audit, idempotence), invitations commerciales, remboursements, suppression de compte.
do $$
declare
  adm uuid; u uuid; wu uuid; r jsonb; tok text; pay public.payments; n int; before_bal bigint; inv_u uuid; proj uuid;
begin
  adm := test.mkuser('admin@adm.test'); u := test.mkuser('client@adm.test');
  inv_u := test.mkuser('marie-apple-relay@privaterelay.test');   -- e-mail différent : Apple « masquer mon e-mail »
  select id into wu from public.wallets where user_id = u;
  perform test.as_service();
  insert into public.staff_roles (user_id, role) values (adm, 'admin');

  -- Ajustement admin : motif obligatoire, idempotent, audité, ledger.
  perform test.login(adm);
  perform test.throws(format('select public.admin_adjust_wallet(%L, ''bonus'', 500, ''ok'', ''adm-key-00001'')', wu), 'reason_required', 'motif obligatoire');
  r := public.admin_adjust_wallet(wu, 'promotion', 500, 'Geste commercial test', 'adm-key-00002');
  r := public.admin_adjust_wallet(wu, 'promotion', 500, 'Geste commercial test', 'adm-key-00002');
  perform test.eq((select balance_cents from public.wallets where id = wu), 500::bigint, 'ajustement appliqué une seule fois');
  perform test.eq((select count(*) from public.audit_logs where action = 'wallet.promotion' and entity_id = wu::text)::int, 1, 'audit unique (pas de doublon sur rejeu)');
  perform test.ok((select count(*) from public.audit_logs where action = 'wallet.promotion') >= 1, 'action admin auditée');
  r := public.admin_adjust_wallet(wu, 'manual_adjustment', -200, 'Correction erreur de saisie', 'adm-key-00003');
  perform test.eq((select balance_cents from public.wallets where id = wu), 300::bigint, 'correction négative via ledger');
  perform test.throws(format('select public.admin_adjust_wallet(%L, ''manual_adjustment'', -9000, ''Trop élevé volontairement'', ''adm-key-00004'')', wu), 'adjustment_below_held', 'jamais de solde négatif');
  perform test.throws(format('select public.admin_adjust_wallet(%L, ''manual_adjustment'', 999, ''Même clé autre montant'', ''adm-key-00003'')', wu), 'idempotency_key_reused', 'clé réutilisée avec un autre montant refusée');
  -- Le ledger est immuable, même pour l'admin / service_role.
  perform test.as_service();
  perform test.throws('update public.wallet_transactions set amount_cents = 1', 'append_only', 'ledger immuable (update)');
  perform test.throws('delete from public.wallet_transactions', 'append_only', 'ledger immuable (delete)');
  perform test.throws('update public.audit_logs set action = ''x''', 'append_only', 'audit immuable');

  -- Suspension : plus de commande possible.
  perform test.login(adm);
  perform public.admin_set_user_status(u, 'suspended', 'Fraude suspectée test');
  perform test.login(u);
  perform test.throws('select public.create_draft_project(''x'')', 'account_suspended', 'compte suspendu : plus de création');
  perform test.login(adm);
  perform public.admin_set_user_status(u, 'active', 'Vérifié, réactivé');

  -- Client signé commercialement + invitation.
  r := public.admin_create_client_invitation('Marie Dupont', 'marie@agence.test', 'Agence Test', 'Salon', 'Automne', 'Paul', 'DEAL-42', 5000, 2000, 'note', 14);
  tok := r ->> 'token';
  perform test.ok(length(tok) >= 30, 'jeton long');
  perform test.eq((select count(*) from public.invitations where token_hash = tok)::int, 0, 'le jeton clair n''est pas stocké');
  perform test.as_anon();
  perform test.eq(public.peek_invitation(tok) ->> 'valid', 'true', 'aperçu anonyme valide');
  perform test.eq(public.peek_invitation('mauvais-jeton') ->> 'valid', 'false', 'jeton invalide');
  perform test.as_service();
  perform test.login(inv_u);
  r := public.accept_invitation(tok);
  perform test.eq((r ->> 'credited_cents')::int, 7000, 'solde préchargé : payé + offert');
  r := public.accept_invitation(tok);
  perform test.ok((r ->> 'replayed')::boolean, 'rejeu idempotent');
  perform test.eq((select balance_cents from public.wallets where user_id = inv_u), 7000::bigint, 'crédité une seule fois');
  perform test.eq((select acquisition ->> 'salesperson' from public.profiles where id = inv_u), 'Paul', 'traçabilité vendeur');
  perform test.eq((select acquisition ->> 'deal_ref' from public.profiles where id = inv_u), 'DEAL-42', 'traçabilité deal');
  perform test.login(u);
  perform test.eq(public.accept_invitation(tok) ->> 'code', 'invalid_invitation', 'jeton à usage unique');

  -- Paiement échoué : solde inchangé + notification claire.
  perform test.as_service();
  before_bal := (select balance_cents from public.wallets where id = wu);
  pay := public.svc_payment_upsert('stripe', 'pi_fail_1', wu, 'topup', 1000, 'pending', 'web');
  perform public.svc_payment_fail(pay.id, 'card_declined', 'raw stripe detail');
  perform test.eq((select balance_cents from public.wallets where id = wu), before_bal, 'paiement refusé : solde inchangé');
  perform test.eq((select failure_detail_internal from public.payments where id = pay.id), 'raw stripe detail', 'détail interne conservé');
  perform test.login(u);
  perform test.ok(not exists (select 1 from public.payments_public where false) , 'vue publique OK');
  perform test.throws('select failure_detail_internal from public.payments_public', 'does not exist', 'détail interne absent de la vue client');

  -- Webhook : déduplication.
  perform test.as_service();
  perform test.ok(public.svc_webhook_begin('stripe', 'evt_1', 'payment_intent.succeeded', '{}'), 'événement nouveau');
  perform public.svc_webhook_end('stripe', 'evt_1', 'processed');
  perform test.ok(not public.svc_webhook_begin('stripe', 'evt_1', 'payment_intent.succeeded', '{}'), 'événement rejoué ignoré');

  -- Remboursement fournisseur : débité dans la limite du disponible, tracé.
  pay := public.svc_payment_upsert('stripe', 'pi_refund_1', wu, 'topup', 1000, 'succeeded', 'web');
  perform public.svc_payment_settle(pay.id);
  before_bal := (select balance_cents from public.wallets where id = wu);
  r := public.svc_payment_refund('stripe', 'pi_refund_1', 400);
  r := public.svc_payment_refund('stripe', 'pi_refund_1', 400);   -- rejeu
  perform test.eq((select balance_cents from public.wallets where id = wu), before_bal - 400, 'remboursement partiel débité une fois');
  perform test.eq((select status from public.payments where id = pay.id), 'partially_refunded', 'statut partiel');

  -- Auto-reload : sélection + anti double tentative.
  perform test.login(u);
  perform test.eq(public.set_auto_reload(true, 500, 2500, 10000, null) ->> 'code', 'payment_method_required', 'carte requise');
  perform test.as_service();
  insert into public.payment_methods (user_id, wallet_id, provider, provider_pm_id, brand, last4) values (u, wu, 'stripe', 'pm_test', 'visa', '4242');
  perform test.login(u);
  r := public.set_auto_reload(true, 100000, 2500, 10000, (select id from public.payment_methods where user_id = u));
  perform test.eq(r ->> 'ok', 'true', 'recharge auto activée');
  perform test.as_service();
  perform test.eq((select count(*) from public.svc_due_auto_reloads() where user_id = u)::int, 1, 'seuil franchi → due');
  perform test.ok(public.svc_auto_reload_begin((select id from public.auto_reload_rules where user_id = u)) is not null, 'première tentative');
  perform test.ok(public.svc_auto_reload_begin((select id from public.auto_reload_rules where user_id = u)) is null, 'pas de seconde tentative dans l''heure');

  -- Suppression de compte : données perso supprimées, comptabilité conservée anonymisée.
  perform test.login(u);
  proj := public.create_draft_project('À supprimer');
  perform test.as_service();
  r := public.svc_prepare_account_deletion(u);
  perform test.eq(r ->> 'ok', 'true', 'préparation suppression');
  perform test.logout();  -- l'API Auth Admin supprime l'utilisateur côté serveur
  delete from auth.users where id = u;
  perform test.eq((select count(*) from public.profiles where id = u)::int, 0, 'profil supprimé');
  perform test.eq((select count(*) from public.projects where id = proj)::int, 0, 'projets supprimés');
  perform test.ok((select count(*) from public.wallet_transactions where wallet_id = wu) > 0, 'ledger conservé');
  perform test.eq((select count(*) from public.wallet_transactions where wallet_id = wu and user_id is not null)::int, 0, 'ledger anonymisé');
  perform test.eq((select count(*) from public.payments where wallet_id = wu and user_id is not null)::int, 0, 'paiements anonymisés');
  perform test.eq((select status from public.wallets where id = wu), 'closed', 'wallet clos');
  perform test.check_ledger_invariants();
  perform test.logout();
end $$;

-- Support : un agent « support » traite les demandes mais ne touche pas aux soldes ; motif obligatoire pour relancer un job.
do $$
declare sup uuid; cli uuid; adm uuid; req uuid;
begin
  sup := test.mkuser('sup@adm2.test'); cli := test.mkuser('cli@adm2.test'); adm := test.mkuser('adm@adm2.test');
  perform test.as_service();
  insert into public.staff_roles (user_id, role) values (sup, 'support'), (adm, 'admin');
  perform test.login(cli);
  req := public.create_support_request('video_problem', 'Ma vidéo est floue', null, null, null, '1.0.0', 'ios');
  perform test.throws(format('select public.admin_update_support_request(%L, ''resolved'', ''x'')', req), 'forbidden', 'un client ne traite pas le support');
  perform test.login(sup);
  perform public.admin_update_support_request(req, 'in_progress', 'Pris en charge');
  perform test.eq((select status from public.support_requests where id = req), 'in_progress', 'statut mis à jour');
  perform test.eq((select staff_notes from public.support_requests where id = req), 'Pris en charge', 'note interne');
  perform test.throws(format('select public.admin_update_support_request(%L, ''bidon'', null)', req), 'invalid_status', 'statut validé');
  perform test.login(adm);
  perform test.throws(format('select public.admin_retry_job(%L, ''ok'')', gen_random_uuid()), 'reason_required', 'relance : motif obligatoire');
  perform test.login(cli);
  perform test.eq((select count(*) from public.support_requests where staff_notes is not null)::int, 1, 'le client voit sa demande (RLS)');
  perform test.logout();
end $$;
