import { describe, expect, it } from "vitest";
import { fakeDb } from "./helpers";
import { fetchDashboard, decodeDashboard } from "../src/data/dashboard";
import { listCustomers, fetchCustomerDetail, setUserStatus, addNote, decodeCustomerDetail, customerDisplayName } from "../src/data/customers";
import { adjustWallet } from "../src/data/wallet";
import { canRefund, canRetry, decodeJobDetail, fetchJobDetail, listJobs, refundJob, retryJob } from "../src/data/jobs";
import { createClientInvitation, listInvitations, revokeInvitation, INVITATION_COLUMNS, decodeInvitationRow } from "../src/data/invitations";
import { changePrice, listPricingRules, setSetting } from "../src/data/config";
import { listAuditLogs, EMPTY_AUDIT_FILTER } from "../src/data/audit";
import { listPayments, listWebhooks } from "../src/data/payments";
import { listSupportRequests, countOpenSupportRequests, updateSupportRequest } from "../src/data/support";
import { decodeStaffRole, fetchStaffRole, canWrite, requestOtp, confirmOtp } from "../src/data/auth";
import { refundedJobIds, decodeLedgerRow } from "../src/data/ledger";
import { createSupabaseDb, likePattern } from "../src/data/db";
import { AdminError } from "../src/lib/errors";
import { pageRequest } from "../src/lib/pagination";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("dashboard", () => {
  it("décode admin_dashboard (cents + µ€) sans rien inventer", async () => {
    const db = fakeDb({ rpc: { admin_dashboard: { revenue_today_cents: 1200, revenue_month_cents: "34000", engine_cost_month_micro: 4_200_000, gross_margin_month_cents: 900, jobs_active: 3 } } });
    const d = await fetchDashboard(db);
    expect(db.rpcCalls[0]).toEqual({ fn: "admin_dashboard", args: { p_tz: "Europe/Paris" } });
    expect(d.revenueTodayCents).toBe(1200);
    expect(d.revenueMonthCents).toBe(34000);
    expect(d.engineCostMonthMicro).toBe(4_200_000);
    expect(d.jobsActive).toBe(3);
    expect(d.refundedMonthCents).toBe(0);
  });
  it("réponse vide → zéros", () => {
    expect(decodeDashboard(null).customersTotal).toBe(0);
  });
});

