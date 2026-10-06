-- Consentement explicite à l'IA tierce (App Store 5.1.2(i)) : exigé AVANT tout montage, versionné, audité.
do $$
declare u uuid; w uuid; proj uuid; ast jsonb; rule uuid; meth uuid; r jsonb; admin_w jsonb;
begin
  perform test.logout();
  update public.app_settings set value = 'true' where key = 'features.third_party_ai';
  update public.app_settings set value = 'true' where key = 'features.revisions';
  u := test.mkuser('ai@t.test');
  select id into w from public.wallets where user_id = u;
  perform test.as_service();
  perform public.svc_payment_settle((public.svc_payment_upsert('stripe', 'pi_ai', w, 'topup', 5000, 'succeeded', 'web')).id);
  select id into rule from public.pricing_rules where mode = 'edit_rushes' and bucket_key = 'lt_30s';
  select id into meth from public.editing_methods where slug = 'automatique';
  perform test.login(u);
  proj := public.create_draft_project('Consentement');
  ast := public.register_asset(proj, 'raw', 'a.mp4', 'video/mp4', 100);
  perform test.as_service();
  insert into storage.objects (bucket_id, name, metadata) values ('raw', ast ->> 'path', '{"size":100}');
  perform test.login(u);
  perform public.complete_asset((ast ->> 'asset_id')::uuid);

  r := public.submit_video_job(proj, rule, meth, '9:16', null, 'ai-key-0000001');
  perform test.eq(r ->> 'code', 'ai_consent_required', 'refus tant que le consentement IA n''est pas donné');
  perform test.as_service();
  perform test.eq((select held_cents from public.wallets where id = w), 0::bigint, 'rien n''est réservé sans consentement');
  perform test.eq((select count(*) from public.video_jobs where user_id = u)::int, 0, 'aucun job créé sans consentement');

  perform test.login(u);
  perform test.eq(public.accept_ai_processing('1999-01-01') ->> 'code', 'outdated_terms_version', 'mauvaise version refusée');
  perform test.eq(public.accept_ai_processing('2026-10-06') ->> 'ok', 'true', 'consentement enregistré');
  perform public.accept_ai_processing('2026-10-06');
  r := public.submit_video_job(proj, rule, meth, '9:16', null, 'ai-key-0000001');
  perform test.eq(r ->> 'ok', 'true', 'montage possible après consentement');
  perform test.as_service();
  perform test.eq((select count(*) from public.audit_logs where action = 'ai_consent.accepted' and entity_id = u::text)::int, 1, 'consentement audité une seule fois (avec la liste des fournisseurs)');
  perform test.ok((select after_data -> 'providers' from public.audit_logs where action = 'ai_consent.accepted' and entity_id = u::text) @> '"Deepgram"'::jsonb, 'fournisseurs tracés');

  -- Le client ne peut pas falsifier son consentement ni appeler l'implémentation interne.
  perform test.login(u);
  perform test.throws('update public.profiles set ai_consent_version = ''x''', 'permission denied', 'consentement non falsifiable');
  perform test.throws('select private.submit_video_job(null, null, null)', 'permission denied', 'implémentation interne fermée');

  -- Nouvelle version du texte (ex. nouveau fournisseur) : consentement redemandé.
  perform test.as_service();
  update public.app_settings set value = '"2027-01-01"' where key = 'legal.ai_consent_version';
  perform test.eq(private.ai_consent_ok(u), false, 'nouvelle version du texte : consentement à redonner');
  update public.app_settings set value = '"2026-10-06"' where key = 'legal.ai_consent_version';

  -- Sans IA tierce configurée côté moteur, le consentement n'est pas exigé.
  update public.app_settings set value = 'false' where key = 'features.third_party_ai';
  perform test.eq(private.ai_consent_ok(gen_random_uuid()), true, 'réglage désactivé : pas de consentement requis');

  -- Crédit serveur idempotent et audité (compte App Review)
  admin_w := public.svc_grant_credit(w, 2000, 'Compte de test App Review', 'review-1');
  admin_w := public.svc_grant_credit(w, 2000, 'Compte de test App Review', 'review-1');
  perform test.eq((select count(*) from public.wallet_transactions where wallet_id = w and type = 'commercial_credit')::int, 1, 'crédit serveur appliqué une seule fois');
  perform test.ok((select count(*) from public.audit_logs where action = 'wallet.grant' and entity_id = w::text) >= 1, 'crédit journalisé');
  perform test.login(u);
  perform test.throws(format('select public.svc_grant_credit(%L, 100, ''x'', ''hack-key-01'')', w), 'permission denied', 'un client ne peut pas se créditer');
  perform test.logout();
  update public.app_settings set value = 'true' where key = 'features.third_party_ai';
end $$;
