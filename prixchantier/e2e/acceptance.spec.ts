import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { MAILBOX_DIR } from "../playwright.config";

/**
 * Scénario d'acceptance complet, dans le navigateur, sur le build de production.
 * Simulé : la boîte mail (boîte de test sur disque) et l'API OpenAI (faux
 * serveur HTTP). Tout le reste est réel : Supabase (Auth, Postgres, RLS,
 * Storage), file de tâches, parsing, rapprochement, comparatif, export.
 */

const stamp = Date.now();
const user = { company: "Clim Services Test", name: "Camille Chiffreuse", email: `chiffreur-${stamp}@test.local`, password: "motdepasse-e2e-123" };
const suppliers = [
  { name: "Fournisseur A", email: `a-${stamp}@fournisseur.test` },
  { name: "Fournisseur B", email: `b-${stamp}@fournisseur.test` },
  { name: "Fournisseur C", email: `c-${stamp}@fournisseur.test` },
];
const fixture = (n: string) => join(__dirname, "../tests/fixtures/files", n);
let projectUrl = "";

/** Captures d'écran pour relecture visuelle (SCREENSHOT_DIR=... npx playwright test). */
async function shot(name: string) {
  const dir = process.env.SCREENSHOT_DIR;
  if (!dir) return;
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
}
let documentHref = "";

test.describe.configure({ mode: "serial" });

// Une seule session navigateur pour tout le scénario (connexion unique).
let context: BrowserContext;
let page: Page;
test.beforeAll(async ({ browser }) => {
  rmSync(MAILBOX_DIR, { recursive: true, force: true });
  context = await browser.newContext();
  page = await context.newPage();
});
test.afterAll(async () => context.close());

async function signup(page: Page, u: typeof user) {
  await page.goto("/signup");
  await page.getByLabel("Entreprise").fill(u.company);
  await page.getByLabel("Votre nom").fill(u.name);
  await page.getByLabel("E-mail professionnel").fill(u.email);
  await page.getByLabel("Mot de passe").fill(u.password);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/onboarding/mailbox");
}

type Sent = { id: string; threadId: string; internetMessageId: string; to: string; subject: string; text: string; attachments: { filename: string; base64: string }[] };

function sentMessages(): Sent[] {
  const dir = join(MAILBOX_DIR, user.email.toLowerCase(), "sent");
  return readdirSync(dir).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
}

