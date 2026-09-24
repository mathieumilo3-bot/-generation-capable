import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkAllCopy, buildTruthContext } from "../claims";
import { fixtureDeps, fixtureFetch } from "../fixtures";
import { advancePreview, clarifyPreview, defaultDeps, initialPipeline, type PipelineDeps } from "../pipeline";
import { toPreviewDocument } from "../public-view";
import { checkRenderable } from "../render-check";
import { MemoryPreviewStore, type PreviewRow } from "../store";
import { PREVIEW_ENGINE_VERSION } from "../version";

let store: MemoryPreviewStore;

function deps(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return defaultDeps(store, { ...fixtureDeps({ discovery: 0, investigation: 0, blueprint: 0 }), renderCheck: checkRenderable, ...overrides });
}

async function start(name: string, d: PipelineDeps, city = "", key = randomUUID()): Promise<PreviewRow | "needs_city"> {
  const registry = await d.lookupRegistry(name, city);
  if (registry.status === "ambiguous" && !city) return "needs_city";
  const row = await store.create({
    id: randomUUID(),
    idempotencyKey: key,
    tokenHash: "h",
    companyName: name,
    input: { companyName: name, ...(city ? { cityHint: city } : {}) },
    attribution: {},
    pipeline: initialPipeline(),
    work: { registry: registry.status === "unique" ? registry.candidates[0] : null, ...(city ? { userCity: city } : {}) },
    stage: "identity",
    engineVersion: PREVIEW_ENGINE_VERSION,
  });
  return row!;
}

async function runToRest(id: string, d: PipelineDeps, max = 40): Promise<PreviewRow> {
  let row = (await store.get(id))!;
  for (let i = 0; i < max; i += 1) {
    const result = await advancePreview(id, d);
    row = result!.row;
    if (row.status !== "running" || (row.status === "running" && false)) break;
  }
  return (await store.get(id))!;
}

beforeEach(() => {
  store = new MemoryPreviewStore();
});

