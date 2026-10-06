import type { SupabaseClient, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { parsePublicSettings, type PublicSettings } from "@app/config";
import { normalizeCapabilities, type EngineCapabilities } from "@app/domain";
import { ApiError, toApiError, unwrap } from "./errors";
import type {
  AssetRow, AutoReloadRule, BillingDetails, EditingMethod, JobRow, NotificationRow, PaymentMethodRow, PaymentRow,
  PricingRule, Profile, ProjectRow, ProjectStatus, QuoteOk, RpcResult, SubmitJobOk, VersionRow, WalletBalance,
} from "./types";

type HistoryRowRaw = import("@app/domain").HistoryRow;

/**
 * Façade typée au-dessus de supabase-js. Aucune logique métier ici : les règles
 * (prix, solde, droits) vivent dans Postgres (RPC + RLS). Le client ne fait
 * qu'appeler et afficher.
 */
export function createApi(sb: SupabaseClient, opts: { platform: "ios" | "android" | "web"; appVersion: string; functionsBaseUrl?: string }) {
  const rpc = async <T extends object>(fn: string, args?: Record<string, unknown>): Promise<RpcResult<T>> => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw toApiError(error);
    return data as RpcResult<T>;
  };

  const auth = {
    async signInWithEmailOtp(email: string) {
      const { error } = await sb.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
      if (error) throw toApiError(error);
    },
    async verifyEmailOtp(email: string, token: string) {
      const { data, error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: "email" });
      if (error) throw toApiError(error);
      return data.session;
    },
    /** iOS natif : l'identity token vient d'expo-apple-authentication (nonce = hash côté Apple, brut ici). */
    async signInWithAppleIdToken(idToken: string, rawNonce: string) {
      const { data, error } = await sb.auth.signInWithIdToken({ provider: "apple", token: idToken, nonce: rawNonce });
      if (error) throw toApiError(error);
      return data.session;
    },
    /** Google (toutes plateformes) et Apple hors iOS : OAuth PKCE navigateur. Retourne l'URL à ouvrir. */
    async startOAuth(provider: "google" | "apple", redirectTo: string) {
      const { data, error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: opts.platform !== "web" } });
      if (error) throw toApiError(error);
      return data.url;
    },
    async exchangeCode(code: string) {
      const { data, error } = await sb.auth.exchangeCodeForSession(code);
      if (error) throw toApiError(error);
      return data.session;
    },
    async setSessionFromTokens(accessToken: string, refreshToken: string) {
      const { data, error } = await sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw toApiError(error);
      return data.session;
    },
    async getSession(): Promise<Session | null> {
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    onChange(cb: (event: AuthChangeEvent, session: Session | null) => void) {
      const { data } = sb.auth.onAuthStateChange(cb);
      return () => data.subscription.unsubscribe();
    },
    async signOut() {
      const { error } = await sb.auth.signOut();
      if (error) throw toApiError(error);
    },
    /** Réauthentification avant une action sensible (suppression de compte) : nouveau code par e-mail. */
    async reauthenticate() {
      const { error } = await sb.auth.reauthenticate();
      if (error) throw toApiError(error);
    },
  };

  const config = {
    async publicSettings(): Promise<PublicSettings> {
      const rows = unwrap(await sb.from("app_settings").select("key,value"));
      return parsePublicSettings(rows as { key: string; value: unknown }[]).settings;
    },
    async pricing(): Promise<PricingRule[]> {
      return unwrap(await sb.from("pricing_rules").select("*").eq("active", true).order("sort_order")) as PricingRule[];
    },
    async capabilities(): Promise<EngineCapabilities> {
      const row = unwrap(await sb.from("engine_capabilities").select("capabilities").eq("active", true).maybeSingle());
      return normalizeCapabilities((row as { capabilities?: unknown } | null)?.capabilities);
    },
    async editingMethods(): Promise<EditingMethod[]> {
      return unwrap(await sb.from("editing_methods_public").select("*").order("sort_order")) as EditingMethod[];
    },
  };

  const account = {
    async profile(): Promise<Profile> {
      const { data: u } = await sb.auth.getUser();
      return unwrap(await sb.from("profiles").select("*").eq("id", u.user?.id ?? "").single()) as Profile;
    },
    async updateProfile(patch: Partial<Pick<Profile, "first_name" | "last_name" | "company" | "locale">>) {
      const { data: u } = await sb.auth.getUser();
      unwrap(await sb.from("profiles").update(patch).eq("id", u.user?.id ?? ""));
    },
    async updateBilling(billing: BillingDetails) {
      const { data: u } = await sb.auth.getUser();
      unwrap(await sb.from("profiles").update({ billing }).eq("id", u.user?.id ?? ""));
    },
    async touch() { await sb.rpc("touch_profile", { p_app_version: opts.appVersion, p_platform: opts.platform }); },
    peekInvitation: (token: string) => sb.rpc("peek_invitation", { p_token: token }).then(({ data, error }) => {
      if (error) throw toApiError(error);
      return data as { valid: boolean; kind?: string; credit_cents?: number; name?: string; company?: string | null };
    }),
    acceptInvitation: (token: string) => rpc<{ credited_cents: number }>("accept_invitation", { p_token: token }),
    /** Suppression (§31) : Edge Function côté serveur ; réauth par jeton récent. */
    async deleteAccount(confirmation: "SUPPRIMER") {
      const { data, error } = await sb.functions.invoke("delete-account", { body: { confirmation } });
      if (error) throw toApiError(error);
      return data as { ok: boolean; code?: string };
    },
    async supportRequest(input: { category: "video_problem" | "payment" | "account" | "other"; message: string; projectId?: string; jobId?: string; versionId?: string }) {
      const { data, error } = await sb.rpc("create_support_request", {
        p_category: input.category, p_message: input.message, p_project_id: input.projectId ?? null,
        p_job_id: input.jobId ?? null, p_version_id: input.versionId ?? null,
        p_app_version: opts.appVersion, p_platform: opts.platform,
      });
      if (error) throw toApiError(error);
      return data as string;
    },
  };

  const wallet = {
    async balance(): Promise<WalletBalance> {
      const { data: u } = await sb.auth.getUser();
      return unwrap(await sb.from("wallet_balances").select("*").eq("user_id", u.user?.id ?? "").single()) as WalletBalance;
    },
    async history(limit = 30, before?: string): Promise<HistoryRowRaw[]> {
      let q = sb.from("wallet_history").select("*").order("created_at", { ascending: false }).limit(limit);
      if (before) q = q.lt("created_at", before);
      return unwrap(await q) as HistoryRowRaw[];
    },
    async payments(limit = 30): Promise<PaymentRow[]> {
      return unwrap(await sb.from("payments_public").select("*").order("created_at", { ascending: false }).limit(limit)) as PaymentRow[];
    },
    async paymentMethods(): Promise<PaymentMethodRow[]> {
      return unwrap(await sb.from("payment_methods").select("id,provider,brand,last4,exp_month,exp_year,is_default")) as PaymentMethodRow[];
    },
    async autoReload(): Promise<AutoReloadRule | null> {
      return unwrap(await sb.from("auto_reload_rules").select("*").maybeSingle()) as AutoReloadRule | null;
    },
    setAutoReload: (a: { enabled: boolean; thresholdCents: number; amountCents: number; monthlyCapCents: number; paymentMethodId: string | null }) =>
      rpc<{ rule_id: string; enabled: boolean }>("set_auto_reload", {
        p_enabled: a.enabled, p_threshold_cents: a.thresholdCents, p_amount_cents: a.amountCents,
        p_monthly_cap_cents: a.monthlyCapCents, p_payment_method_id: a.paymentMethodId,
      }),
    /** Mises à jour en direct du solde (Realtime ; RLS appliquée). */
    subscribe(userId: string, cb: () => void) {
      const ch = sb.channel(`wallet:${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${userId}` }, cb)
        .subscribe();
      return () => { void sb.removeChannel(ch); };
    },
  };

  const projects = {
    createDraft: async (input: { title?: string; mode?: "edit_rushes" | "autonomous"; organizationId?: string }) => {
      const { data, error } = await sb.rpc("create_draft_project", {
        p_title: input.title ?? "Sans titre", p_source_mode: input.mode ?? "edit_rushes", p_organization_id: input.organizationId ?? null,
      });
      if (error) throw toApiError(error);
      return data as string;
    },
    async list(o: { filter?: "all" | "active" | "done"; search?: string; limit?: number; before?: string } = {}): Promise<ProjectRow[]> {
      let q = sb.from("projects").select("*").neq("status", "draft").order("created_at", { ascending: false }).limit(o.limit ?? 24);
      if (o.filter === "active") q = q.eq("status", "processing");
      if (o.filter === "done") q = q.eq("status", "ready");
      if (o.before) q = q.lt("created_at", o.before);
      if (o.search?.trim()) q = q.ilike("title", `%${o.search.trim().replace(/[%_]/g, "")}%`);
      return unwrap(await q) as ProjectRow[];
    },
    async drafts(): Promise<ProjectRow[]> {
      return unwrap(await sb.from("projects").select("*").eq("status", "draft").order("created_at", { ascending: false }).limit(10)) as ProjectRow[];
    },
    async get(id: string): Promise<{ project: ProjectRow; versions: VersionRow[]; assets: AssetRow[]; jobs: JobRow[] }> {
      const [p, v, a, j] = await Promise.all([
        sb.from("projects").select("*").eq("id", id).single(),
        sb.from("project_versions").select("*").eq("project_id", id).order("version_number", { ascending: false }),
        sb.from("assets").select("*").eq("project_id", id).order("created_at"),
        sb.from("video_jobs").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      ]);
      return { project: unwrap(p) as ProjectRow, versions: unwrap(v) as VersionRow[], assets: unwrap(a) as AssetRow[], jobs: unwrap(j) as JobRow[] };
    },
    async activeJobs(): Promise<(JobRow & { project_title?: string })[]> {
      const jobs = unwrap(await sb.from("video_jobs").select("*").not("status", "in", "(completed,failed,cancelled)").order("created_at", { ascending: false })) as JobRow[];
      if (jobs.length === 0) return [];
      const ps = unwrap(await sb.from("projects").select("id,title").in("id", jobs.map((j) => j.project_id))) as { id: string; title: string }[];
      const titles = new Map(ps.map((p) => [p.id, p.title]));
      return jobs.map((j) => ({ ...j, project_title: titles.get(j.project_id) }));
    },
    rename: async (id: string, title: string) => { unwrap(await sb.rpc("rename_project", { p_project_id: id, p_title: title })); },
    duplicate: async (id: string) => unwrap(await sb.rpc("duplicate_project", { p_project_id: id })) as string,
    remove: (id: string) => rpc("delete_project", { p_project_id: id }),
    /** URL signée courte pour lecture / téléchargement. Les fichiers ne sont JAMAIS publics. */
    async signedUrl(bucket: "renders" | "thumbnails" | "raw", path: string, o: { expiresIn?: number; download?: string | boolean } = {}) {
      const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, o.expiresIn ?? 3600, o.download ? { download: o.download } : undefined);
      if (error || !data) throw toApiError(error ?? new Error("signed_url"));
      return data.signedUrl;
    },
    async signedUrls(bucket: "thumbnails", paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
      if (paths.length === 0) return {};
      const { data, error } = await sb.storage.from(bucket).createSignedUrls(paths, expiresIn);
      if (error) throw toApiError(error);
      return Object.fromEntries(
        (data ?? []).flatMap((d) => (d.signedUrl && d.path ? [[d.path, d.signedUrl] as [string, string]] : [])),
      );
    },
  };

  const assets = {
    register: (a: { projectId: string; kind: AssetRow["kind"]; filename: string; mimeType: string; sizeBytes: number; durationSec?: number | null }) =>
      rpc<{ asset_id: string; bucket: "raw"; path: string }>("register_asset", {
        p_project_id: a.projectId, p_kind: a.kind, p_filename: a.filename, p_mime_type: a.mimeType,
        p_size_bytes: a.sizeBytes, p_duration_sec: a.durationSec ?? null,
      }),
    complete: (assetId: string) => rpc("complete_asset", { p_asset_id: assetId }),
    remove: async (assetId: string) => { unwrap(await sb.rpc("delete_asset", { p_asset_id: assetId })); },
  };

  const jobs = {
    quote: (projectId: string, pricingRuleId: string | null, kind: "create" | "revision" = "create") =>
      rpc<QuoteOk>("quote_video_job", { p_project_id: projectId, p_pricing_rule_id: pricingRuleId, p_kind: kind }),
    submit: (a: { projectId: string; pricingRuleId: string; editingMethodId: string; aspectRatio?: string; instructions?: string | null; idempotencyKey: string }) =>
      rpc<SubmitJobOk>("submit_video_job", {
        p_project_id: a.projectId, p_pricing_rule_id: a.pricingRuleId, p_editing_method_id: a.editingMethodId,
        p_aspect_ratio: a.aspectRatio ?? "9:16", p_instructions: a.instructions ?? null, p_idempotency_key: a.idempotencyKey,
      }),
    submitRevision: (a: { projectId: string; parentVersionId: string; instructions: string; idempotencyKey: string }) =>
      rpc<SubmitJobOk>("submit_revision", {
        p_project_id: a.projectId, p_parent_version_id: a.parentVersionId, p_instructions: a.instructions, p_idempotency_key: a.idempotencyKey,
      }),
    cancel: (jobId: string) => rpc<{ status: string }>("cancel_video_job", { p_job_id: jobId }),
    async get(jobId: string): Promise<JobRow> {
      return unwrap(await sb.from("video_jobs").select("*").eq("id", jobId).single()) as JobRow;
    },
    /** Temps réel ; l'appelant doit AUSSI prévoir un polling de repli (Realtime peut être coupé). */
    subscribe(userId: string, cb: (job: JobRow) => void) {
      const ch = sb.channel(`jobs:${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "video_jobs", filter: `user_id=eq.${userId}` },
          (payload) => { if (payload.new && "id" in payload.new) cb(payload.new as JobRow); })
        .subscribe();
      return () => { void sb.removeChannel(ch); };
    },
  };

  const notifications = {
    async list(limit = 50): Promise<NotificationRow[]> {
      return unwrap(await sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(limit)) as NotificationRow[];
    },
    async unreadCount(): Promise<number> {
      const { count, error } = await sb.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
      if (error) throw toApiError(error);
      return count ?? 0;
    },
    async markRead(ids?: string[]) { unwrap(await sb.rpc("mark_notifications_read", { p_ids: ids ?? null })); },
    async registerPushToken(token: string) { unwrap(await sb.rpc("register_push_token", { p_token: token, p_platform: opts.platform })); },
    subscribe(userId: string, cb: (n: NotificationRow) => void) {
      const ch = sb.channel(`notifs:${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (p) => cb(p.new as NotificationRow))
        .subscribe();
      return () => { void sb.removeChannel(ch); };
    },
  };

  /** Appels aux Edge Functions de paiement (le serveur reste l'autorité ; jamais de crédit côté client). */
  const payments = {
    async createCheckout(a: { amountCents: number; returnUrl: string; idempotencyKey: string }) {
      const { data, error } = await sb.functions.invoke("create-topup-checkout", { body: a });
      if (error) throw toApiError(error);
      return data as { ok: true; url: string; payment_id: string } | { ok: false; code: string };
    },
    async createCardSetup(a: { returnUrl: string }) {
      const { data, error } = await sb.functions.invoke("create-card-setup", { body: a });
      if (error) throw toApiError(error);
      return data as { ok: true; url: string } | { ok: false; code: string };
    },
    async verifyStorePurchase(a: { store: "apple" | "google"; productId: string; transactionId?: string; purchaseToken?: string; signedTransaction?: string }) {
      const { data, error } = await sb.functions.invoke("verify-store-purchase", { body: a });
      if (error) throw toApiError(error);
      return data as { ok: true; credited_cents: number; payment_id: string } | { ok: false; code: string };
    },
  };

  return { auth, config, account, wallet, projects, assets, jobs, notifications, payments, rpc };
}

export type Api = ReturnType<typeof createApi>;
export { ApiError };