describe("clients", () => {
  it("pagine avec size+1 et transmet la recherche", async () => {
    const rows = Array.from({ length: 26 }, (_, i) => ({ id: `u${i}`, name: " Ana ", email: "a@x.fr", company: null, status: "active", wallet_id: "w", available_cents: 1500, spent_cents: 400, video_count: 2, last_activity: null, created_at: "2026-01-01T00:00:00Z" }));
    const db = fakeDb({ rpc: { admin_customers: rows } });
    const page = await listCustomers(db, "  ana ", pageRequest(0));
    expect(db.rpcCalls[0]?.args).toEqual({ p_search: "ana", p_limit: 26, p_offset: 0 });
    expect(page.rows).toHaveLength(25);
    expect(page.hasNext).toBe(true);
    expect(page.rows[0]).toMatchObject({ name: "Ana", availableCents: 1500, spentCents: 400, videoCount: 2 });
    await listCustomers(db, "", pageRequest(2));
    expect(db.rpcCalls[1]?.args).toEqual({ p_search: null, p_limit: 26, p_offset: 50 });
  });

  const detailRaw = {
    profile: { id: UUID, email: "a@x.fr", first_name: "Ana", last_name: "Lopez", company: "ACME", status: "active", locale: "fr", created_at: "2026-01-01T00:00:00Z" },
    wallet: { id: "w1", balance_cents: 5000, held_cents: 1000, status: "active" },
    transactions: [{ id: "t1", type: "refund", amount_cents: 484, available_delta_cents: 484, job_id: "j1", metadata: { admin_reason: "geste" }, created_at: "2026-01-02T00:00:00Z" }],
    payments: [{ id: "p1", provider: "stripe", kind: "topup", amount_cents: 2000, status: "failed", failure_code: "card_declined" }],
    projects: [{ id: "pr1", title: "Vidéo", status: "ready", source_mode: "edit_rushes" }],
    jobs: [{ id: "j1", status: "completed", kind: "create", price_cents: 484, total_actual_cost_micro: 120_000, gross_margin_cents: 472, revenue_cents: 484 }],
    totals: { revenue_cents: 484, cost_micro: 120_000, margin_cents: 472 },
    notes: [{ id: "n1", author_id: "a1", note: "RAS", created_at: "2026-01-03T00:00:00Z" }],
    support_requests: [{ id: "s1", category: "payment", message: "Bonjour", status: "open", job_id: "j1" }],
  };

  it("décode la fiche client", async () => {
    const db = fakeDb({ rpc: { admin_customer_detail: detailRaw } });
    const d = await fetchCustomerDetail(db, UUID);
    expect(db.rpcCalls[0]).toEqual({ fn: "admin_customer_detail", args: { p_user_id: UUID } });
    expect(d.wallet).toEqual({ id: "w1", balanceCents: 5000, heldCents: 1000, status: "active" });
    expect(d.jobs[0]).toMatchObject({ priceCents: 484, revenueCents: 484, costMicro: 120_000, marginCents: 472 });
    expect(d.payments[0]).toMatchObject({ status: "failed", failureCode: "card_declined" });
    expect(d.supportRequests[0]).toMatchObject({ category: "payment", jobId: "j1" });
    expect(customerDisplayName(d.profile)).toBe("Ana Lopez");
    expect(refundedJobIds(d.transactions).has("j1")).toBe(true);
  });
  it("client introuvable → AdminError user_not_found", async () => {
    const db = fakeDb({ rpc: { admin_customer_detail: { profile: null, wallet: null } } });
    await expect(fetchCustomerDetail(db, UUID)).rejects.toMatchObject({ code: "user_not_found" });
    expect(decodeCustomerDetail({})).toBeNull();
  });
  it("suspension et notes passent par les RPC admin", async () => {
    const db = fakeDb({ rpc: { admin_set_user_status: null, admin_add_note: null } });
    await setUserStatus(db, UUID, "suspended", "  fraude suspectée ");
    await addNote(db, UUID, " rappel client ");
    expect(db.rpcCalls[0]).toEqual({ fn: "admin_set_user_status", args: { p_user_id: UUID, p_status: "suspended", p_reason: "fraude suspectée" } });
    expect(db.rpcCalls[1]).toEqual({ fn: "admin_add_note", args: { p_user_id: UUID, p_note: "rappel client" } });
  });
  it("CA du job lu directement (revenue_cents), null si absent", () => {
    const d = decodeCustomerDetail({ ...detailRaw, jobs: [{ id: "j2", status: "failed", price_cents: 700 }] });
    expect(d?.jobs[0]?.revenueCents).toBeNull();
  });
});

