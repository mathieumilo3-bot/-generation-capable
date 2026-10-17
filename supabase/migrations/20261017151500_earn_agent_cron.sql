-- Every 30 minutes: discovery, scoring, queueing, ingestion of finished
-- deliverables, submission and result tracking (earn-agent /tick).
select cron.unschedule(jobid) from cron.job where jobname in ('earn-agent-tick', 'earn-agent-prune');

select cron.schedule(
  'earn-agent-tick',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://mzslsforwzndglopztgt.supabase.co/functions/v1/earn-agent/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-earn-agent-token', (select decrypted_secret from vault.decrypted_secrets where name = 'earn_agent_cron_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

select cron.schedule('earn-agent-prune', '17 3 * * *', $$ select earn_agent.prune_runs(); $$);