function deliver(id: string, msg: Omit<Sent, "id" | "internetMessageId" | "attachments"> & { inReplyTo?: string; from: string; attachments: { filename: string; contentType: string; content: Buffer }[] }) {
  const dir = join(MAILBOX_DIR, user.email.toLowerCase(), "inbox");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${id}.json`),
    JSON.stringify({
      id,
      threadId: msg.threadId,
      internetMessageId: `<${id}@fournisseur.test>`,
      inReplyTo: msg.inReplyTo ?? null,
      references: msg.inReplyTo ?? null,
      from: msg.from,
      fromName: null,
      to: user.email,
      subject: msg.subject,
      text: msg.text,
      date: new Date().toISOString(),
      attachments: msg.attachments.map((a) => ({ filename: a.filename, contentType: a.contentType, base64: a.content.toString("base64") })),
    }),
  );
}

async function linesOf(xlsx: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(xlsx as never);
  const ws = wb.getWorksheet("Demande de prix")!;
  const out: { row: number; code: string; designation: string; qty: number; unit: string }[] = [];
  ws.eachRow((row, n) => {
    if (n < 7) return;
    const id = String(row.getCell(9).value ?? "");
    if (!/^[0-9a-f-]{36}$/.test(id)) return;
    out.push({ row: n, code: String(row.getCell(2).value ?? ""), designation: String(row.getCell(3).value), qty: Number(row.getCell(4).value), unit: String(row.getCell(5).value) });
  });
  return { wb, lines: out };
}

async function quotePdf(lines: { designation: string; qty: number; unit: string }[], footer: string[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage([595, 842]);
  let y = 800;
  const t = (s: string, x: number) => page.drawText(s, { x, y, size: 8, font });
  t("Fournisseur A — Devis n° DV-E2E-001 du 20/09/2026", 40);
  y -= 14;
  t("Validité : 30 jours", 40);
  y -= 20;
  let total = 0;
  lines.forEach((l, i) => {
    if (y < 60) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    const pu = 10 + i;
    const lt = Math.round(pu * l.qty * 100) / 100;
    total += lt;
    t(`A-${1000 + i}`, 40);
    t(l.designation.slice(0, 55), 110);
    t(String(l.qty), 380);
    t(l.unit, 420);
    t(pu.toFixed(2).replace(".", ","), 460);
    t(lt.toFixed(2).replace(".", ","), 520);
    y -= 12;
  });
  y -= 10;
  t(`Total HT : ${total.toFixed(2).replace(".", ",")} EUR`, 380);
  for (const f of footer) {
    y -= 12;
    t(f, 40);
  }
  return Buffer.from(await pdf.save());
}

test("1-2. création du compte et connexion de la boîte mail", async () => {
  await signup(page, user);
  await page.getByRole("button", { name: /Boîte de test/ }).click();
  await expect(page.getByText(user.email.toLowerCase())).toBeVisible();
  await shot("01-onboarding-boite-mail");
  await page.getByRole("link", { name: "Créer mon premier dossier" }).click();
  await page.waitForURL("**/dossiers/nouveau");
});

test("3-6. dossier, import d'un DPGF de 73 lignes, correction d'une ligne", async () => {
  await page.goto("/");
  await page.getByRole("link", { name: "Nouveau dossier" }).first().click();
  await page.getByLabel("Nom du chantier").fill("Résidence Les Tilleuls");
  await page.getByLabel("Référence interne").fill("AO-2026-17");
  await page.locator('input[type="file"]').setInputFiles(fixture("dpgf-standard.xlsx"));
  await expect(page.getByText("dpgf-standard.xlsx")).toBeVisible();
  await shot("02-nouveau-dossier");
  await page.getByRole("button", { name: "Analyser le dossier" }).click();
  await page.waitForURL(/\/dossiers\/[0-9a-f-]{36}$/);
  projectUrl = new URL(page.url()).pathname;

  // Analyse asynchrone : la page se met à jour seule.
  await expect(page.getByRole("link", { name: "Vérifier les lignes" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("73 lignes détectées", { exact: true })).toBeVisible();
  documentHref = (await page.getByRole("link", { name: "dpgf-standard.xlsx" }).getAttribute("href"))!;
  await shot("03-dossier-apres-analyse");

  await page.getByRole("link", { name: "Vérifier les lignes" }).click();
  await expect(page.getByRole("heading", { name: "73 lignes détectées" })).toBeVisible();
  await expect(page.getByTestId("line-row")).toHaveCount(73);
  await page.getByRole("button", { name: "Modifier Tube acier noir DN20 y compris supports" }).click();
  await page.getByLabel("Quantité").fill("130");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  const row = page.getByTestId("line-row").filter({ hasText: "Tube acier noir DN20" });
  await expect(row).toContainText("130");
  await expect(row).toContainText("Modifiée");
  await shot("04-lignes");
  await page.getByRole("button", { name: "Valider les lignes" }).click();
  await expect(page.getByText("Lignes validées")).toBeVisible();
});

test("7-10. trois fournisseurs, trois consultations validées et envoyées", async () => {

  await page.goto("/fournisseurs");
  for (const s of suppliers) {
    await page.getByRole("button", { name: "Ajouter un fournisseur" }).click();
    await page.getByLabel("Société").fill(s.name);
    await page.getByLabel("Commercial").fill("Service devis");
    await page.getByLabel("E-mail").fill(s.email);
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByRole("cell", { name: s.email })).toBeVisible();
  }

  await page.goto(`${projectUrl}/consultations/nouvelle`);
  for (const s of suppliers) await page.getByText(s.name, { exact: true }).click();
  await shot("05-creer-consultation");
  await page.getByRole("button", { name: "Créer les 3 consultations" }).click();
  await page.waitForURL("**/consultations/envoi");
  await expect(page.getByTestId("draft-card")).toHaveCount(3);
  const firstCard = page.getByTestId("draft-card").first();
  await expect(firstCard.getByLabel("Objet")).toHaveValue(/Demande de prix – Résidence Les Tilleuls \(AO-2026-17\) \[PC-[A-Z0-9]{6}\]/);
  await expect(firstCard.getByLabel("Message")).toHaveValue(/Dans le cadre du chantier Résidence Les Tilleuls/);
  await expect(firstCard.getByRole("link", { name: /Demande de prix PC-.+\.xlsx/ })).toBeVisible();
  await shot("06-validation-envoi");

  for (let i = 0; i < 3; i++) {
    await page.getByTestId("draft-card").first().getByRole("button", { name: "Envoyer la consultation" }).click();
    await expect(page.getByTestId("draft-card")).toHaveCount(2 - i, { timeout: 30_000 });
  }
  await expect(page.getByText("Toutes les consultations ont été envoyées")).toBeVisible();
  const sent = sentMessages();
  expect(sent).toHaveLength(3);
  expect(sent.map((m) => m.to).sort()).toEqual(suppliers.map((s) => s.email).sort());
});

test("11-19. réponses PDF et Excel, rattachement, extraction, trous, comparatif", async () => {
  const sent = sentMessages();
  const toA = sent.find((m) => m.to === suppliers[0].email)!;
  const toB = sent.find((m) => m.to === suppliers[1].email)!;
  const toC = sent.find((m) => m.to === suppliers[2].email)!;

  // A : devis PDF dans le fil, 3 lignes manquantes, mise en service exclue.
  const a = await linesOf(Buffer.from(toA.attachments[0].base64, "base64"));
  deliver("e2e-a", {
    threadId: toA.threadId,
    inReplyTo: toA.internetMessageId,
    from: suppliers[0].email,
    to: user.email,
    subject: `RE: ${toA.subject}`,
    text: "Bonjour, ci-joint notre offre.",
    attachments: [{ filename: "DV-E2E-001.pdf", contentType: "application/pdf", content: await quotePdf(a.lines.slice(0, -3), ["Délai de livraison : 3 semaines", "Mise en service non comprise"]) }],
  });

  // B : notre fichier Excel complété intégralement.
  const b = await linesOf(Buffer.from(toB.attachments[0].base64, "base64"));
  const ws = b.wb.getWorksheet("Demande de prix")!;
  b.lines.forEach((l, i) => (ws.getCell(`F${l.row}`).value = 9 + i));
  deliver("e2e-b", {
    threadId: toB.threadId,
    inReplyTo: toB.internetMessageId,
    from: suppliers[1].email,
    to: user.email,
    subject: `RE: ${toB.subject}`,
    text: "Bonjour, fichier complété.",
    attachments: [{ filename: "retour-B.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content: Buffer.from(await b.wb.xlsx.writeBuffer()) }],
  });

  // C : son propre Excel, moitié des lignes, livraison non incluse (offre incomplète).
  const c = await linesOf(Buffer.from(toC.attachments[0].base64, "base64"));
  const own = new ExcelJS.Workbook();
  const sheet = own.addWorksheet("Offre");
  sheet.addRow(["Fournisseur C — Offre OC-77"]);
  sheet.addRow(["Article", "Libellé", "Qté", "U", "Prix net HT", "Montant HT"]);
  c.lines.slice(0, Math.floor(c.lines.length / 2)).forEach((l, i) => sheet.addRow([`C-${i}`, l.designation, l.qty, l.unit, 8 + i, (8 + i) * l.qty]));
  sheet.addRow([]);
  sheet.addRow(["", "Livraison non incluse"]);
  deliver("e2e-c", {
    threadId: "nouveau-fil-c",
    from: suppliers[2].email,
    to: user.email,
    subject: `Offre ${toC.subject.match(/PC-[A-Z0-9]{6}/)![0]}`,
    text: "Voici notre meilleure offre.",
    attachments: [{ filename: "offre-C.xlsx", contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", content: Buffer.from(await own.xlsx.writeBuffer()) }],
  });

  await page.goto(`${projectUrl}?tab=consultations`);
  await page.getByRole("button", { name: "Vérifier les réponses" }).click();

  await expect(async () => {
    await page.reload();
    await expect(page.getByText("3 / 3", { exact: true }).first()).toBeVisible({ timeout: 2000 });
    await expect(page.getByTestId("consultation-row").filter({ hasText: "Fournisseur A" })).toContainText("Réponse partielle", { timeout: 1000 });
    await expect(page.getByTestId("consultation-row").filter({ hasText: "Fournisseur B" })).toContainText("Répondu", { timeout: 1000 });
    await expect(page.getByTestId("consultation-row").filter({ hasText: "Fournisseur C" })).toContainText("Réponse partielle", { timeout: 1000 });
  }).toPass({ timeout: 90_000, intervals: [2000] });

  await shot("07-consultations");
  await page.goto(`${projectUrl}?tab=offres`);
  await expect(page.getByTestId("response-card")).toHaveCount(3);
  await expect(page.getByTestId("response-card").filter({ hasText: "Fournisseur B" })).toContainText("rattachée par fil de discussion");
  await expect(page.getByTestId("response-card").filter({ hasText: "Fournisseur C" })).toContainText("rattachée par référence dans l'objet");

  await shot("08-offres");
  await page.goto(`${projectUrl}?tab=comparatif`);
  await expect(page.getByTestId("supplier-card")).toHaveCount(3);
  await shot("09-comparatif");
  for (const total of await page.getByTestId("supplier-total").allTextContents()) expect(total).toMatch(/\d[\d\s]* €/);
  await expect(page.getByTestId("supplier-card").filter({ hasText: "Fournisseur A" })).toContainText("3 lignes demandées absentes du devis.");
  await expect(page.getByTestId("supplier-card").filter({ hasText: "Fournisseur A" })).toContainText("Mise en service non incluse.");
  await expect(page.getByTestId("supplier-card").filter({ hasText: "Fournisseur C" })).toContainText("Livraison non incluse.");
  await expect(page.getByTestId("supplier-card").filter({ hasText: "Fournisseur B" })).toContainText("Toutes les lignes demandées sont chiffrées.");
  await expect(page.getByTestId("insight").first()).toContainText("moins cher que");
  await expect(page.getByTestId("cell-missing").first()).toBeVisible();
  await page.getByRole("button", { name: /Lignes manquantes/ }).click();
  await shot("10-comparatif-lignes-manquantes");
  const missingRows = await page.getByTestId("comparison-row").count();
  expect(missingRows).toBeGreaterThanOrEqual(Math.ceil(c.lines.length / 2));
});

test("20-21. export XLSX du comparatif", async () => {
  await page.goto(`${projectUrl}?tab=comparatif`);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Exporter le comparatif" }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
  const file = await download.path();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  expect(wb.worksheets.map((w) => w.name)).toEqual(["Synthèse", "Comparatif", "Lignes manquantes", "Commentaires"]);
  const cmp = wb.getWorksheet("Comparatif")!;
  const header = [6, 9, 12].map((col) => String(cmp.getRow(1).getCell(col).value));
  expect(header.sort()).toEqual(["Fournisseur A", "Fournisseur B", "Fournisseur C"]);
  expect(wb.getWorksheet("Lignes manquantes")!.rowCount).toBeGreaterThan(3);
});

test("affichage mobile des écrans principaux", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, url] of [
    ["m1-dashboard", "/"],
    ["m2-dossier", projectUrl],
    ["m3-lignes", `${projectUrl}?tab=lignes`],
    ["m4-consultations", `${projectUrl}?tab=consultations`],
    ["m5-comparatif", `${projectUrl}?tab=comparatif`],
    ["m6-fournisseurs", "/fournisseurs"],
  ] as const) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `défilement horizontal sur ${url}`).toBeLessThanOrEqual(1);
    await shot(name);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await shot("11-dashboard");
});

test("22. une autre entreprise n'accède à rien", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signup(page, { ...user, company: "Concurrent", email: `intrus-${stamp}@test.local` });
  const res = await page.goto(projectUrl);
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Page introuvable")).toBeVisible();
  expect((await page.request.get(`/api/projects/${projectUrl.split("/").pop()}/export`)).status()).toBe(404);
  expect((await page.request.get(documentHref, { maxRedirects: 0 })).status()).toBe(404);
  await page.goto("/");
  await expect(page.getByText("Résidence Les Tilleuls")).toHaveCount(0);
  await context.close();
});