describe("portefeuille (admin_adjust_wallet)", () => {
  it("envoie centimes entiers, motif nettoyé et clé d'idempotence", async () => {
    const db = fakeDb({ rpc: { admin_adjust_wallet: { ok: true, transaction_id: "tx1", balance_after_cents: 7500 } } });
    const r = await adjustWallet(db, { walletId: "w1", kind: "promotion", amountCents: 2500, reason: " offre de bienvenue ", idempotencyKey: "adm-abcdef12" });
    expect(db.rpcCalls[0]).toEqual({
      fn: "admin_adjust_wallet",
      args: { p_wallet_id: "w1", p_kind: "promotion", p_amount_cents: 2500, p_reason: "offre de bienvenue", p_idempotency_key: "adm-abcdef12" },
    });
    expect(r).toEqual({ transactionId: "tx1", balanceAfterCents: 7500, replayed: false });
  });
  it("rejeu idempotent signalé", async () => {
    const db = fakeDb({ rpc: { admin_adjust_wallet: { ok: true, replayed: true, transaction_id: "tx1", balance_after_cents: 7500 } } });
    expect((await adjustWallet(db, { walletId: "w", kind: "bonus", amountCents: 100, reason: "motif ok", idempotencyKey: "adm-12345678" })).replayed).toBe(true);
  });
  it("refuse montant flottant, nul ou clé trop courte AVANT tout appel serveur", async () => {
    const db = fakeDb({ rpc: { admin_adjust_wallet: {} } });
    await expect(adjustWallet(db, { walletId: "w", kind: "bonus", amountCents: 12.5, reason: "motif ok", idempotencyKey: "adm-12345678" })).rejects.toBeInstanceOf(AdminError);
    await expect(adjustWallet(db, { walletId: "w", kind: "bonus", amountCents: 0, reason: "motif ok", idempotencyKey: "adm-12345678" })).rejects.toBeInstanceOf(AdminError);
    await expect(adjustWallet(db, { walletId: "w", kind: "bonus", amountCents: 100, reason: "motif ok", idempotencyKey: "abc" })).rejects.toMatchObject({ code: "idempotency_key_required" });
    expect(db.rpcCalls).toHaveLength(0);
  });
});

describe("jobs", () => {
  it("filtre par statut (null = tous) et pagine", async () => {
    const db = fakeDb({ rpc: { admin_list_jobs: [{ id: "j1", status: "failed", price_cents: 484, user_id: "u", email: "a@x.fr", total_actual_cost_micro: null, gross_margin_cents: null, created_at: "2026-01-01T00:00:00Z" }] } });
    const p = await listJobs(db, "failed", pageRequest(0, 5));
    expect(db.rpcCalls[0]?.args).toEqual({ p_status: "failed", p_limit: 6, p_offset: 0 });
    expect(p.rows[0]).toMatchObject({ status: "failed", costMicro: null, marginCents: null });
    await listJobs(db, "", pageRequest(0, 5));
    expect(db.rpcCalls[1]?.args.p_status).toBeNull();
  });

  const detailRaw = {
    job: { id: "j1", correlation_id: "c1", status: "failed", kind: "create", price_cents: 484, user_id: "u1", project_id: "p1", wallet_id: "w1", error_code: "render_failed", attempt_count: 3, max_attempts: 3 },
    internals: { job_id: "j1", engine_version: "1.0", error_message_internal: "ffmpeg exit 1", input_manifest: { files: 2 } },
    costs: { id: "c", transcription_cost_micro: 1000, llm_cost_micro: 2000, total_actual_cost_micro: 3000, revenue_cents: 484, gross_margin_cents: 483 },
    events: [{ id: 2, correlation_id: "c1", source: "engine", level: "error", message: "boom", data: { a: 1 }, created_at: "2026-01-01T00:00:00Z" }],
    transactions: [{ id: "t1", type: "hold", amount_cents: 484, available_delta_cents: -484, created_at: "2026-01-01T00:00:00Z" }],
  };

  it("décode le détail (timeline, internals, coûts par catégorie, transactions)", async () => {
    const db = fakeDb({ rpc: { admin_job_detail: detailRaw } });
    const d = await fetchJobDetail(db, "j1");
    expect(d.events[0]).toMatchObject({ level: "error", correlationId: "c1" });
    expect(d.internals?.errorMessageInternal).toBe("ffmpeg exit 1");
    expect(d.costs?.categories).toHaveLength(8);
    expect(d.costs?.categories.find((c) => c.key === "llm_cost_micro")?.micro).toBe(2000);
    expect(d.costs?.totalMicro).toBe(3000);
    expect(d.transactions[0]?.type).toBe("hold");
  });
  it("job sans coûts ni internals", () => {
    const d = decodeJobDetail({ job: { id: "j", status: "queued" }, internals: null, costs: null, events: [], transactions: [] });
    expect(d?.costs).toBeNull();
    expect(d?.internals).toBeNull();
  });
  it("job introuvable", async () => {
    const db = fakeDb({ rpc: { admin_job_detail: null } });
    await expect(fetchJobDetail(db, "x")).rejects.toMatchObject({ code: "job_not_found" });
  });

  it("relance uniquement pour un job en échec", () => {
    expect(canRetry("failed")).toBe(true);
    for (const s of ["completed", "queued", "rendering", "cancelled", "created"]) expect(canRetry(s)).toBe(false);
  });
  it("remboursable : terminé, payant, pas déjà remboursé", () => {
    const refundTx = decodeLedgerRow({ id: "t", type: "refund", job_id: "j" });
    expect(canRefund({ status: "completed", priceCents: 484 }, [])).toBe(true);
    expect(canRefund({ status: "completed", priceCents: 0 }, [])).toBe(false);
    expect(canRefund({ status: "failed", priceCents: 484 }, [])).toBe(false);
    expect(canRefund({ status: "completed", priceCents: 484 }, [refundTx])).toBe(false);
  });

  it("retry : succès, solde insuffisant (manque en centimes), non éligible", async () => {
    const db = fakeDb({ rpcFn: { admin_retry_job: (a) => (a.p_job_id === "ok" ? { ok: true } : a.p_job_id === "poor" ? { ok: false, code: "insufficient_funds", shortfall_cents: 250 } : { ok: false, code: "not_retryable" }) } });
    expect(await retryJob(db, "ok", " panne moteur ")).toEqual({ ok: true });
    expect(db.rpcCalls[0]?.args).toEqual({ p_job_id: "ok", p_reason: "panne moteur" });
    expect(await retryJob(db, "poor", "motif ok")).toEqual({ ok: false, code: "insufficient_funds", shortfallCents: 250 });
    expect(await retryJob(db, "x", "motif ok")).toEqual({ ok: false, code: "not_retryable" });
  });
  it("remboursement : clé d'idempotence obligatoire, résultats typés", async () => {
    const db = fakeDb({ rpcFn: { admin_refund_job: (a) => (a.p_job_id === "ok" ? { ok: true, transaction_id: "tx" } : { ok: false, code: "nothing_to_refund" }) } });
    expect(await refundJob(db, "ok", " geste ", "admref-12345678")).toEqual({ ok: true, transactionId: "tx", replayed: false });
    expect(db.rpcCalls[0]?.args).toEqual({ p_job_id: "ok", p_reason: "geste", p_idempotency_key: "admref-12345678" });
    expect(await refundJob(db, "no", "motif ok", "admref-12345678")).toEqual({ ok: false, code: "nothing_to_refund" });
    await expect(refundJob(db, "ok", "motif ok", "x")).rejects.toMatchObject({ code: "idempotency_key_required" });
  });
});

