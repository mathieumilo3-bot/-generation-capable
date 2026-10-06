-- TEST CRITIQUE : USER A ne doit JAMAIS lire/écrire rush, projet, wallet, rendu de USER B.
update public.app_settings set value = 'false' where key = 'features.third_party_ai';   -- le consentement IA est testé dans 60_ai_consent
do $$
declare
  a uuid; b uuid; wa uuid; wb uuid; proj_a uuid; proj_b uuid; ast jsonb; rule uuid; meth uuid; job_a uuid; r jsonb;
  ver_a uuid; n int; staff uuid;
begin
  a := test.mkuser('a@rls.test'); b := test.mkuser('b@rls.test'); staff := test.mkuser('staff@rls.test');
  select id into wa from public.wallets where user_id = a;
  select id into wb from public.wallets where user_id = b;
  select id into rule from public.pricing_rules where mode = 'edit_rushes' and bucket_key = 'lt_30s';
  select id into meth from public.editing_methods where slug = 'automatique';

  perform test.as_service();
  perform public.svc_payment_settle((public.svc_payment_upsert('stripe', 'pi_rls_a', wa, 'topup', 1000, 'succeeded')).id);
  perform public.svc_payment_settle((public.svc_payment_upsert('stripe', 'pi_rls_b', wb, 'topup', 1000, 'succeeded')).id);

  -- A prépare un job complet avec rendu.
  perform test.login(a);
  proj_a := public.create_draft_project('Projet secret A');
  ast := public.register_asset(proj_a, 'raw', 'secret.mp4', 'video/mp4', 500);
  perform test.as_service();
  insert into storage.objects (bucket_id, name, metadata) values ('raw', ast ->> 'path', '{"size":500}');
  insert into storage.objects (bucket_id, name, metadata) values ('renders', a::text || '/' || proj_a::text || '/v1.mp4', '{}');
  perform test.login(a);
  perform public.complete_asset((ast ->> 'asset_id')::uuid);
  r := public.submit_video_job(proj_a, rule, meth, '9:16', null, 'rls-job-a-0001');
  job_a := (r ->> 'job_id')::uuid; ver_a := (r ->> 'version_id')::uuid;
  perform test.eq(r ->> 'ok', 'true', 'A lance sa vidéo');

  perform test.login(b);
  proj_b := public.create_draft_project('Projet B');

  -- ── B ne voit RIEN de A ──────────────────────────────────────────────
  perform test.eq((select count(*) from public.projects where id = proj_a)::int, 0, 'B ne lit pas le projet de A');
  perform test.eq((select count(*) from public.projects)::int, 1, 'B ne voit que son projet');
  perform test.eq((select count(*) from public.assets where project_id = proj_a)::int, 0, 'B ne lit pas les rushs de A');
  perform test.eq((select count(*) from public.video_jobs where id = job_a)::int, 0, 'B ne lit pas le job de A');
  perform test.eq((select count(*) from public.project_versions where project_id = proj_a)::int, 0, 'B ne lit pas les versions de A');
  perform test.eq((select count(*) from public.wallets where id = wa)::int, 0, 'B ne lit pas le wallet de A');
  perform test.eq((select count(*) from public.wallet_transactions where wallet_id = wa)::int, 0, 'B ne lit pas le ledger de A');
  perform test.eq((select count(*) from public.wallet_holds where wallet_id = wa)::int, 0, 'B ne lit pas les holds de A');
  perform test.eq((select count(*) from public.wallet_history where wallet_id = wa)::int, 0, 'B ne lit pas l''historique de A');
  perform test.eq((select count(*) from public.payments where wallet_id = wa)::int, 0, 'B ne lit pas les paiements de A');
  perform test.eq((select count(*) from public.notifications where user_id = a)::int, 0, 'B ne lit pas les notifications de A');
  perform test.eq((select count(*) from public.profiles where id = a)::int, 0, 'B ne lit pas le profil de A');
  perform test.eq((select count(*) from storage.objects where bucket_id = 'raw' and name like a::text || '/%')::int, 0, 'B ne lit pas les rushs (storage)');
  perform test.eq((select count(*) from storage.objects where bucket_id = 'renders' and name like a::text || '/%')::int, 0, 'B ne lit pas les rendus (storage)');
  perform test.eq((select count(*) from public.video_job_internals)::int, 0, 'internals jamais lisibles par un client');
  perform test.eq((select count(*) from public.usage_costs)::int, 0, 'coûts jamais lisibles par un client');
  perform test.eq((select count(*) from public.audit_logs)::int, 0, 'audit réservé au staff');
  perform test.eq((select count(*) from public.job_events)::int, 0, 'logs de job réservés au staff');
  perform test.eq((select count(*) from public.editing_methods)::int, 0, 'engine_config jamais lisible directement');
  perform test.ok(not exists (select 1 from information_schema.columns where table_name = 'editing_methods_public' and column_name = 'engine_config'), 'la vue publique n''expose pas engine_config');

  -- ── B ne peut RIEN écrire chez A ─────────────────────────────────────
  perform test.throws(format('select public.register_asset(%L, ''raw'', ''x.mp4'', ''video/mp4'', 10)', proj_a), 'forbidden', 'B ne peut pas ajouter de rush à A');
  perform test.throws(format('select public.submit_video_job(%L, %L, %L, ''9:16'', null, ''rls-job-b-0001'')', proj_a, rule, meth), 'forbidden', 'B ne peut pas lancer le projet de A');
  perform test.throws(format('select public.cancel_video_job(%L)', job_a), 'forbidden', 'B ne peut pas annuler le job de A');
  perform test.throws(format('select public.rename_project(%L, ''piraté'')', proj_a), 'forbidden', 'B ne renomme pas A');
  perform test.throws(format('select public.delete_project(%L)', proj_a), 'forbidden', 'B ne supprime pas A');
  perform test.throws(format('select public.duplicate_project(%L)', proj_a), 'forbidden', 'B ne duplique pas A');
  perform test.throws(format('select public.submit_revision(%L, %L, ''x'', ''rls-rev-b-0001'')', proj_a, ver_a), 'forbidden', 'B ne révise pas A');
  perform test.throws(format('select public.quote_video_job(%L, %L)', proj_a, rule), 'forbidden', 'B ne devis pas A');
  perform test.throws(format('insert into storage.objects (bucket_id, name) values (''raw'', %L)', a::text || '/' || proj_a::text || '/evil.mp4'), 'row-level security', 'B n''écrit pas dans le dossier de A');
  perform test.throws(format('insert into storage.objects (bucket_id, name) values (''raw'', %L)', b::text || '/' || proj_b::text || '/sans-asset.mp4'), 'row-level security', 'écriture storage impossible sans asset enregistré');
  perform test.throws(format('update public.wallets set balance_cents = 999999 where id = %L', wb), 'permission denied', 'B ne modifie pas son propre solde');
  perform test.throws(format('insert into public.wallet_transactions (wallet_id, type, amount_cents, available_delta_cents, balance_before_cents, balance_after_cents, held_before_cents, held_after_cents, idempotency_key) values (%L, ''topup'', 100, 100, 0, 100, 0, 0, ''hackhackhack'')', wb), 'permission denied', 'B n''écrit pas dans le ledger');
  perform test.throws('update public.profiles set status = ''active'', email = ''x@x.x''', 'permission denied', 'B ne modifie pas les colonnes protégées du profil');
  perform test.throws('insert into public.staff_roles (user_id, role) values (auth.uid(), ''admin'')', 'permission denied', 'auto-promotion admin impossible');
  perform test.throws('update public.pricing_rules set price_cents = 1', 'permission denied', 'B ne modifie pas les prix');
  perform test.throws('update public.app_settings set value = ''true''', 'permission denied', 'B ne modifie pas la config');
  perform test.throws(format('select public.svc_job_complete(%L, ''x'', null, 1)', job_a), 'permission denied', 'B n''appelle pas les RPC serveur');
  perform test.throws(format('select public.svc_payment_settle(%L)', gen_random_uuid()), 'permission denied', 'B ne crédite pas via RPC serveur');
  perform test.throws(format('select public.admin_adjust_wallet(%L, ''bonus'', 100000, ''raison valable'', ''hack-key-0001'')', wb), 'forbidden', 'B n''est pas admin');
  perform test.throws('select public.admin_dashboard()', 'forbidden', 'dashboard réservé');
  perform test.throws('select * from private.fmt_eur(1)', 'permission denied', 'schéma privé fermé');

  -- ── A voit bien SES données ──────────────────────────────────────────
  perform test.login(a);
  perform test.eq((select count(*) from public.projects)::int, 1, 'A voit son projet');
  perform test.eq((select count(*) from public.assets where project_id = proj_a)::int, 1, 'A voit son rush');
  perform test.eq((select count(*) from storage.objects where bucket_id = 'renders')::int, 1, 'A lit son rendu (storage)');
  perform test.eq((select available_cents from public.wallet_balances where user_id = a), 1000 - 242::bigint, 'A voit son solde');

  -- ── anonyme ──────────────────────────────────────────────────────────
  perform test.as_anon();
  perform test.eq((select count(*) from public.app_settings where not is_public)::int, 0, 'anon ne lit que les réglages publics');
  perform test.ok((select count(*) from public.app_settings) > 0, 'anon lit la maintenance / version min');
  perform test.throws('select count(*) from public.projects', 'permission denied', 'anon sans accès aux projets');
  perform test.throws('select count(*) from public.wallets', 'permission denied', 'anon sans accès aux wallets');
  perform test.throws('select count(*) from public.pricing_rules', 'permission denied', 'anon sans accès aux prix');

  -- ── rôle staff : lecture seule (support) ─────────────────────────────
  perform test.as_service();
  insert into public.staff_roles (user_id, role) values (staff, 'support');
  perform test.login(staff);
  perform test.ok((select count(*) from public.projects where id in (proj_a, proj_b)) = 2, 'support voit les projets de tous');
  perform test.ok((public.admin_dashboard() ->> 'customers_total')::int >= 3, 'support lit le dashboard');
  perform test.throws(format('select public.admin_adjust_wallet(%L, ''bonus'', 100, ''raison valable'', ''sup-key-00001'')', wa), 'forbidden', 'support ne modifie aucun solde');
  perform test.throws(format('select public.admin_set_user_status(%L, ''suspended'', ''raison valable'')', a), 'forbidden', 'support ne suspend pas');
  perform test.logout();
end $$;

-- Rate limiting : une rafale est bloquée.
do $$
declare u uuid := test.mkuser('rate@rls.test'); i int; blocked boolean := false;
begin
  perform test.login(u);
  begin
    for i in 1..40 loop perform public.create_draft_project('x'); end loop;
  exception when others then blocked := sqlerrm like '%rate_limited%';
  end;
  perform test.ok(blocked, 'rate limiting sur la création de projets');
  perform test.logout();
end $$;
