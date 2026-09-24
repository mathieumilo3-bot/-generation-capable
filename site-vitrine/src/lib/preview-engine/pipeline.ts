import {
  collectCompanyDiscovery,
  startCompanyDiscovery,
  verifyOfficialSite,
  type CompanyDiscoveryCandidate,
} from "@/lib/audit-engine/company-discovery";
import { lookupFrenchRegistry, lookupRegistryBySiren, registryIdentityHint, type RegistryCandidate, type RegistryPreflight } from "@/lib/audit-engine/company-registry";
import { crawlSite, normalize, type SiteCrawl } from "@/lib/audit-engine/crawl";
import {
  buildDossier,
  collectInvestigationDetailed,
  dossierHaystack,
  siteOnlyDiagnostic,
  startInvestigation,
  toAuditContext,
  type DetailedCollectOutcome,
  type Dossier,
} from "@/lib/audit-engine/diagnostic";
import { reportFromContext } from "@/lib/audit-engine/engine";
import { fetchPublicAsset, unreachableSignals } from "@/lib/audit-engine/probe";
import { extractAssets, type CrawledHtml } from "./assets";
import { buildBaseBlueprint } from "./blueprint-base";
import { collectBlueprintJob, startBlueprintJob, type BlueprintJobOutcome } from "./blueprint-ai";
import type { PreviewBlueprint } from "./blueprint-schema";
import { validateBlueprint } from "./blueprint-validate";
import { buildTruthContext } from "./claims";
import { rankObservedColors } from "./colors";
import { buildVerifiedProfile } from "./profile";
import { toPreviewDocument, type PreviewDocument } from "./public-view";
import { STAGES, type JobRef, type PipelineState, type PreviewWork, type StageName } from "./pipeline-types";
import type { PreviewPatch, PreviewRow, PreviewStore } from "./store";
import { fingerprintOf } from "./tokens";
import { PREVIEW_BLUEPRINT_VERSION, PREVIEW_DATA_VERSION, PREVIEW_ENGINE_VERSION } from "./version";

/**
 * The preview pipeline, as a persisted state machine:
 *
 *   IDENTITY → DISCOVERY → CRAWL → RESEARCH → TRUTH_BUNDLE → BLUEPRINT
 *   → VALIDATE → RENDER → STORE → NOTIFY
 *
 * The host cuts every request at 10 s, so nothing here waits for long work:
 * model jobs run in the background on the provider's side and a stage that
 * depends on one simply hands back "wait". `advancePreview` runs as many
 * stages as its budget allows and is safe to call from anywhere — the
 * visitor's browser while they watch, or the background worker once they
 * have left. A lease in the store guarantees one advancer at a time.
 */

export const OBJECTIVE =
  "Augmenter la visibilité qualifiée et la transformer en davantage de demandes de devis et de prospects qualifiés.";

const LEASE_MS = 12_000;
const DEFAULT_BUDGET_MS = 6_500;
const DISCOVERY_DEADLINE_MS = 50_000;
const INVESTIGATION_DEADLINE_MS = 150_000;
const BLUEPRINT_DEADLINE_MS = 75_000;
const MAX_STAGE_RETRIES = 3;
const REUSE_MAX_AGE_HOURS = 24 * 7;
const FOLLOW_MAX_AGE_HOURS = 0.25;
const CRAWL_BUDGET_MS = 5_000;

type FetchLike = typeof fetch;

export type PipelineDeps = {
  now: () => number;
  store: PreviewStore;
  lookupRegistry: (name: string, city?: string, timeoutMs?: number) => Promise<RegistryPreflight>;
  lookupRegistryBySiren: (siren: string) => Promise<RegistryCandidate | null>;
  startDiscovery: (name: string, options: { cityHint?: string; identityHint?: string; rescue?: boolean }) => Promise<string | null>;
  collectDiscovery: typeof collectCompanyDiscovery;
  verifySite: (candidate: CompanyDiscoveryCandidate, opts: { cityHint?: string }) => Promise<CompanyDiscoveryCandidate>;
  crawl: typeof crawlSite;
  fetchStylesheet: (url: string, timeoutMs: number) => Promise<string | null>;
  startInvestigation: (dossier: Dossier) => Promise<string | null>;
  collectInvestigation: (jobId: string, dossier: Dossier) => Promise<DetailedCollectOutcome>;
  startBlueprint: (profile: NonNullable<PreviewRow["company_profile"]>, base: PreviewBlueprint) => Promise<string | null>;
  collectBlueprint: (jobId: string) => Promise<BlueprintJobOutcome>;
  /** Renders the document server-side; throws if the renderer cannot handle it. */
  renderCheck: (doc: PreviewDocument) => { bytes: number; sections: number };
  /** Sends the "ready" e-mail. Returns true when accepted by the provider. */
  sendReadyEmail: (row: PreviewRow) => Promise<boolean>;
};

