import { beforeAll, describe, expect, it } from "vitest";
import { admin, anon, createTenant, loadEnv } from "../support/local-supabase";

/**
 * Isolation entre entreprises, vérifiée contre la vraie base (Supabase local) :
 * l'entreprise B tente de lire, modifier, supprimer et référencer les données
 * de l'entreprise A, table par table, puis dans le stockage.
 */

loadEnv();

type Tenant = Awaited<ReturnType<typeof createTenant>>;
let A: Tenant;
let B: Tenant;
const ids: Record<string, string> = {};

beforeAll(async () => {
  A = await createTenant("a");
  B = await createTenant("b");
  const db = A.client;
  const project = await db.from("projects").insert({ name: "Chantier secret A" }).select("id").single();
  ids.project = project.data!.id;
  const doc = await db
    .from("project_documents")
    .insert({ project_id: ids.project, file_name: "dpgf.xlsx", storage_path: `${A.orgId}/${ids.project}/source/x-dpgf.xlsx`, size_bytes: 10 })
    .select("id")
    .single();
  ids.document = doc.data!.id;
  const line = await db.from("project_lines").insert({ project_id: ids.project, designation: "Radiateur secret", quantity: 3 }).select("id").single();
  ids.line = line.data!.id;
  const supplier = await db.from("suppliers").insert({ company_name: "Fournisseur A", email: "fa@example.com" }).select("id").single();
  ids.supplier = supplier.data!.id;
  const consultation = await db
    .from("consultations")
    .insert({ project_id: ids.project, supplier_id: ids.supplier, reference_code: `PC-${Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "X")}` })
    .select("id")
    .single();
  ids.consultation = consultation.data!.id;
  await db.from("consultation_lines").insert({ consultation_id: ids.consultation, project_line_id: ids.line });
  const offer = await db
    .from("offers")
    .insert({ project_id: ids.project, consultation_id: ids.consultation, supplier_id: ids.supplier, total_ht: 1234 })
    .select("id")
    .single();
  ids.offer = offer.data!.id;
  await db.from("offer_lines").insert({ offer_id: ids.offer, project_line_id: ids.line, unit_price: 411.33 });
  await db.from("activity_logs").insert({ project_id: ids.project, type: "test", message: "secret" });
  // Données écrites par le serveur (clé service) : e-mails, connexions, relances.
  const conn = await admin()
    .from("mail_connections")
    .insert({ organization_id: A.orgId, user_id: A.userId, provider: "google", email: A.email, access_token_enc: "v1:SECRET", refresh_token_enc: "v1:SECRET" })
    .select("id")
    .single();
  ids.connection = conn.data!.id;
  await admin().from("email_messages").insert({
    organization_id: A.orgId,
    mail_connection_id: ids.connection,
    project_id: ids.project,
    consultation_id: ids.consultation,
    direction: "inbound",
    kind: "reply",
    provider_message_id: `m-${Date.now()}`,
    body_text: "prix confidentiels",
  });
  await admin().from("scheduled_followups").insert({ organization_id: A.orgId, consultation_id: ids.consultation, attempt: 1, due_at: new Date().toISOString() });
  await admin().storage.from("files").upload(`${A.orgId}/${ids.project}/source/x-dpgf.xlsx`, Buffer.from("PK\u0003\u0004secret"), { contentType: "application/octet-stream" });
});

const TABLES = [
  "organizations",
  "users",
  "projects",
  "project_documents",
  "project_lines",
  "suppliers",
  "consultations",
  "consultation_lines",
  "offers",
  "offer_lines",
  "activity_logs",
  "email_messages",
  "scheduled_followups",
  "supplier_responses",
  "project_overview",
] as const;

