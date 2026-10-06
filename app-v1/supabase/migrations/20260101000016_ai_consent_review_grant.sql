-- ════════════════════════════════════════════════════════════════════════
-- 0016 — Consentement explicite au traitement par des IA tierces (App Store 5.1.2(i)) + crédit serveur (compte App Review)
-- ════════════════════════════════════════════════════════════════════════
insert into public.app_settings (key, value, is_public, description) values
  ('features.third_party_ai',   'true'::jsonb, true, 'Le moteur envoie les contenus à des IA tierces (transcription, analyse) : consentement explicite exigé avant chaque premier montage. Mettre false UNIQUEMENT si aucune clé IA n''est configurée côté moteur.'),
  ('legal.ai_consent_version',  '"2026-10-06"'::jsonb, true, 'Version du texte de consentement IA (incrémenter si les fournisseurs ou finalités changent)'),
  ('legal.ai_providers',        '["Anthropic","Deepgram","Google"]'::jsonb, true, 'Fournisseurs d''IA nommés dans le texte de consentement')
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public, description = excluded.description;

alter table public.profiles add column ai_consent_version text;
alter table public.profiles add column ai_consent_at timestamptz;

create or replace function public.accept_ai_processing(p_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := private.require_user();
begin
  if p_version is distinct from (private.setting('legal.ai_consent_version') #>> '{}') then
    return jsonb_build_object('ok', false, 'code', 'outdated_terms_version');
  end if;
  update public.profiles set ai_consent_version = p_version, ai_consent_at = now() where id = v_uid
    and (ai_consent_version is distinct from p_version);
  if found then
    insert into public.audit_logs (actor_id, actor_role, action, entity, entity_id, after_data)
    values (v_uid, 'user', 'ai_consent.accepted', 'profile', v_uid::text,
            jsonb_build_object('version', p_version, 'providers', private.setting('legal.ai_providers')));
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function private.ai_consent_ok(p_uid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not coalesce((private.setting('features.third_party_ai'))::boolean, true)
      or exists (select 1 from public.profiles
                  where id = p_uid and ai_consent_version = (private.setting('legal.ai_consent_version') #>> '{}'));
$$;

-- La soumission d'un job exige le consentement : l'implémentation est déplacée dans `private`, le point d'entrée public vérifie d'abord.
alter function public.submit_video_job(uuid, uuid, uuid, text, text, text) set schema private;
create function public.submit_video_job(
  p_project_id uuid, p_pricing_rule_id uuid, p_editing_method_id uuid,
  p_aspect_ratio text default '9:16', p_instructions text default null, p_idempotency_key text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not private.ai_consent_ok(private.require_user()) then
    return jsonb_build_object('ok', false, 'code', 'ai_consent_required');
  end if;
  return private.submit_video_job(p_project_id, p_pricing_rule_id, p_editing_method_id, p_aspect_ratio, p_instructions, p_idempotency_key);
end $$;

create or replace function public.submit_revision(p_project_id uuid, p_parent_version_id uuid, p_instructions text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((private.setting('features.revisions'))::boolean, false) then
    return jsonb_build_object('ok', false, 'code', 'revisions_disabled');
  end if;
  if not private.ai_consent_ok(private.require_user()) then
    return jsonb_build_object('ok', false, 'code', 'ai_consent_required');
  end if;
  return private.submit_revision(p_project_id, p_parent_version_id, p_instructions, p_idempotency_key);
end $$;

-- Crédit serveur (idempotent, audité) : compte de test App Review, gestes commerciaux automatisés.
create or replace function public.svc_grant_credit(p_wallet_id uuid, p_amount_cents bigint, p_reason text, p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare t public.wallet_transactions;
begin
  if p_amount_cents <= 0 then raise exception 'invalid_amount' using errcode = '22023'; end if;
  t := private.wallet_apply(p_wallet_id, 'commercial_credit', p_amount_cents, 'grant:' || p_idempotency_key, null, null, null, null,
    left(p_reason, 200), jsonb_build_object('reason', left(p_reason, 500)), null);
  insert into public.audit_logs (actor_role, action, entity, entity_id, after_data, reason)
  values ('system', 'wallet.grant', 'wallet', p_wallet_id::text, jsonb_build_object('amount_cents', p_amount_cents, 'transaction_id', t.id), p_reason);
  return jsonb_build_object('ok', true, 'transaction_id', t.id, 'balance_after_cents', t.balance_after_cents);
end $$;

-- ── Privilèges ──────────────────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.staff_role(), private.is_staff(), private.is_admin(), private.org_role(uuid),
  private.has_org_role(uuid, text), private.can_read_wallet(public.wallets), private.can_read_project(uuid),
  private.can_write_project(uuid), private.can_read_object(text), private.try_uuid(text), private.role_rank(text)
  to authenticated;
grant execute on all functions in schema private to service_role;
grant execute on function
  public.create_draft_project(text, text, uuid), public.register_asset(uuid, text, text, text, bigint, numeric),
  public.complete_asset(uuid), public.delete_asset(uuid), public.rename_project(uuid, text),
  public.delete_project(uuid), public.duplicate_project(uuid), public.quote_video_job(uuid, uuid, text),
  public.submit_video_job(uuid, uuid, uuid, text, text, text), public.submit_revision(uuid, uuid, text, text),
  public.cancel_video_job(uuid), public.touch_profile(text, text), public.register_push_token(text, text),
  public.mark_notifications_read(uuid[]), public.create_support_request(text, text, uuid, uuid, uuid, text, text),
  public.create_organization(text), public.set_auto_reload(boolean, integer, integer, integer, uuid),
  public.accept_invitation(text), public.accept_terms(text), public.accept_ai_processing(text),
  public.admin_adjust_wallet(uuid, text, bigint, text, text), public.admin_refund_job(uuid, text, text),
  public.admin_set_user_status(uuid, text, text), public.admin_add_note(uuid, text),
  public.admin_create_client_invitation(text, text, text, text, text, text, text, bigint, bigint, text, integer),
  public.admin_revoke_invitation(uuid), public.admin_retry_job(uuid, text), public.admin_job_detail(uuid),
  public.admin_list_jobs(text, integer, integer), public.admin_dashboard(text),
  public.admin_customers(text, integer, integer), public.admin_customer_detail(uuid),
  public.admin_set_setting(text, jsonb, text), public.admin_change_price(uuid, integer, text),
  public.admin_update_support_request(uuid, text, text)
  to authenticated;
grant execute on function public.peek_invitation(text) to anon, authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to service_role;