describe("preview pipeline (offline fixtures, real engine)", () => {
  it("asks for the city first when exact homonyms exist, before any paid search", async () => {
    const startDiscovery = vi.fn();
    const d = deps({ startDiscovery });
    expect(await start("Toiture Martin", d)).toBe("needs_city");
    expect(startDiscovery).not.toHaveBeenCalled();
  });

  it("builds a complete, verified preview for a company with a rich site (level A)", async () => {
    const d = deps();
    const row = (await start("Toiture Martin", d, "Vannes")) as PreviewRow;
    const done = await runToRest(row.id, d);

    expect(done.status).toBe("ready");
    expect(done.stage).toBe("notify");
    for (const stage of ["identity", "discovery", "crawl", "research", "truth_bundle", "blueprint", "validate", "render", "store"] as const) {
      expect(done.pipeline[stage].status, stage).toBe("done");
      expect(done.pipeline[stage].completedAt).toBeTruthy();
      expect(done.pipeline[stage].engineVersion).toContain("preview-2");
    }

    const profile = done.company_profile!;
    expect(profile.presence.level).toBe("A");
    expect(profile.identity.publicName.value).toBe("Toiture Martin");
    expect(profile.identity.siren?.value).toBe("111111111");
    expect(profile.identity.city?.value).toBe("Vannes");
    expect(profile.identity.officialDomain?.value).toBe("toiture-martin.test");
    expect(profile.identity.tradeFamily).toBe("couverture_charpente");
    expect(profile.contacts.phone?.value).toBe("02 97 00 00 00");
    expect(profile.services.map((s) => s.name)).toEqual(expect.arrayContaining(["Réfection de toiture", "Zinguerie et gouttières"]));
    // Descriptions are real sentences of the site, never navigation glued together.
    expect(profile.services.find((s) => s.name === "Réfection de toiture")?.quote).toBe(
      "La réfection complète de votre toiture en ardoise ou en tuile, de la charpente à la finition."
    );
    for (const service of profile.services) expect(service.quote).not.toMatch(/\||\d{2} \d{2} \d{2}|Réalisations Contact/);
    expect(profile.trust.items.map((t) => t.label)).toEqual(expect.arrayContaining(["Qualibat", "Garantie décennale"]));
    expect(profile.reviews[0]).toMatchObject({ platform: "Google", rating: "4,9/5", count: "37 avis", confidence: "observed" });
    expect(profile.portfolioAssets.filter((a) => a.type === "realisation").length).toBeGreaterThanOrEqual(5);
    expect(profile.branding.logo?.url).toContain("logo-toiture-martin");
    expect(profile.branding.observedColors?.value[0]).toBe("#1d4e89");
    expect(profile.identity.address?.value).toContain("Rue du Port");

    // The fixture model invented "devis gratuit / urgence 7j/7": refused, fallen back.
    expect(done.work.rejections?.some((r) => r.field === "services")).toBe(true);
    expect(done.work.blueprintSource).toBe("mixed");
    const bp = done.preview_blueprint!;
    expect(bp.services.intro).toBeNull();
    expect(bp.sections.at(-1)?.type).toBe("cta");
    expect(bp.sections.map((s) => s.type)).toEqual(expect.arrayContaining(["services", "portfolio", "why", "area"]));
    expect(bp.hero.imageAssetId).toBeTruthy();

    // Every word shipped passes the guard.
    const truth = buildTruthContext(profile, JSON.stringify(done.work.dossier));
    expect(checkAllCopy(bp, truth, new Set(["variant", "type", "imageAssetId", "serviceId", "factRef", "leverId", "strategy", "trustIds", "reviewIds", "assetIds", "templateFamily"]))).toEqual({ ok: true });

    const doc = toPreviewDocument(done.id, profile, bp);
    expect(checkRenderable(doc).sections).toBeGreaterThanOrEqual(5);
    expect(Object.values(doc.assets).every((a) => a.src.startsWith("/api/preview/image?u="))).toBe(true);
    expect(JSON.stringify(doc)).not.toContain("toiture-martin.test/wp-content");
    expect(doc.palette.source).toBe("brand");
  });

  it("builds a from-scratch preview when there is no site (level C), without inventing", async () => {
    const d = deps();
    const row = (await start("Atelier Sans Site", d)) as PreviewRow;
    const asked = await runToRest(row.id, d);
    // No site found: ask once instead of assuming a blank page.
    expect(asked).toMatchObject({ status: "needs_input", needs: "site" });
    await clarifyPreview(row.id, { noSite: true }, d);
    const done = await runToRest(row.id, d);
    expect(done.status).toBe("ready");
    const profile = done.company_profile!;
    expect(profile.presence.level).toBe("C");
    expect(profile.identity.city?.value).toBe("Saint-Christophe-du-Ligneron");
    expect(profile.identity.foundedYear?.value).toBe("2016");
    expect(profile.portfolioAssets).toHaveLength(0);
    expect(profile.reviews).toHaveLength(0);
    expect(profile.contacts.phone).toBeUndefined();
    const bp = done.preview_blueprint!;
    expect(bp.secondaryCta).toBeNull();
    expect(bp.sections.map((s) => s.type)).not.toContain("portfolio");
    expect(JSON.stringify(bp)).not.toMatch(/avis|gratuit|24h|décennale|RGE/i);
  });

  it("asks one precision when the identity cannot be verified, then honours 'no site'", async () => {
    const d = deps();
    const row = (await start("Entreprise Introuvable", d)) as PreviewRow;
    let rest = await runToRest(row.id, d);
    expect(rest.status).toBe("needs_input");
    expect(rest.needs).toBe("city");

    await clarifyPreview(row.id, { city: "Nantes" }, d);
    rest = await runToRest(row.id, d);
    expect(rest.status).toBe("needs_input");
    expect(rest.needs).toBe("site");

    await clarifyPreview(row.id, { noSite: true }, d);
    rest = await runToRest(row.id, d);
    expect(rest.status, JSON.stringify({ stage: rest.stage, err: rest.error_code, p: rest.pipeline })).toBe("ready");
    expect(rest.company_profile!.identity.publicName).toMatchObject({ value: "Entreprise Introuvable", source: "nom saisi" });
    expect(rest.company_profile!.identity.city?.value).toBe("Nantes");
  });

  it("is idempotent on the submission key", async () => {
    const d = deps();
    const key = randomUUID();
    const a = (await start("Atelier Sans Site", d, "", key)) as PreviewRow;
    const b = (await start("Atelier Sans Site", d, "", key)) as PreviewRow;
    expect(b.id).toBe(a.id);
  });

  it("reuses a recent preview of the same company instead of paying the searches again", async () => {
    const startDiscovery = vi.fn(fixtureDeps({ discovery: 0, investigation: 0, blueprint: 0 }).startDiscovery!);
    const startInvestigation = vi.fn(fixtureDeps({ discovery: 0, investigation: 0, blueprint: 0 }).startInvestigation!);
    const d = deps({ startDiscovery, startInvestigation });
    const first = (await start("Toiture Martin", d, "Vannes")) as PreviewRow;
    await runToRest(first.id, d);
    const calls = [startDiscovery.mock.calls.length, startInvestigation.mock.calls.length];

    const second = (await start("Toiture Martin", d, "56000")) as PreviewRow;
    const done = await runToRest(second.id, d);
    expect(done.status).toBe("ready");
    expect(done.work.reusedFrom).toBe(first.id);
    expect([startDiscovery.mock.calls.length, startInvestigation.mock.calls.length]).toEqual(calls);
    expect(done.pipeline.crawl.status).toBe("skipped");
  });

  it("lets only one advancer work at a time", async () => {
    const d = deps();
    const row = (await start("Atelier Sans Site", d)) as PreviewRow;
    const claimed = await store.claim(row.id, 10_000);
    expect(claimed?.leaseId).toBeTruthy();
    const concurrent = await advancePreview(row.id, d);
    expect(concurrent?.advanced).toBe(false);
  });

  it("still ships a preview when every model call is unavailable (deterministic floor)", async () => {
    const d = deps({ startDiscovery: async () => null, startInvestigation: async () => null, startBlueprint: async () => null });
    const row = (await start("Toiture Martin", d, "Vannes")) as PreviewRow;
    let rest = await runToRest(row.id, d);
    expect(rest.needs).toBe("site"); // registry alone cannot tell whether a site exists
    await clarifyPreview(row.id, { siteUrl: "https://toiture-martin.test/" }, d);
    rest = await runToRest(row.id, d);
    expect(rest.status).toBe("ready");
    expect(rest.work.blueprintSource).toBe("base");
    expect(rest.audit_report?.diagnostic?.mode).toBe("site");
    expect(rest.preview_blueprint!.services.items.length).toBeGreaterThan(0);
  });

  it("degrades instead of failing when a stage keeps throwing", async () => {
    const d = deps({
      crawl: async () => {
        throw new Error("boom");
      },
    });
    const row = (await start("Toiture Martin", d, "Vannes")) as PreviewRow;
    const done = await runToRest(row.id, d);
    expect(done.pipeline.crawl.retryCount).toBe(3);
    expect(done.pipeline.crawl.status).toBe("skipped");
    expect(done.status).toBe("ready");
  });

  it("e-mails the ready preview exactly once", async () => {
    const sendReadyEmail = vi.fn(async () => true);
    const d = deps({ sendReadyEmail });
    const row = (await start("Atelier Sans Site", d)) as PreviewRow;
    await store.setEmail(row.id, "artisan@example.com", null);
    await runToRest(row.id, d);
    await clarifyPreview(row.id, { noSite: true }, d);
    await runToRest(row.id, d);
    await advancePreview(row.id, d);
    await advancePreview(row.id, d);
    expect(sendReadyEmail).toHaveBeenCalledTimes(1);
    expect((await store.get(row.id))!.notified_at).toBeTruthy();
  });

  it("never starts a heavy stage it cannot finish inside the 10 s request limit", async () => {
    let clock = 1_000_000;
    const base = deps();
    const crawl = vi.fn(base.crawl);
    const d = deps({
      now: () => clock,
      crawl,
      collectDiscovery: async (...args) => {
        clock += 8_000; // a slow poll + domain verification
        return base.collectDiscovery(...args);
      },
    });
    const row = (await start("Toiture Martin", d, "Vannes")) as PreviewRow;
    await advancePreview(row.id, d); // identity + discovery job start
    const after = await advancePreview(row.id, d); // slow discovery poll
    expect(after!.row.stage).toBe("crawl");
    expect(crawl).not.toHaveBeenCalled(); // left for the next request
  });

  it("anchors identity on the SIREN of the site's legal notice, and drops an unconfirmed name match", async () => {
    // Name-only registry match elsewhere (Lyon); the site's legal notice says 111 111 111 (Vannes).
    const base = deps();
    const d = deps({ lookupRegistry: async () => ({ status: "unique", candidates: [{ name: "TOITURE MARTIN", siren: "111111112", city: "LYON", postalCode: "69003" }] }) });
    const row = (await start("Toiture Martin", d, "Vannes")) as PreviewRow;
    void base;
    const done = await runToRest(row.id, d);
    expect(done.status).toBe("ready");
    expect(done.company_profile!.identity.siren?.value).toBe("111111111");
    expect(done.company_profile!.identity.city?.value).toBe("Vannes");

    const noSirenLookup = deps({
      lookupRegistry: async () => ({ status: "unique", candidates: [{ name: "TOITURE MARTIN", siren: "999999999", city: "DOMEYROT", postalCode: "23140" }] }),
      lookupRegistryBySiren: async () => null,
    });
    const other = (await start("Toiture Martin", noSirenLookup, "Vannes")) as PreviewRow;
    const second = await runToRest(other.id, noSirenLookup);
    expect(second.company_profile!.identity.siren).toBeUndefined();
    expect(second.work.registryDropped).toBe("999999999");
  });

  it("reads the fixture site through the real crawler", async () => {
    const home = await fixtureFetch("https://toiture-martin.test/");
    expect(home.ok).toBe(true);
  });
});
