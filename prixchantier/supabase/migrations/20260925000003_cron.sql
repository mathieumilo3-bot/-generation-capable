-- Supabase Cron : appelle /api/cron/tick chaque minute (relève des boîtes,
-- relances échues, file de tâches). Aucune tâche critique ne dépend du navigateur.
--
-- Activation (une fois, dans l'éditeur SQL, avec l'URL publique et CRON_SECRET) :
--   select public.configure_tick('https://app.exemple.fr/api/cron/tick', '<CRON_SECRET>');
-- Désactivation :
--   select cron.unschedule('prixchantier-tick');

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create function public.configure_tick(p_url text, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_url !~ '^https?://' or length(coalesce(p_secret, '')) < 24 then
    raise exception 'URL ou secret invalide';
  end if;
  -- Secret conservé dans Vault, jamais en clair dans la définition du job.
  delete from vault.secrets where name = 'prixchantier_cron_secret';
  perform vault.create_secret(p_secret, 'prixchantier_cron_secret');
  perform cron.unschedule(jobid) from cron.job where jobname = 'prixchantier-tick';
  perform cron.schedule(
    'prixchantier-tick',
    '* * * * *',
    format(
      $job$
        select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'prixchantier_cron_secret')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 290000
        );
      $job$,
      p_url
    )
  );
end;
$$;

revoke all on function public.configure_tick(text, text) from public, anon, authenticated;
