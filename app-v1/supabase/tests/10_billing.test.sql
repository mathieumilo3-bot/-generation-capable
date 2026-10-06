-- Parcours financier complet : topup, hold, capture, release, retry, idempotence.
do $$
declare
  a uuid; w uuid; pay public.payments; r jsonb; proj uuid; ast jsonb; rule uuid; meth uuid; k int;
  job uuid; bal bigint; held bigint; n int;
begin
  a := test.mkuser('a@billing.test', '{"given_name":"Alice"}');
  select id into w from public.wallets where user_id = a;
  perform test.ok(w is not null, 'wallet personnel créé à l''inscription');
  perform test.eq((select first_name from public.profiles where id = a), 'Alice', 'prénom importé');

  -- Topup 26,40 € ; le webhook arrive 4 fois → un seul crédit.
  perform test.as_service();
  pay := public.svc_payment_upsert('stripe', 'pi_test_1', w, 'topup', 2640, 'pending', 'web', 'idem-topup-1');
  for k in 1..4 loop perform public.svc_payment_settle(pay.id); end loop;
  select balance_cents into bal from public.wallets where id = w;
  perform test.eq(bal, 2640::bigint, 'webhook x4 = un seul crédit');
  perform test.eq((select count(*) from public.wallet_transactions where wallet_id = w and type = 'topup')::int, 1, 'une seule ligne de ledger');
  -- Doublon de paiement (même référence fournisseur) = même ligne payments.
  perform public.svc_payment_upsert('stripe', 'pi_test_1', w, 'topup', 2640, 'pending', 'web', 'idem-topup-1');
  perform test.eq((select count(*) from public.payments where wallet_id = w)::int, 1, 'payment dédupliqué par provider_ref');
  perform test.eq((select status from public.payments where id = pay.id), 'succeeded', 'statut ne régresse pas');

  -- Prix serveur ; le client ne choisit que la règle.
  select id into rule from public.pricing_rules where mode = 'edit_rushes' and bucket_key = '30_60s';
  select id into meth from public.editing_methods where slug = 'automatique';

  perform test.login(a);
  proj := public.create_draft_project('Pub produit', 'edit_rushes');
  -- sans fichier
  r := public.submit_video_job(proj, rule, meth, '9:16', null, 'job-key-0001');
  perform test.eq(r ->> 'code', 'no_files', 'refus sans fichier');
  -- format non supporté refusé à l'enregistrement
  r := public.register_asset(proj, 'raw', 'x.exe', 'application/x-msdownload', 100);
  perform test.eq(r ->> 'code', 'unsupported_format', 'format refusé');
  r := public.register_asset(proj, 'raw', 'énorme.mp4', 'video/mp4', 99999999999);
  perform test.eq(r ->> 'code', 'file_too_large', 'taille max');
  ast := public.register_asset(proj, 'raw', 'rush 1.mp4', 'video/mp4', 1000, 12.5);
  perform test.ok((ast ->> 'ok')::boolean, 'asset enregistré');
  perform test.ok((ast ->> 'path') like a::text || '/' || proj::text || '/%', 'chemin choisi par le serveur');
  perform test.ok((ast ->> 'path') !~ ' ', 'nom de fichier assaini');
  -- upload non terminé
  r := public.complete_asset((ast ->> 'asset_id')::uuid);
  perform test.eq(r ->> 'code', 'upload_missing', 'complete refuse un fichier absent du storage');
  r := public.submit_video_job(proj, rule, meth, '9:16', null, 'job-key-0001');
  perform test.eq(r ->> 'code', 'uploads_incomplete', 'upload en cours = pas de job');
  -- le fichier arrive
  perform test.as_service();
  insert into storage.objects (bucket_id, name, metadata) values ('raw', ast ->> 'path', '{"size": 1000}');
  perform test.login(a);
  perform test.ok((public.complete_asset((ast ->> 'asset_id')::uuid) ->> 'ok')::boolean, 'upload confirmé');

  -- Solde insuffisant : message exploitable (manque X €).
  perform test.as_service();
  update public.wallets set balance_cents = 300 where id = w;  -- (test seulement : simulation d'un solde bas)
  perform test.login(a);
  r := public.submit_video_job(proj, rule, meth, '9:16', null, 'job-key-0002');
  perform test.eq(r ->> 'code', 'insufficient_funds', 'solde insuffisant');
  perform test.eq((r ->> 'shortfall_cents')::int, 184, 'il manque 1,84 €');
  perform test.as_service();
  update public.wallets set balance_cents = 2640 where id = w;
  perform test.login(a);

  -- Lancement + double clic (même clé) + double clic (clé différente).
  r := public.submit_video_job(proj, rule, meth, '9:16', 'rythme rapide', 'job-key-0003');
  perform test.ok((r ->> 'ok')::boolean, 'job créé');
  job := (r ->> 'job_id')::uuid;
  perform test.eq((r ->> 'price_cents')::int, 484, 'prix 4,84 € issu de la règle serveur');
  perform test.eq((r ->> 'remaining_cents')::int, 2156, 'après création : 21,56 €');
  r := public.submit_video_job(proj, rule, meth, '9:16', 'rythme rapide', 'job-key-0003');
  perform test.ok((r ->> 'replayed')::boolean, 'rejeu idempotent');
  perform test.eq((r ->> 'job_id')::uuid, job, 'même job');
  r := public.submit_video_job(proj, rule, meth, '9:16', 'rythme rapide', 'job-key-0004');
  perform test.eq(r ->> 'code', 'already_submitted', 'second clic avec autre clé refusé');
  select balance_cents, held_cents into bal, held from public.wallets where id = w;
  perform test.eq(held, 484::bigint, 'un seul montant réservé');
  perform test.eq(bal, 2640::bigint, 'solde total inchangé avant capture');
  perform test.eq((select available_cents from public.wallet_balances where wallet_id = w), 2156::bigint, 'disponible 21,56 €');
  perform test.eq((select count(*) from public.wallet_holds where job_id = job)::int, 1, 'un hold');
  perform test.eq((select status from public.video_jobs where id = job), 'queued', 'job en file');

  -- Orchestrateur : claim exclusif, progression monotone, succès, capture unique.
  perform test.as_service();
  r := public.svc_claim_job('worker-1', 600);
  perform test.eq((r ->> 'job_id')::uuid, job, 'claim');
  perform test.ok(public.svc_claim_job('worker-2', 600) is null, 'pas de double claim');
  perform public.svc_job_progress(job, 'rendering', 70, 'Création du montage');
  perform public.svc_job_progress(job, 'analyzing', 20, 'Analyse');  -- régression ignorée
  perform test.eq((select status from public.video_jobs where id = job), 'rendering', 'statut monotone');
  perform test.eq((select progress from public.video_jobs where id = job)::int, 70, 'progression monotone');
  perform public.svc_record_costs(job, '{"llm_cost_micro": 120000, "render_compute_cost_micro": 80000, "transcription_cost_micro": 30000}');
  for k in 1..3 loop
    r := public.svc_job_complete(job, 'u/p/v1.mp4', 'u/p/t.jpg', 41.2, 1080, 1920, 5000000);
  end loop;
  perform test.ok((r ->> 'ok')::boolean, 'complete idempotent');
  select balance_cents, held_cents into bal, held from public.wallets where id = w;
  perform test.eq(bal, 2156::bigint, 'capture : 26,40 − 4,84 = 21,56');
  perform test.eq(held, 0::bigint, 'plus rien de réservé');
  perform test.eq((select count(*) from public.wallet_transactions where job_id = job and type = 'capture')::int, 1, 'une seule capture');
  perform test.eq((select status from public.projects where id = proj), 'ready', 'projet prêt');
  perform test.eq((select count(*) from public.notifications where user_id = a and kind = 'video_ready')::int, 1, 'une notification');
  perform test.eq((select total_actual_cost_micro from public.usage_costs where job_id = job), 230000::bigint, 'coût total µ€');
  perform test.eq((select revenue_cents from public.usage_costs where job_id = job), 484::bigint, 'CA');
  perform test.eq((select gross_margin_cents from public.usage_costs where job_id = job), 461::bigint, 'marge brute = 484 − ceil(230000/10000)');
  -- un échec tardif ne peut plus libérer un job livré
  perform test.eq((public.svc_job_fail(job, 'late', 'x', false) ->> 'status'), 'completed', 'fail après succès = sans effet');
  perform test.eq((select balance_cents from public.wallets where id = w), 2156::bigint, 'solde intact');

  -- Révision : nouvelle version, ancienne conservée, prix serveur.
  perform test.login(a);
  r := public.submit_revision(proj, (select current_version_id from public.projects where id = proj), '  ', 'rev-key-0001');
  perform test.eq(r ->> 'code', 'instructions_required', 'instruction requise');
  r := public.submit_revision(proj, (select current_version_id from public.projects where id = proj), 'Raccourcis l''intro', 'rev-key-0001');
  perform test.ok((r ->> 'ok')::boolean, 'révision créée');
  perform test.eq((r ->> 'price_cents')::int, 121, 'prix révision serveur');
  perform test.eq((select version_number from public.project_versions where id = (r ->> 'version_id')::uuid), 2, 'version 2');
  perform test.eq((select parent_version_id from public.project_versions where id = (r ->> 'version_id')::uuid),
                  (select id from public.project_versions where project_id = proj and version_number = 1), 'parent_version_id');
  perform test.eq((select status from public.project_versions where project_id = proj and version_number = 1), 'ready', 'v1 non écrasée');
  perform test.eq((public.submit_revision(proj, (select id from public.project_versions where project_id = proj and version_number = 1), 'x', 'rev-key-0002') ->> 'code'),
                  'job_in_progress', 'une seule modification à la fois');
  job := (r ->> 'job_id')::uuid;

  -- Échec temporaire → retry (rien n'est libéré) ; échec définitif → RELEASE.
  perform test.as_service();
  update public.video_jobs set next_attempt_at = now() where id = job;
  perform public.svc_claim_job('w', 600);
  r := public.svc_job_fail(job, 'engine_timeout', 'timeout', true);
  perform test.ok((r ->> 'requeued')::boolean, 'retry planifié');
  perform test.eq((select held_cents from public.wallets where id = w), 121::bigint, 'le hold reste pendant le retry');
  update public.video_jobs set next_attempt_at = now() where id = job;
  perform public.svc_claim_job('w', 600);
  r := public.svc_job_fail(job, 'engine_crash', 'boom', false);
  perform test.eq(r ->> 'status', 'failed', 'échec définitif');
  perform test.eq((select held_cents from public.wallets where id = w), 0::bigint, 'montant libéré');
  perform test.eq((select balance_cents from public.wallets where id = w), 2156::bigint, 'aucun prélèvement');
  perform public.svc_job_fail(job, 'engine_crash', 'boom', false);  -- rejeu
  perform test.eq((select count(*) from public.wallet_transactions where job_id = job and type = 'release')::int, 1, 'une seule libération');
  perform test.eq((select status from public.projects where id = proj), 'ready', 'le projet garde la version 1 prête');
  perform test.eq((select count(*) from public.notifications where user_id = a and kind = 'job_failed')::int, 1, 'notification d''échec');

  -- Annulation utilisateur d'un job en file : libération immédiate.
  perform test.login(a);
  r := public.submit_revision(proj, (select id from public.project_versions where project_id = proj and version_number = 1), 'Plus rapide', 'rev-key-0003');
  job := (r ->> 'job_id')::uuid;
  perform test.eq((select held_cents from public.wallets where id = w), 121::bigint, 'hold révision 2');
  r := public.cancel_video_job(job);
  perform test.eq(r ->> 'status', 'cancelled', 'annulé');
  perform test.eq((select held_cents from public.wallets where id = w), 0::bigint, 'libéré à l''annulation');
  perform test.eq((select count(*) from public.wallet_history where wallet_id = w and type = 'capture'), 0::bigint, 'la capture (0 € côté disponible) est masquée de l''historique');
  perform test.ok(exists (select 1 from public.wallet_history where wallet_id = w and type = 'release' and available_delta_cents = 121), 'la libération apparaît en +1,21 €');
  perform test.logout();
  perform test.check_ledger_invariants();
end $$;