describe("isolation des données entre entreprises (RLS)", () => {
  it("A voit ses propres données", async () => {
    const { data } = await A.client.from("projects").select("id, name");
    expect(data?.map((p) => p.name)).toContain("Chantier secret A");
    const { data: overview } = await A.client.from("project_overview").select("id, status").eq("id", ids.project).single();
    expect(overview?.status).toBe("preparation");
  });

  it.each(TABLES)("B ne lit aucune ligne de A dans %s", async (table) => {
    const { data, error } = await B.client.from(table as "projects").select("*");
    expect(error).toBeNull();
    const leaked = (data ?? []).filter((row) => JSON.stringify(row).includes(A.orgId) || JSON.stringify(row).includes("secret"));
    expect(leaked).toEqual([]);
  });

  it("B ne peut ni modifier ni supprimer les données de A", async () => {
    for (const [table, id] of [
      ["projects", ids.project],
      ["project_lines", ids.line],
      ["suppliers", ids.supplier],
      ["consultations", ids.consultation],
      ["offers", ids.offer],
    ] as const) {
      const upd = await B.client.from(table).update({ created_at: new Date().toISOString() }).eq("id", id).select("id");
      expect(upd.data ?? []).toEqual([]);
      const del = await B.client.from(table).delete().eq("id", id).select("id");
      expect(del.data ?? []).toEqual([]);
    }
    const { data } = await admin().from("projects").select("id").eq("id", ids.project);
    expect(data).toHaveLength(1);
  });

  it("B ne peut pas écrire dans l'entreprise de A ni référencer ses données", async () => {
    const spoof = await B.client.from("projects").insert({ name: "intrusion", organization_id: A.orgId });
    expect(spoof.error).not.toBeNull();
    // Clés étrangères composites : une consultation de B ne peut pas pointer sur le dossier de A.
    const supplierB = await B.client.from("suppliers").insert({ company_name: "Fournisseur B", email: "fb@example.com" }).select("id").single();
    const crossRef = await B.client.from("consultations").insert({ project_id: ids.project, supplier_id: supplierB.data!.id, reference_code: "PC-ZZZZZZ" });
    expect(crossRef.error).not.toBeNull();
    const projectB = await B.client.from("projects").insert({ name: "Chantier B" }).select("id").single();
    const crossLine = await B.client.from("project_lines").insert({ project_id: projectB.data!.id, document_id: ids.document, designation: "x" });
    expect(crossLine.error).not.toBeNull();
  });

  it("les jetons OAuth ne sont jamais lisibles côté client, même par leur propriétaire", async () => {
    const own = await A.client.from("mail_connections").select("access_token_enc");
    expect(own.error).not.toBeNull();
    const safe = await A.client.from("mail_connections").select("id, email, status");
    expect(safe.data).toHaveLength(1);
    const other = await B.client.from("mail_connections").select("id");
    expect(other.data).toEqual([]);
  });

  it("les fonctions serveur (file de tâches, rate limit) sont inaccessibles aux clients", async () => {
    expect((await B.client.rpc("claim_jobs", { p_limit: 10 })).error).not.toBeNull();
    expect((await B.client.rpc("rate_limit_hit", { p_key: "x", p_window_seconds: 60, p_max: 1 })).error).not.toBeNull();
    expect((await B.client.from("jobs").select("*")).data ?? []).toEqual([]);
  });

  it("le stockage est cloisonné par entreprise et jamais public", async () => {
    const path = `${A.orgId}/${ids.project}/source/x-dpgf.xlsx`;
    const own = await A.client.storage.from("files").download(path);
    expect(own.error).toBeNull();
    const stolen = await B.client.storage.from("files").download(path);
    expect(stolen.error).not.toBeNull();
    const signed = await B.client.storage.from("files").createSignedUrl(path, 60);
    expect(signed.error).not.toBeNull();
    const upload = await B.client.storage.from("files").upload(`${A.orgId}/${ids.project}/source/intrus.pdf`, Buffer.from("%PDF-1.4"));
    expect(upload.error).not.toBeNull();
    const { data: bucket } = await admin().storage.getBucket("files");
    expect(bucket?.public).toBe(false);
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/files/${path}`);
    expect(res.ok).toBe(false);
  });

  it("un visiteur anonyme ne voit rien", async () => {
    for (const table of TABLES) {
      const { data } = await anon().from(table as "projects").select("*").limit(1);
      expect(data ?? []).toEqual([]);
    }
  });

  it("un utilisateur ne peut pas créer une seconde entreprise ni rejoindre celle d'un autre", async () => {
    const again = await B.client.rpc("create_organization", { p_name: "Autre" });
    expect(again.error).not.toBeNull();
    const join = await B.client.from("users").update({ full_name: "x" }).eq("id", A.userId).select("id");
    expect(join.data ?? []).toEqual([]);
  });
});
