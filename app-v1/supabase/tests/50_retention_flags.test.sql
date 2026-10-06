-- Conservation 24 h, modifications désactivées par défaut, acceptation des conditions.
do $$
declare
  u uuid; w uuid; proj uuid; ast jsonb; rule uuid; meth uuid; r jsonb; job uuid; ver uuid; n int; rows int;
begin
  perform test.logout();
  update public.app_settings set value = 'false' where key = 'features.revisions';
  update public.app_settings set value = 'false' where key = 'features.third_party_ai';
  u := test.mkuser('ret@t.test');
  perform test.as_service();
  select id into w from public.wallets where user_id = u;
  perform public.svc_payment_settle((public.svc_payment_upsert('stripe', 'pi_ret', w, 'topup', 5000, 'succeeded', 'web')).id);
  select id into rule from public.pricing_rules where mode = 'edit_rushes' and bucket_key = 'lt_30s';
  select id into meth from public.editing_methods where slug = 'automatique';

  perform test.eq((private.setting('retention.raw_hours'))::text, '24', 'rétention des fichiers : 24 h');
  perform test.eq((private.setting('retention.renders_hours'))::text, '24', 'rétention des vidéos : 24 h');

  perform test.login(u);
  proj := public.create_draft_project('Rétention');
  ast := public.register_asset(proj, 'raw', 'a.mp4', 'video/mp4', 100);
  perform test.as_service();
  insert into storage.objects (bucket_id, name, metadata) values ('raw', ast ->> 'path', '{"size":100}');
  perform test.login(u);
  perform public.complete_asset((ast ->> 'asset_id')::uuid);

  -- Fichier de plus de 24 h dans un brouillon : supprimé ; fichier récent : conservé.
  perform test.as_service();
  update public.assets set created_at = now() - interval '25 hours' where id = (ast ->> 'asset_id')::uuid;
  r := public.svc_expire_content();
  perform test.eq((r ->> 'assets_marked')::int, 1, 'fichier de 25 h marqué supprimé');
  perform test.eq((select status from public.assets where id = (ast ->> 'asset_id')::uuid), 'deleted', 'statut deleted');
  perform test.eq((select count(*) from public.svc_assets_to_purge())::int, 1, 'à purger du Storage');

  -- Un fichier utilisé par un job actif n'est JAMAIS supprimé sous les pieds du moteur.
  perform test.login(u);
  ast := public.register_asset(proj, 'raw', 'b.mp4', 'video/mp4', 100);
  perform test.as_service();
  insert into storage.objects (bucket_id, name, metadata) values ('raw', ast ->> 'path', '{"size":100}');
  perform test.login(u);
  perform public.complete_asset((ast ->> 'asset_id')::uuid);
  r := public.submit_video_job(proj, rule, meth, '9:16', null, 'ret-key-00001');
  perform test.eq(r ->> 'ok', 'true', 'job lancé');
  job := (r ->> 'job_id')::uuid; ver := (r ->> 'version_id')::uuid;
  perform test.as_service();
  update public.assets set created_at = now() - interval '30 hours' where id = (ast ->> 'asset_id')::uuid;
  perform test.eq(((public.svc_expire_content()) ->> 'assets_marked')::int, 0, 'asset d''un job actif préservé');

  -- Livraison : expiration à +24 h ; avant expiration rien à purger ; notification d'avertissement 3 h avant.
  perform public.svc_claim_job('w', 600);
  perform public.svc_job_complete(job, u || '/p/v/render.mp4', u || '/p/v.jpg', 20, 1080, 1920, 1000);
  perform test.ok((select expires_at from public.project_versions where id = ver) between now() + interval '23 hours 59 minutes' and now() + interval '24 hours 1 minute', 'expiration = +24 h');
  perform test.eq((select count(*) from public.svc_versions_to_purge())::int, 0, 'rien à purger avant expiration');
  perform test.eq(public.svc_notify_expiring(3), 0, 'pas d''avertissement trop tôt');
  update public.project_versions set expires_at = now() + interval '2 hours' where id = ver;
  perform test.eq(public.svc_notify_expiring(3), 1, 'avertissement à moins de 3 h');
  perform test.eq(public.svc_notify_expiring(3), 1, 'recalcul idempotent côté appel…');
  perform test.eq((select count(*) from public.notifications where user_id = u and dedupe_key = 'expiring:' || ver)::int, 1, '… mais une seule notification');

  -- Expiration : purge Storage puis vidéo marquée expirée (le projet, lui, reste dans l'historique).
  update public.project_versions set expires_at = now() - interval '1 minute' where id = ver;
  perform test.eq((select count(*) from public.svc_versions_to_purge())::int, 1, 'vidéo expirée à purger');
  perform public.svc_version_purged(ver);
  perform public.svc_version_purged(ver);   -- idempotent
  perform test.eq((select status from public.project_versions where id = ver), 'expired', 'version expirée');
  perform test.ok((select render_path is null and thumbnail_path is null from public.project_versions where id = ver), 'chemins effacés');
  perform test.eq((select count(*) from public.svc_versions_to_purge())::int, 0, 'plus rien à purger');
  perform test.eq((select status from public.projects where id = proj), 'ready', 'le projet reste visible');
  perform test.eq((select thumbnail_path from public.projects where id = proj), null, 'miniature du projet retirée');

  -- Suppression d'un projet : ses rendus sont purgés immédiatement.
  perform test.login(u);
  proj := public.create_draft_project('À supprimer');
  perform test.as_service();
  update public.projects set status = 'ready' where id = proj;
  insert into public.project_versions (project_id, version_number, status, render_path, expires_at, ready_at)
    values (proj, 1, 'ready', u || '/x/render.mp4', now() + interval '20 hours', now());
  perform test.login(u);
  perform public.delete_project(proj);
  perform test.as_service();
  perform test.ok((select count(*) from public.svc_versions_to_purge() where project_id = proj) = 1, 'rendu d''un projet supprimé purgé tout de suite');

  -- Modifications : désactivées par défaut (le code reste prêt) ; réactivables.
  perform test.login(u);
  r := public.submit_revision(proj, (select id from public.project_versions where project_id = proj limit 1), 'plus court', 'rev-flag-00001');
  perform test.eq(r ->> 'code', 'revisions_disabled', 'modification refusée côté serveur tant que le réglage est faux');
  perform test.throws('select * from private.submit_revision(null, null, ''x'', ''yyyyyyyy'')', 'permission denied', 'l''implémentation interne n''est pas appelable');

  -- Acceptation des conditions : versionnée, horodatée, auditée, idempotente.
  perform test.eq(public.accept_terms('1999-01-01') ->> 'code', 'outdated_terms_version', 'mauvaise version refusée');
  perform test.eq(public.accept_terms('2026-10-06') ->> 'ok', 'true', 'acceptation enregistrée');
  perform public.accept_terms('2026-10-06');
  perform test.as_service();
  perform test.eq((select terms_version from public.profiles where id = u), '2026-10-06', 'version stockée');
  perform test.ok((select terms_accepted_at from public.profiles where id = u) is not null, 'horodatage');
  perform test.eq((select count(*) from public.audit_logs where action = 'terms.accepted' and entity_id = u::text)::int, 1, 'audit unique');
  perform test.login(u);
  perform test.throws('update public.profiles set terms_version = ''x''', 'permission denied', 'le client ne peut pas falsifier son acceptation');
  perform test.logout();
  perform test.check_ledger_invariants();
end $$;
