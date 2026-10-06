-- ════════════════════════════════════════════════════════════════════════
-- 0009 — Privilèges (revoke-all puis liste blanche explicite)
-- Supabase accorde par défaut ALL aux rôles API sur les nouveaux objets de
-- `public` et EXECUTE à PUBLIC sur les fonctions : on repart de zéro.
-- ════════════════════════════════════════════════════════════════════════

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Schéma privé : jamais exposé par l'API ; seuls les helpers de policies sont exécutables.
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.staff_role(), private.is_staff(), private.is_admin(), private.org_role(uuid),
  private.has_org_role(uuid, text), private.can_read_wallet(public.wallets), private.can_read_project(uuid),
  private.can_write_project(uuid), private.can_read_object(text), private.try_uuid(text), private.role_rank(text)
  to authenticated;
grant execute on all functions in schema private to service_role;

-- ── Lecture (RLS filtre les lignes) ─────────────────────────────────────
grant select on public.app_settings to anon, authenticated;
grant select on
  public.staff_roles, public.organizations, public.organization_members,
  public.pricing_rules, public.editing_methods, public.editing_methods_public, public.engine_capabilities,
  public.wallets, public.wallet_transactions, public.wallet_holds, public.wallet_history, public.wallet_balances,
  public.payments, public.payments_public, public.payment_methods, public.auto_reload_rules, public.auto_reload_attempts,
  public.webhook_events, public.projects, public.assets, public.project_versions, public.video_jobs,
  public.video_job_internals, public.job_events, public.usage_costs, public.notifications,
  public.support_requests, public.sales_sources, public.commercial_deals, public.invitations,
  public.audit_logs, public.account_deletion_requests, public.customer_notes
  to authenticated;

-- ── Écriture directe : colonnes strictement utiles ──────────────────────
grant select on public.profiles to authenticated;
grant update (first_name, last_name, company, locale, billing, avatar_path) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ── RPC client ──────────────────────────────────────────────────────────
grant execute on function
  public.create_draft_project(text, text, uuid), public.register_asset(uuid, text, text, text, bigint, numeric),
  public.complete_asset(uuid), public.delete_asset(uuid), public.rename_project(uuid, text),
  public.delete_project(uuid), public.duplicate_project(uuid), public.quote_video_job(uuid, uuid, text),
  public.submit_video_job(uuid, uuid, uuid, text, text, text), public.submit_revision(uuid, uuid, text, text),
  public.cancel_video_job(uuid), public.touch_profile(text, text), public.register_push_token(text, text),
  public.mark_notifications_read(uuid[]), public.create_support_request(text, text, uuid, uuid, uuid, text, text),
  public.create_organization(text), public.set_auto_reload(boolean, integer, integer, integer, uuid),
  public.accept_invitation(text)
  to authenticated;
grant execute on function public.peek_invitation(text) to anon, authenticated;

-- ── RPC back-office (contrôle de rôle interne : require_admin/require_staff) ─
grant execute on function
  public.admin_adjust_wallet(uuid, text, bigint, text, text), public.admin_refund_job(uuid, text, text),
  public.admin_set_user_status(uuid, text, text), public.admin_add_note(uuid, text),
  public.admin_create_client_invitation(text, text, text, text, text, text, text, bigint, bigint, text, integer),
  public.admin_revoke_invitation(uuid), public.admin_retry_job(uuid, text), public.admin_job_detail(uuid),
  public.admin_list_jobs(text, integer, integer), public.admin_dashboard(text),
  public.admin_customers(text, integer, integer), public.admin_customer_detail(uuid),
  public.admin_set_setting(text, jsonb, text), public.admin_change_price(uuid, integer, text)
  to authenticated;

-- ── Serveur : service_role a tout (sans RLS) ────────────────────────────
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