export function defaultDeps(store: PreviewStore, overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  const previewApiKey =
    process.env.GC_PREVIEW_AI_ENABLED === "true"
      ? process.env.OPENAI_API_KEY ?? process.env.OPEN_API_KEY
      : undefined;
  return {
    now: () => Date.now(),
    store,
    lookupRegistry: (name, city, timeoutMs) => lookupFrenchRegistry(name, city ?? "", timeoutMs ? { timeoutMs } : {}),
    lookupRegistryBySiren: (siren) => lookupRegistryBySiren(siren),
    startDiscovery: (name, options) =>
      previewApiKey ? startCompanyDiscovery(name, { ...options, apiKey: previewApiKey }) : Promise.resolve(null),
    collectDiscovery: (jobId, name, options) => collectCompanyDiscovery(jobId, name, options),
    verifySite: (candidate, opts) => verifyOfficialSite(candidate, opts),
    crawl: crawlSite,
    fetchStylesheet: async (url, timeoutMs) => {
      const result = await fetchPublicAsset(url, { timeoutMs, maxBytes: 600_000, accept: (type) => type === "text/css" || type === "" });
      return result.ok ? new TextDecoder().decode(result.bytes) : null;
    },
    startInvestigation: (dossier) =>
      previewApiKey ? startInvestigation(dossier, { timeoutMs: 3_500, apiKey: previewApiKey }) : Promise.resolve(null),
    collectInvestigation: (jobId, dossier) => collectInvestigationDetailed(jobId, toAuditContext(dossier)),
    startBlueprint: (profile, base) =>
      previewApiKey ? startBlueprintJob(profile, base, { apiKey: previewApiKey }) : Promise.resolve(null),
    collectBlueprint: (jobId) => collectBlueprintJob(jobId),
    renderCheck: () => ({ bytes: 0, sections: 0 }),
    sendReadyEmail: async () => false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pipeline state helpers

export function initialPipeline(): PipelineState {
  return Object.fromEntries(STAGES.map((stage) => [stage, { status: "pending", retryCount: 0, engineVersion: PREVIEW_ENGINE_VERSION }])) as PipelineState;
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function nextStage(stage: StageName): StageName | null {
  const index = STAGES.indexOf(stage);
  return index >= 0 && index < STAGES.length - 1 ? STAGES[index + 1] : null;
}

type StageResult =
  | { kind: "done"; skipped?: boolean; jumpTo?: StageName }
  | { kind: "wait" }
  | { kind: "needs"; needs: "city" | "site" }
  | { kind: "error"; code: string; fatal?: boolean };

type Ctx = { row: PreviewRow; work: PreviewWork; patch: PreviewPatch; deps: PipelineDeps; started: number };

function elapsedSince(ctx: Ctx, job?: JobRef): number {
  return job ? ctx.deps.now() - Date.parse(job.startedAt) : 0;
}

function pickCandidate(items: CompanyDiscoveryCandidate[]): CompanyDiscoveryCandidate | null {
  const withSite = items.filter((item) => item.website);
  return (
    withSite.find((item) => item.confidence === "high" && item.verification?.verified !== false) ??
    withSite.find((item) => item.confidence === "high") ??
    withSite.find((item) => item.confidence === "medium") ??
    items.find((item) => item.confidence === "high") ??
    items.find((item) => item.confidence === "medium") ??
    withSite[0] ??
    items[0] ??
    null
  );
}

function registryCandidateAsDiscovery(registry: RegistryCandidate): CompanyDiscoveryCandidate {
  return { name: registry.commercialName || registry.name, website: "", sector: "", city: registry.city, summary: `SIREN ${registry.siren}`, confidence: "high" };
}

function dedupeCandidates(items: CompanyDiscoveryCandidate[]): CompanyDiscoveryCandidate[] {
  return items.filter(
    (item, index, all) =>
      all.findIndex(
        (other) =>
          other.name.toLowerCase() === item.name.toLowerCase() && other.city.toLowerCase() === item.city.toLowerCase() && other.website === item.website
      ) === index
  );
}

// ---------------------------------------------------------------------------
// Reuse: never pay twice for the same company

async function tryReuse(ctx: Ctx): Promise<StageResult | null> {
  const fp = ctx.patch.fingerprint ?? ctx.row.fingerprint;
  if (!fp) return null;
  const ready = await ctx.deps.store.findByFingerprint(fp, ["ready"], REUSE_MAX_AGE_HOURS, ctx.row.id);
  if (ready?.company_profile && ready.audit_report) {
    ctx.patch.company_profile = ready.company_profile;
    ctx.patch.audit_report = ready.audit_report;
    ctx.work.reusedFrom = ready.id;
    ctx.work.dossier = ready.work.dossier;
    const sameBlueprint = ready.preview_blueprint && ready.engine_version === PREVIEW_ENGINE_VERSION && ready.work.blueprintSource;
    if (sameBlueprint) {
      ctx.patch.preview_blueprint = ready.preview_blueprint;
      ctx.work.blueprintSource = ready.work.blueprintSource;
      ctx.work.rejections = ready.work.rejections;
      return { kind: "done", jumpTo: "render" };
    }
    return { kind: "done", jumpTo: "blueprint" };
  }
  const active = await ctx.deps.store.findByFingerprint(fp, ["running"], FOLLOW_MAX_AGE_HOURS, ctx.row.id);
  if (active && !active.work.followId && Date.parse(active.created_at) < Date.parse(ctx.row.created_at)) {
    ctx.work.followId = active.id;
    return { kind: "wait" };
  }
  return null;
}

async function followOther(ctx: Ctx): Promise<StageResult | null> {
  if (!ctx.work.followId) return null;
  const other = await ctx.deps.store.get(ctx.work.followId);
  if (other?.status === "ready" && other.company_profile && other.audit_report) {
    ctx.patch.company_profile = other.company_profile;
    ctx.patch.audit_report = other.audit_report;
    ctx.patch.preview_blueprint = other.preview_blueprint;
    ctx.work.reusedFrom = other.id;
    ctx.work.dossier = other.work.dossier;
    ctx.work.blueprintSource = other.work.blueprintSource;
    ctx.work.rejections = other.work.rejections;
    delete ctx.work.followId;
    return { kind: "done", jumpTo: other.preview_blueprint ? "render" : "blueprint" };
  }
  if (!other || other.status === "failed" || other.status === "needs_input" || ctx.deps.now() - Date.parse(other.updated_at) > 60_000) {
    delete ctx.work.followId; // the leader stalled: run our own pipeline
    return null;
  }
  return { kind: "wait" };
}

// ---------------------------------------------------------------------------
// Stages

function unreadableCrawl(url: string): SiteCrawl {
  return {
    rootUrl: url,
    reachable: false,
    unreachableReason: "network_error",
    homeSignals: unreachableSignals("network_error"),
    home: null,
    pages: [],
    discoveredUrlCount: 0,
    sitemapUrlCount: null,
    sitemapPaths: [],
    knownPaths: [],
    socialLinks: {},
    durationMs: 0,
  };
}

async function stageIdentity(ctx: Ctx): Promise<StageResult> {
  const following = await followOther(ctx);
  if (following) return following;

  // The registry pre-check normally happens in the start request (it decides
  // whether to ask for the city before anything is created). This covers a
  // clarification that changed the city.
  // The start request keeps its registry call short (1.8 s) so the city
  // question stays instant; an empty answer there may just be a slow
  // registry, so it is asked once more here with more patience.
  if (ctx.work.registry === undefined || (ctx.work.registry === null && !ctx.work.registryRetried)) {
    const patient = ctx.work.registry === null;
    ctx.work.registryRetried = true;
    const registry = await ctx.deps.lookupRegistry(ctx.row.input.companyName, ctx.work.userCity ?? ctx.row.input.cityHint, patient ? 4_000 : undefined);
    if (registry.status === "ambiguous" && !ctx.work.userCity && !ctx.row.input.cityHint) return { kind: "needs", needs: "city" };
    ctx.work.registry = registry.status === "unique" ? registry.candidates[0] : null;
  }
  if (ctx.work.registry) {
    ctx.patch.siren = ctx.work.registry.siren;
    ctx.patch.fingerprint = fingerprintOf({ siren: ctx.work.registry.siren }, PREVIEW_DATA_VERSION);
    const reuse = await tryReuse(ctx);
    if (reuse) return reuse;
  }
  return { kind: "done" };
}

async function stageDiscovery(ctx: Ctx): Promise<StageResult> {
  const following = await followOther(ctx);
  if (following) return following;

  const { work, deps, row } = ctx;
  const registry = work.registry ?? null;
  const cityHint = work.userCity || row.input.cityHint || registry?.city || "";

  if (work.noSite) {
    // The visitor told us there is no site: build from the verified identity,
    // or — when the registry had nothing — from what the visitor declared.
    const found = registry ? registryCandidateAsDiscovery(registry) : pickCandidate(work.candidates ?? []);
    work.discovery = found
      ? { ...found, website: "" }
      : { name: row.input.companyName, website: "", sector: "", city: cityHint, summary: "", confidence: "low" };
    if (!work.discovery.city && !registry) return { kind: "needs", needs: "city" };
    return { kind: "done" };
  }

  if (work.userSite && !work.discovery?.website) {
    const base: CompanyDiscoveryCandidate = registry
      ? { ...registryCandidateAsDiscovery(registry), website: work.userSite, confidence: "medium" }
      : { name: row.input.companyName, website: work.userSite, sector: "", city: cityHint, summary: "", confidence: "medium" };
    const verified = await deps.verifySite(base, { cityHint });
    // The visitor told us the address: keep it even if the automatic check is inconclusive.
    work.discovery = { ...verified, website: verified.website || work.userSite };
    return { kind: "done" };
  }

  if (!work.discoveryJob) {
    const rescue = Boolean(work.userCity) || Boolean(work.rescueTried);
    const jobId = await deps.startDiscovery(row.input.companyName, {
      cityHint,
      identityHint: registry ? registryIdentityHint(registry) : "",
      rescue,
    });
    if (!jobId) {
      // No search available: the registry alone cannot tell whether a site exists.
      if (registry) return { kind: "needs", needs: "site" };
      return { kind: "needs", needs: cityHint ? "site" : "city" };
    }
    work.discoveryJob = { id: jobId, startedAt: iso(deps.now()), rescue };
    return { kind: "wait" };
  }

  const outcome =
    elapsedSince(ctx, work.discoveryJob) > DISCOVERY_DEADLINE_MS
      ? ({ status: "failed", reason: "deadline" } as const)
      : await deps.collectDiscovery(work.discoveryJob.id, row.input.companyName, { cityHint, verify: deps.verifySite });
  if (outcome.status === "pending") return { kind: "wait" };

  const found = outcome.status === "done" ? outcome.result.candidates : [];
  const wasRescue = Boolean(work.discoveryJob.rescue);
  work.candidates = dedupeCandidates([...found, ...(work.candidates ?? [])]).slice(0, 5);
  delete work.discoveryJob;
  const candidate = pickCandidate(work.candidates);

  const distinctCities = new Set(
    work.candidates.filter((c) => c === candidate || c.confidence !== "low").map((c) => c.city.trim().toLowerCase() || c.website).filter(Boolean)
  ).size;
  if (!registry && !work.userCity && !row.input.cityHint && distinctCities > 1) return { kind: "needs", needs: "city" };

  const strong = candidate?.website && candidate.confidence === "high";
  if (!strong && !wasRescue && !work.rescueTried) {
    // A legal name can differ completely from the brand used on the site:
    // one identity-bridge search (premium model) before concluding anything.
    work.rescueTried = true;
    return stageDiscovery(ctx);
  }

  if (!candidate && !registry && !work.userCity && !row.input.cityHint) return { kind: "needs", needs: "city" };
  // No official site found: ask for it (one tap for "no site") rather than
  // telling a company that has a site that it starts from a blank page.
  if (!candidate?.website) return { kind: "needs", needs: "site" };

  work.discovery = candidate ?? (registry ? registryCandidateAsDiscovery(registry) : null);
  const domain = work.discovery?.website ? new URL(work.discovery.website).hostname.replace(/^www\./, "") : null;
  ctx.patch.official_domain = domain;
  ctx.patch.company_name = (work.discovery?.name || row.company_name).slice(0, 160);
  if (!ctx.patch.fingerprint && !row.fingerprint) {
    ctx.patch.fingerprint = fingerprintOf({ domain, name: work.discovery?.name, city: work.discovery?.city }, PREVIEW_DATA_VERSION);
    const reuse = await tryReuse(ctx);
    if (reuse) return reuse;
  }
  return { kind: "done" };
}

async function stageCrawl(ctx: Ctx): Promise<StageResult> {
  const { work, deps, row } = ctx;
  const registry = work.registry ?? null;
  const discovery = work.discovery ?? null;
  const input = {
    entreprise: (discovery?.name || registry?.commercialName || registry?.name || row.input.companyName).slice(0, 160),
    siteUrl: discovery?.website ?? "",
    secteur: discovery?.sector ?? "",
    ville: discovery?.city || registry?.city || work.userCity || row.input.cityHint || "",
  };

  const pages: CrawledHtml[] = [];
  let crawlResult: SiteCrawl | null = null;
  const dossier = await buildDossier(input, {
    budgetMs: CRAWL_BUDGET_MS,
    crawl: async (url, options) => {
      crawlResult = await deps.crawl(url, { ...options, onPage: (page) => pages.push(page) });
      return crawlResult;
    },
  });

  if (pages.length) {
    const assets = extractAssets(pages, { brandName: input.entreprise });
    const css = [...assets.inlineCss];
    const remaining = DEFAULT_BUDGET_MS - (deps.now() - ctx.started);
    if (assets.stylesheetUrls[0] && remaining > 1_500) {
      const sheet = await deps.fetchStylesheet(assets.stylesheetUrls[0], Math.min(1_500, remaining - 500));
      if (sheet) css.push(sheet);
    }
    work.observedColors = rankObservedColors(css, assets.themeColor);
    work.assets = {
      images: assets.images,
      paragraphs: assets.paragraphs.slice(0, 60),
      logo: assets.logo,
      siteName: assets.siteName,
      emails: assets.emails,
      reviewMentions: assets.reviewMentions,
    };
  } else {
    work.assets = null;
    work.observedColors = [];
  }
  work.dossier = dossier;
  void crawlResult;
  return { kind: "done" };
}

async function stageResearch(ctx: Ctx): Promise<StageResult> {
  const { work, deps } = ctx;
  const dossier = work.dossier!;
  if (!work.investigationJob) {
    const jobId = await deps.startInvestigation(dossier);
    if (!jobId) {
      work.diagnostic = siteOnlyDiagnostic(toAuditContext(dossier));
      work.research = null;
      return { kind: "done" };
    }
    work.investigationJob = { id: jobId, startedAt: iso(deps.now()) };
    return { kind: "wait" };
  }
  if (elapsedSince(ctx, work.investigationJob) > INVESTIGATION_DEADLINE_MS) {
    work.diagnostic = siteOnlyDiagnostic(toAuditContext(dossier));
    work.research = null;
    ctx.patch.error_code = "investigation_deadline";
    return { kind: "done" };
  }
  const outcome = await deps.collectInvestigation(work.investigationJob.id, dossier);
  if (outcome.status === "pending") return { kind: "wait" };
  if (outcome.status === "failed") {
    work.investigationFailure = outcome.reason.slice(0, 300);
    console.warn("[preview/pipeline] investigation failed:", outcome.reason);
    // One fresh attempt before degrading to the site-only diagnostic.
    if (!work.investigationRetried) {
      work.investigationRetried = true;
      delete work.investigationJob;
      return { kind: "wait" };
    }
    work.diagnostic = siteOnlyDiagnostic(toAuditContext(dossier));
    work.research = null;
    ctx.patch.error_code = "investigation_failed";
    return { kind: "done" };
  }
  work.diagnostic = outcome.diagnostic;
  work.research = outcome.research;
  return { kind: "done" };
}

/**
 * The legal notice of the official site is the strongest identity anchor:
 * its SIREN replaces a registry match made on the name alone, and a name
 * match the site does not confirm (other city, no SIREN) is dropped.
 */
async function reconcileRegistry(ctx: Ctx): Promise<void> {
  const { work, deps } = ctx;
  const dossier = work.dossier;
  if (!dossier?.site.reachable) return;
  const siteSiren = (dossier.facts?.legal.siret ?? "").replace(/\D/g, "").slice(0, 9);
  if (/^\d{9}$/.test(siteSiren)) {
    if (work.registry?.siren === siteSiren) return;
    const bySiren = await deps.lookupRegistryBySiren(siteSiren);
    if (bySiren) {
      work.registry = bySiren;
      ctx.patch.siren = bySiren.siren;
      return;
    }
  }
  if (work.registry) {
    const text = dossierHaystack(dossier);
    const city = normalize(work.registry.city);
    const typed = normalize(ctx.row.input.companyName);
    const registryNames = [work.registry.name, work.registry.legalName, work.registry.commercialName].filter(Boolean).map((v) => normalize(String(v)));
    const userCity = normalize(work.userCity || ctx.row.input.cityHint || "");
    const registryCity = normalize(work.registry.city);
    const identityBridge =
      registryNames.includes(typed) &&
      userCity.length > 1 &&
      userCity === registryCity &&
      work.discovery?.verification?.verified === true &&
      work.discovery.verification.evidence.some((e) => /ville retrouvée/i.test(e));
    const confirmed =
      text.includes(work.registry.siren) ||
      (city.length > 1 && text.includes(city)) ||
      Boolean(work.registry.postalCode && text.includes(work.registry.postalCode)) ||
      identityBridge;
    if (!confirmed) {
      work.registryDropped = work.registry.siren;
      work.registry = null;
      ctx.patch.siren = null;
    }
  }
}

async function stageTruthBundle(ctx: Ctx): Promise<StageResult> {
  const { work, row, deps } = ctx;
  await reconcileRegistry(ctx);
  const dossier = work.dossier!;
  const profile = buildVerifiedProfile({
    typedName: row.input.companyName,
    userCity: work.userCity || row.input.cityHint,
    registry: work.registry ?? null,
    discovery: work.discovery ?? null,
    dossier,
    assets: work.assets ? { ...work.assets, paragraphs: work.assets.paragraphs ?? [], inlineCss: [], stylesheetUrls: [] } : null,
    observedColors: work.observedColors,
    research: work.research ?? null,
    diagnostic: work.diagnostic!,
    now: new Date(deps.now()),
  });
  ctx.patch.company_profile = profile;
  ctx.patch.audit_report = reportFromContext(toAuditContext(dossier), work.diagnostic!, OBJECTIVE);
  ctx.patch.company_name = profile.identity.publicName.value.slice(0, 160);
  // Raw crawl material is no longer needed once the profile exists.
  if (work.assets) work.assets = { ...work.assets, images: [], paragraphs: [] };
  return { kind: "done" };
}

function currentProfile(ctx: Ctx) {
  return ctx.patch.company_profile ?? ctx.row.company_profile;
}

async function stageBlueprint(ctx: Ctx): Promise<StageResult> {
  const { work, deps } = ctx;
  const profile = currentProfile(ctx)!;
  const base = buildBaseBlueprint(profile);
  if (!work.blueprintJob) {
    const jobId = await deps.startBlueprint(profile, base);
    if (!jobId) {
      work.blueprintRaw = null;
      return { kind: "done" };
    }
    work.blueprintJob = { id: jobId, startedAt: iso(deps.now()) };
    return { kind: "wait" };
  }
  if (elapsedSince(ctx, work.blueprintJob) > BLUEPRINT_DEADLINE_MS) {
    work.blueprintRaw = null;
    ctx.patch.error_code = "blueprint_deadline";
    return { kind: "done" };
  }
  const outcome = await deps.collectBlueprint(work.blueprintJob.id);
  if (outcome.status === "pending") return { kind: "wait" };
  work.blueprintRaw = outcome.status === "done" ? outcome.raw : null;
  if (outcome.status === "done") work.blueprintModel = outcome.model;
  if (outcome.status === "failed") ctx.patch.error_code = "blueprint_failed";
  return { kind: "done" };
}

function stageValidate(ctx: Ctx): StageResult {
  const { work } = ctx;
  const profile = currentProfile(ctx)!;
  const base = buildBaseBlueprint(profile);
  const truth = buildTruthContext(profile, work.dossier ? dossierHaystack(work.dossier) : "");
  const validated = validateBlueprint(work.blueprintRaw ?? null, profile, truth, base);
  ctx.patch.preview_blueprint = validated.blueprint;
  work.blueprintSource = validated.source;
  work.rejections = validated.rejections.slice(0, 20);
  delete work.blueprintRaw;
  return { kind: "done" };
}

function stageRender(ctx: Ctx): StageResult {
  const profile = currentProfile(ctx)!;
  const blueprint = ctx.patch.preview_blueprint ?? ctx.row.preview_blueprint!;
  try {
    ctx.work.render = ctx.deps.renderCheck(toPreviewDocument(ctx.row.id, profile, blueprint));
    return { kind: "done" };
  } catch (error) {
    console.error("[preview/pipeline] render check failed, falling back to base blueprint:", error);
    try {
      const truth = buildTruthContext(profile, ctx.work.dossier ? dossierHaystack(ctx.work.dossier) : "");
      const fallback = validateBlueprint(null, profile, truth, buildBaseBlueprint(profile));
      ctx.patch.preview_blueprint = fallback.blueprint;
      ctx.work.blueprintSource = "base";
      ctx.work.render = ctx.deps.renderCheck(toPreviewDocument(ctx.row.id, profile, fallback.blueprint));
      return { kind: "done" };
    } catch {
      return { kind: "error", code: "render_failed", fatal: true };
    }
  }
}

function stageStore(ctx: Ctx): StageResult {
  const now = ctx.deps.now();
  ctx.patch.status = "ready";
  ctx.patch.ready_at = iso(now);
  ctx.patch.expires_at = iso(now + 30 * 86_400_000);
  ctx.patch.engine_version = PREVIEW_ENGINE_VERSION;
  // Keep the dossier (for later re-validation and reuse) but drop job handles.
  delete ctx.work.discoveryJob;
  delete ctx.work.investigationJob;
  delete ctx.work.blueprintJob;
  return { kind: "done" };
}

async function stageNotify(ctx: Ctx): Promise<StageResult> {
  const row = { ...ctx.row, ...ctx.patch } as PreviewRow;
  if (!row.email || row.notified_at) return { kind: "done", skipped: true };
  if (!(await ctx.deps.store.markNotified(row.id))) return { kind: "done", skipped: true };
  const sent = await ctx.deps.sendReadyEmail(row);
  if (!sent) return { kind: "error", code: "email_failed" };
  return { kind: "done" };
}

const HANDLERS: Record<StageName, (ctx: Ctx) => Promise<StageResult> | StageResult> = {
  identity: stageIdentity,
  discovery: stageDiscovery,
  crawl: stageCrawl,
  research: stageResearch,
  truth_bundle: stageTruthBundle,
  blueprint: stageBlueprint,
  validate: stageValidate,
  render: stageRender,
  store: stageStore,
  notify: stageNotify,
};

/** Stages whose failure can be absorbed by moving on with less data. */
const DEGRADABLE: Partial<Record<StageName, (ctx: Ctx) => void | Promise<void>>> = {
  // The site could not be read: keep the verified identity and the official
  // address, build from what the registry and the search established (level B).
  crawl: async (ctx) => {
    const discovery = ctx.work.discovery ?? null;
    const registry = ctx.work.registry ?? null;
    ctx.work.assets = null;
    ctx.work.observedColors = [];
    ctx.work.dossier = await buildDossier(
      {
        entreprise: (discovery?.name || registry?.commercialName || registry?.name || ctx.row.input.companyName).slice(0, 160),
        siteUrl: discovery?.website ?? "",
        secteur: discovery?.sector ?? "",
        ville: discovery?.city || registry?.city || ctx.work.userCity || "",
      },
      { crawl: async (url) => unreadableCrawl(url) }
    );
  },
  research: (ctx) => {
    ctx.work.diagnostic = siteOnlyDiagnostic(toAuditContext(ctx.work.dossier!));
    ctx.work.research = null;
  },
  blueprint: (ctx) => {
    ctx.work.blueprintRaw = null;
  },
  notify: () => {},
};

// ---------------------------------------------------------------------------
// The advancer

/**
 * Worst-case duration of one pass of a stage. A request never starts a pass
 * it cannot finish inside the host's 10 s limit: after the first pass, the
 * loop stops when elapsed + cost would exceed the budget (+ a 2 s margin).
 */
function stageCost(stage: StageName, work: PreviewWork): number {
  switch (stage) {
    case "discovery":
      return work.discoveryJob ? 9_000 : 4_000; // poll + domain verification, or job start
    case "identity":
      return work.registry === null && !work.registryRetried ? 4_500 : 500;
    case "crawl":
      return 7_500; // bounded crawl + one stylesheet
    case "truth_bundle":
      return 4_000; // may look the SIREN up
    case "research":
      return work.investigationJob ? 5_500 : 4_000;
    case "blueprint":
      return work.blueprintJob ? 5_500 : 4_000;
    case "notify":
      return 5_500;
    default:
      return 500;
  }
}

export type AdvanceResult = { row: PreviewRow; advanced: boolean };

export async function advancePreview(id: string, deps: PipelineDeps, budgetMs = DEFAULT_BUDGET_MS): Promise<AdvanceResult | null> {
  const claimed = await deps.store.claim(id, LEASE_MS);
  if (!claimed) return null;
  if (!claimed.leaseId) return { row: claimed.row, advanced: false };
  const row = claimed.row;
  const finished = row.status === "ready" && row.stage === "notify" && row.pipeline.notify.status !== "pending" && row.pipeline.notify.status !== "running";
  if (finished || row.status === "failed" || row.status === "needs_input") {
    await deps.store.save(id, claimed.leaseId, {});
    return { row, advanced: false };
  }

  const ctx: Ctx = { row, work: structuredClone(row.work ?? {}), patch: {}, deps, started: deps.now() };
  const pipeline: PipelineState = structuredClone(row.pipeline);
  let stage: StageName = row.stage;
  let advanced = false;

  let passes = 0;
  while (deps.now() - ctx.started < budgetMs) {
    if (passes > 0 && deps.now() - ctx.started + stageCost(stage, ctx.work) > budgetMs + 2_000) break;
    passes += 1;
    const state = pipeline[stage];
    if (state.status === "pending") {
      state.status = "running";
      state.startedAt = iso(deps.now());
      state.engineVersion = stage === "blueprint" || stage === "validate" ? `${PREVIEW_ENGINE_VERSION}/${PREVIEW_BLUEPRINT_VERSION}` : PREVIEW_ENGINE_VERSION;
    }

    const stageStart = deps.now();
    let result: StageResult;
    try {
      result = await HANDLERS[stage](ctx);
    } catch (error) {
      console.error(`[preview/pipeline] stage ${stage} threw:`, error);
      result = { kind: "error", code: `${stage}_exception` };
    }
    ctx.work.timings = { ...ctx.work.timings, [stage]: (ctx.work.timings?.[stage] ?? 0) + (deps.now() - stageStart) };

    if (result.kind === "wait") break;

    if (result.kind === "needs") {
      ctx.patch.status = "needs_input";
      ctx.patch.needs = result.needs;
      state.status = "pending";
      advanced = true;
      break;
    }

    if (result.kind === "error") {
      state.retryCount += 1;
      state.errorCode = result.code;
      advanced = true;
      if (!result.fatal && state.retryCount < MAX_STAGE_RETRIES) break;
      const degrade = DEGRADABLE[stage];
      if (result.fatal || !degrade) {
        state.status = "failed";
        ctx.patch.status = "failed";
        ctx.patch.error_code = result.code;
        break;
      }
      await degrade(ctx);
      result = { kind: "done", skipped: true };
    }

    state.status = result.skipped ? "skipped" : "done";
    state.completedAt = iso(deps.now());
    advanced = true;

    const next = result.jumpTo ?? nextStage(stage);
    if (result.jumpTo) {
      for (const skipped of STAGES.slice(STAGES.indexOf(stage) + 1, STAGES.indexOf(result.jumpTo))) {
        pipeline[skipped] = { ...pipeline[skipped], status: "skipped", completedAt: iso(deps.now()) };
      }
    }
    if (!next) break;
    stage = next;
  }

  const status = ctx.patch.status ?? (row.status === "ready" ? "ready" : "running");
  const patch: PreviewPatch = { ...ctx.patch, status, needs: status === "needs_input" ? ctx.patch.needs ?? row.needs : null, stage, pipeline, work: ctx.work };

  const saved = await deps.store.save(id, claimed.leaseId, patch);
  if (!saved) return { row, advanced: false };
  return { row: { ...row, ...patch } as PreviewRow, advanced };
}

/**
 * Applies the visitor's answer to a "needs_input" question and puts the
 * preview back on track: a city re-runs identification, a site address (or
 * "no site") re-runs discovery with it.
 */
export async function clarifyPreview(
  id: string,
  answer: { city?: string; siteUrl?: string; noSite?: boolean },
  deps: PipelineDeps
): Promise<PreviewRow | null> {
  const claimed = await deps.store.claim(id, LEASE_MS);
  if (!claimed?.leaseId) return claimed?.row ?? null;
  const row = claimed.row;
  if (row.status !== "needs_input") {
    await deps.store.save(id, claimed.leaseId, {});
    return row;
  }
  const work: PreviewWork = structuredClone(row.work ?? {});
  const pipeline = structuredClone(row.pipeline);
  let stage: StageName = "discovery";
  if (answer.city) {
    work.userCity = answer.city.slice(0, 120);
    delete work.registry;
    delete work.candidates;
    delete work.discovery;
    work.rescueTried = false;
    stage = "identity";
  }
  if (answer.siteUrl) work.userSite = answer.siteUrl.slice(0, 300);
  if (answer.noSite) work.noSite = true;
  delete work.discoveryJob;
  for (const name of STAGES.slice(STAGES.indexOf(stage))) pipeline[name] = { ...pipeline[name], status: "pending", errorCode: undefined };
  const patch: PreviewPatch = { status: "running", needs: null, stage, work, pipeline };
  await deps.store.save(id, claimed.leaseId, patch);
  return { ...row, ...patch } as PreviewRow;
}

/** Stage progress as the visitor sees it: real stages, honest labels. */
export const STAGE_LABELS: Record<StageName, string> = {
  identity: "Identification de votre entreprise",
  discovery: "Recherche de votre site et de votre présence publique",
  crawl: "Lecture de votre site, page par page",
  research: "Analyse de votre présence et de votre marché local",
  truth_bundle: "Vérification de chaque information",
  blueprint: "Composition de votre nouvelle vitrine",
  validate: "Contrôle : rien d’inventé",
  render: "Mise en page",
  store: "Enregistrement",
  notify: "Prête",
};

export type PublicStatus = {
  id: string;
  status: PreviewRow["status"];
  stage: StageName;
  stageIndex: number;
  stageCount: number;
  stageStartedAt?: string;
  label: string;
  needs: PreviewRow["needs"];
  companyName: string;
  city?: string;
  hasEmail: boolean;
};

export function publicStatus(row: PreviewRow): PublicStatus {
  return {
    id: row.id,
    status: row.status,
    stage: row.stage,
    stageIndex: STAGES.indexOf(row.stage),
    stageCount: STAGES.length,
    ...(row.pipeline?.[row.stage]?.startedAt ? { stageStartedAt: row.pipeline[row.stage].startedAt } : {}),
    label: row.status === "ready" ? "Votre vitrine est prête" : STAGE_LABELS[row.stage],
    needs: row.needs,
    companyName: row.company_name,
    ...(row.work?.registry?.city || row.work?.discovery?.city ? { city: row.work.registry?.city || row.work.discovery?.city } : {}),
    hasEmail: Boolean(row.email),
  };
}

export type { FetchLike };