describe("invitations et ventes", () => {
  const payload = {
    clientName: "Jeanne", email: "j@x.fr", company: null, sourceName: "Salon", campaign: null, salesperson: "Paul",
    dealRef: "D-1", paidCents: 10000, giftedCents: 500, notes: null, expiresDays: 14,
  };
  it("appelle admin_create_client_invitation avec les 11 paramètres et renvoie le jeton", async () => {
    const db = fakeDb({ rpc: { admin_create_client_invitation: { ok: true, deal_id: "d1", invitation_id: "i1", token: "tok_ABC-123" } } });
    const r = await createClientInvitation(db, payload);
    expect(Object.keys(db.rpcCalls[0]?.args ?? {}).sort()).toEqual([
      "p_campaign", "p_client_name", "p_company", "p_deal_ref", "p_email", "p_expires_days", "p_gifted_credit_cents",
      "p_notes", "p_paid_cents", "p_salesperson", "p_source_name",
    ]);
    expect(db.rpcCalls[0]?.args).toMatchObject({ p_paid_cents: 10000, p_gifted_credit_cents: 500, p_expires_days: 14 });
    expect(r).toEqual({ dealId: "d1", invitationId: "i1", token: "tok_ABC-123" });
  });
  it("réponse sans jeton = erreur (jamais de faux lien)", async () => {
    const db = fakeDb({ rpc: { admin_create_client_invitation: { ok: true, deal_id: "d1" } } });
    await expect(createClientInvitation(db, payload)).rejects.toBeInstanceOf(AdminError);
  });
  it("révocation", async () => {
    const db = fakeDb({ rpc: { admin_revoke_invitation: null } });
    await revokeInvitation(db, "i1");
    expect(db.rpcCalls[0]).toEqual({ fn: "admin_revoke_invitation", args: { p_invitation_id: "i1" } });
  });
  it("la liste ne demande jamais token_hash et décode le deal embarqué", async () => {
    expect(INVITATION_COLUMNS).not.toContain("token_hash");
    const db = fakeDb({ select: { invitations: { rows: [{ id: "i1", status: "pending", email: "j@x.fr", credit_cents: 10500, expires_at: "2026-02-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z", commercial_deals: { deal_ref: "D-1", client_name: "Jeanne", paid_cents: 10000, gifted_credit_cents: 500, status: "pending", sales_sources: { name: "Salon", campaign: null, salesperson: "Paul" } } }], count: null } } });
    const p = await listInvitations(db, pageRequest(0));
    expect(db.selectCalls[0]?.columns).toBe(INVITATION_COLUMNS);
    expect(p.rows[0]?.deal).toMatchObject({ ref: "D-1", paidCents: 10000, giftedCents: 500, source: "Salon", salesperson: "Paul" });
    expect(decodeInvitationRow({ id: "x", commercial_deals: [] }).deal).toBeNull();
  });
});

