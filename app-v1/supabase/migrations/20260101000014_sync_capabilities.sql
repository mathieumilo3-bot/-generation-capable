-- Synchronisation des capacités RÉELLES du moteur (publiées par la passerelle) vers engine_capabilities.
-- N'écrit une nouvelle version que si le contenu a changé (historique conservé).
create or replace function public.svc_sync_capabilities(p_engine_version text, p_caps jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare cur jsonb;
begin
  select capabilities into cur from public.engine_capabilities where active;
  if cur is not null and cur = p_caps then return false; end if;
  update public.engine_capabilities set active = false where active;
  insert into public.engine_capabilities (engine_version, capabilities, active) values (p_engine_version, p_caps, true);
  insert into public.audit_logs (actor_role, action, entity, entity_id, before_data, after_data)
  values ('system', 'engine.capabilities.changed', 'engine_capabilities', p_engine_version, cur, p_caps);
  return true;
end $$;
revoke execute on function public.svc_sync_capabilities(text, jsonb) from public, anon, authenticated;
grant execute on function public.svc_sync_capabilities(text, jsonb) to service_role;