describe("tarifs et réglages", () => {
  it("changement de prix via admin_change_price (centimes entiers)", async () => {
    const db = fakeDb({ rpc: { admin_change_price: "new-rule-id" } });
    expect(await changePrice(db, "r1", 500, " hausse annuelle ")).toBe("new-rule-id");
    expect(db.rpcCalls[0]).toEqual({ fn: "admin_change_price", args: { p_rule_id: "r1", p_price_cents: 500, p_reason: "hausse annuelle" } });
  });
  it("réglage via admin_set_setting avec valeur JSON", async () => {
    const db = fakeDb({ rpc: { admin_set_setting: null } });
    await setSetting(db, "maintenance.enabled", true, "migration base");
    expect(db.rpcCalls[0]).toEqual({ fn: "admin_set_setting", args: { p_key: "maintenance.enabled", p_value: true, p_reason: "migration base" } });
  });
  it("liste des règles", async () => {
    const db = fakeDb({ select: { pricing_rules: { rows: [{ id: "r1", mode: "edit_rushes", bucket_key: "lt_30s", label: "Moins de 30 s", duration_min_sec: 0, duration_max_sec: 30, price_cents: 242, active: true, effective_from: "2026-01-01T00:00:00Z", effective_to: null, sort_order: 1 }], count: null } } });
    const rules = await listPricingRules(db);
    expect(rules[0]).toMatchObject({ priceCents: 242, effectiveTo: null, durationMaxSec: 30 });
  });
});

describe("audit, paiements, webhooks, support", () => {
  it("audit : filtres entité / acteur / action (ILIKE échappé) / entité id", async () => {
    const db = fakeDb({ select: { audit_logs: { rows: [{ id: 9, actor_id: "a", actor_role: "admin", action: "wallet.bonus", entity: "wallet", entity_id: "w", before_data: { balance_cents: 0 }, after_data: { balance_cents: 100 }, reason: "geste", created_at: "2026-01-01T00:00:00Z" }], count: null } } });
    const p = await listAuditLogs(db, { entity: "wallet", actorId: UUID, action: "100%_x", entityId: "w" }, pageRequest(1));
    const q = db.selectCalls[0];
    expect(q?.eq).toEqual({ entity: "wallet", actor_id: UUID, entity_id: "w" });
    expect(q?.ilike).toEqual([{ column: "action", pattern: "%100\\%\\_x%" }]);
    expect(q?.order).toEqual([{ column: "id", ascending: false }]);
    expect(q?.offset).toBe(25);
    expect(p.rows[0]).toMatchObject({ id: 9, action: "wallet.bonus", reason: "geste" });
    await listAuditLogs(db, EMPTY_AUDIT_FILTER, pageRequest(0));
    expect(db.selectCalls[1]?.eq).toEqual({});
    expect(db.selectCalls[1]?.ilike).toEqual([]);
  });
  it("paiements et webhooks : filtres → eq", async () => {
    const db = fakeDb({ select: { payments: { rows: [], count: null }, webhook_events: { rows: [{ id: "w", provider: "stripe", event_id: "evt_1", event_type: "payment_intent.succeeded", status: "failed", attempts: 3, error: "boom", received_at: "2026-01-01T00:00:00Z" }], count: null } } });
    await listPayments(db, "failed", pageRequest(0));
    expect(db.selectCalls[0]?.eq).toEqual({ status: "failed" });
    const w = await listWebhooks(db, { status: "failed", provider: "stripe" }, pageRequest(0));
    expect(db.selectCalls[1]?.eq).toEqual({ status: "failed", provider: "stripe" });
    expect(w.rows[0]).toMatchObject({ attempts: 3, error: "boom", status: "failed" });
  });
  it("support : lecture seule, filtres et compteur", async () => {
    const db = fakeDb({ select: { support_requests: (q) => ({ rows: q.count ? [] : [{ id: "s1", message: "Aide", category: "video_problem", status: "open", project_id: "p", job_id: "j", version_id: "v", app_version: "1.2.0", platform: "ios", created_at: "2026-01-01T00:00:00Z" }], count: q.count ? 4 : null }) } });
    const p = await listSupportRequests(db, { status: "open", category: "" }, pageRequest(0));
    expect(db.selectCalls[0]?.eq).toEqual({ status: "open" });
    expect(p.rows[0]).toMatchObject({ projectId: "p", jobId: "j", versionId: "v", appVersion: "1.2.0", platform: "ios" });
    expect(await countOpenSupportRequests(db)).toBe(4);
  });
  it("mise à jour d'une demande : RPC admin_update_support_request, note vide → null", async () => {
    const db = fakeDb({ rpc: { admin_update_support_request: null } });
    await updateSupportRequest(db, "s1", "in_progress", "  rappel client  ");
    await updateSupportRequest(db, "s1", "resolved", "   ");
    await updateSupportRequest(db, "s1", "open", null);
    expect(db.rpcCalls[0]).toEqual({ fn: "admin_update_support_request", args: { p_id: "s1", p_status: "in_progress", p_staff_notes: "rappel client" } });
    expect(db.rpcCalls[1]?.args.p_staff_notes).toBeNull();
    expect(db.rpcCalls[2]?.args).toEqual({ p_id: "s1", p_status: "open", p_staff_notes: null });
  });
});

describe("authentification et rôle staff", () => {
  it("décode le rôle ; seuls support/admin existent", () => {
    expect(decodeStaffRole({ role: "admin" })).toBe("admin");
    expect(decodeStaffRole({ role: "support" })).toBe("support");
    expect(decodeStaffRole({ role: "owner" })).toBeNull();
    expect(decodeStaffRole(undefined)).toBeNull();
  });
  it("lit sa propre ligne de staff_roles ; absent → null (Accès réservé)", async () => {
    const db = fakeDb({ select: { staff_roles: { rows: [], count: null } } });
    expect(await fetchStaffRole(db, UUID)).toBeNull();
    expect(db.selectCalls[0]).toMatchObject({ table: "staff_roles", eq: { user_id: UUID } });
  });
  it("seul l'admin peut écrire", () => {
    expect(canWrite("admin")).toBe(true);
    expect(canWrite("support")).toBe(false);
    expect(canWrite(null)).toBe(false);
  });
  it("OTP : shouldCreateUser:false, e-mail normalisé, verifyOtp type email", async () => {
    const calls: unknown[] = [];
    const auth = {
      async signInWithOtp(a: unknown) { calls.push(["send", a]); return { error: null }; },
      async verifyOtp(a: unknown) { calls.push(["verify", a]); return { error: null }; },
      async signOut() { return { error: null }; },
    };
    await requestOtp(auth, "  Staff@Example.com ");
    await confirmOtp(auth, "Staff@Example.com", "123456");
    expect(calls).toEqual([
      ["send", { email: "staff@example.com", options: { shouldCreateUser: false } }],
      ["verify", { email: "staff@example.com", token: "123456", type: "email" }],
    ]);
  });
  it("erreur OTP propagée", async () => {
    const auth = {
      async signInWithOtp() { return { error: { message: "rate limit", status: 429 } }; },
      async verifyOtp() { return { error: { message: "invalid" } }; },
      async signOut() { return { error: null }; },
    };
    await expect(requestOtp(auth, "a@b.fr")).rejects.toMatchObject({ status: 429 });
    await expect(confirmOtp(auth, "a@b.fr", "000000")).rejects.toMatchObject({ message: "invalid" });
  });
});

describe("adaptateur supabase", () => {
  it("likePattern échappe % _ \\", () => {
    expect(likePattern(" a%b_c\\d ")).toBe("%a\\%b\\_c\\\\d%");
  });
  it("rpc : l'erreur serveur devient une AdminError au code stable (pas de message SQL brut)", async () => {
    interface FakeClient { rpc: (fn: string, args: object) => Promise<{ data: unknown; error: { message: string; code: string } | null }>; from: () => never }
    const client: FakeClient = { rpc: async () => ({ data: null, error: { message: "reason_required", code: "22023" } }), from: () => { throw new Error("non utilisé"); } };
    const db = createSupabaseDb(client as unknown as Parameters<typeof createSupabaseDb>[0]);
    await expect(db.rpc("admin_set_user_status", {})).rejects.toMatchObject({ name: "AdminError", code: "reason_required" });
  });
  it("select : construit eq / ilike / order / range / count", async () => {
    const ops: string[] = [];
    const builder = {
      eq(c: string, v: unknown) { ops.push(`eq:${c}=${String(v)}`); return builder; },
      ilike(c: string, p: string) { ops.push(`ilike:${c}=${p}`); return builder; },
      order(c: string, o: { ascending: boolean }) { ops.push(`order:${c}:${o.ascending}`); return builder; },
      range(a: number, b: number) { ops.push(`range:${a}-${b}`); return builder; },
      then(res: (v: { data: unknown[]; error: null; count: number }) => void) { res({ data: [{ id: 1 }], error: null, count: 7 }); },
    };
    const client = { from: (t: string) => ({ select: (cols: string, o: unknown) => { ops.push(`from:${t}:${cols}:${JSON.stringify(o)}`); return builder; } }) };
    const db = createSupabaseDb(client as unknown as Parameters<typeof createSupabaseDb>[0]);
    const r = await db.select({ table: "payments", columns: "id", eq: { status: "failed" }, ilike: [{ column: "x", pattern: "%a%" }], order: [{ column: "created_at", ascending: false }], limit: 26, offset: 25, count: true });
    expect(ops).toEqual(['from:payments:id:{"count":"exact"}', "eq:status=failed", "ilike:x=%a%", "order:created_at:false", "range:25-50"]);
    expect(r).toEqual({ rows: [{ id: 1 }], count: 7 });
  });
});

describe("ledger", () => {
  it("décode une écriture et ses métadonnées", () => {
    const r = decodeLedgerRow({ id: "t", type: "manual_adjustment", amount_cents: -500, available_delta_cents: -500, balance_before_cents: 1000, balance_after_cents: 500, metadata: { admin_reason: "erreur" }, created_at: "2026-01-01T00:00:00Z" });
    expect(r).toMatchObject({ amountCents: -500, balanceAfterCents: 500, metadata: { admin_reason: "erreur" } });
  });
});
