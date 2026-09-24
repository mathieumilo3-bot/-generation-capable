import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { fixtureDeps } from "@/lib/preview-engine/fixtures";
import { advancePreview, defaultDeps, initialPipeline } from "@/lib/preview-engine/pipeline";
import { toPreviewDocument, type PreviewDocument } from "@/lib/preview-engine/public-view";
import { checkRenderable } from "@/lib/preview-engine/render-check";
import { MemoryPreviewStore } from "@/lib/preview-engine/store";
import { PreviewSite } from "./PreviewSite";

const docs: Record<string, PreviewDocument> = {};

async function build(name: string, city = "") {
  const store = new MemoryPreviewStore();
  const deps = defaultDeps(store, { ...fixtureDeps({ discovery: 0, investigation: 0, blueprint: 0 }), renderCheck: checkRenderable });
  const registry = await deps.lookupRegistry(name, city);
  const row = await store.create({
    id: randomUUID(),
    idempotencyKey: randomUUID(),
    tokenHash: "h",
    companyName: name,
    input: { companyName: name },
    attribution: {},
    pipeline: initialPipeline(),
    work: { registry: registry.status === "unique" ? registry.candidates[0] : null, ...(city ? { userCity: city } : {}) },
    stage: "identity",
    engineVersion: "t",
  });
  for (let i = 0; i < 30; i += 1) if ((await advancePreview(row!.id, deps))!.row.status !== "running") break;
  const done = (await store.get(row!.id))!;
  return toPreviewDocument(done.id, done.company_profile!, done.preview_blueprint!);
}

beforeAll(async () => {
  docs.rich = await build("Toiture Martin", "Vannes");
  docs.blank = await build("Atelier Sans Site");
});

describe("PreviewSite renderer", () => {
  it.each(["rich", "blank"])("renders the %s preview deterministically, as text only", (key) => {
    const html = renderToStaticMarkup(<PreviewSite doc={docs[key]} />);
    expect(html).toContain(docs[key].blueprint.hero.headline.replace(/’/g, "’"));
    expect(html).not.toMatch(/<script|<h1|javascript:|onerror=/i);
    expect(html.match(/<h2/g)?.length).toBeGreaterThanOrEqual(1);
    expect(renderToStaticMarkup(<PreviewSite doc={docs[key]} />)).toBe(html);
  });

  it("shows real photos only through the proxy, with lazy loading", () => {
    const html = renderToStaticMarkup(<PreviewSite doc={docs.rich} />);
    const srcs = [...html.matchAll(/<img[^>]*src="([^"]+)"/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThan(2);
    expect(srcs.every((src) => src.startsWith("/api/preview/image?u="))).toBe(true);
    expect(html).toContain('loading="lazy"');
    expect(html).toContain("Réalisations publiées sur votre site actuel.");
  });

  it("never renders an empty section for a company without material", () => {
    const html = renderToStaticMarkup(<PreviewSite doc={docs.blank} />);
    expect(html).not.toContain('id="gcp-realisations"');
    expect(html).not.toMatch(/avis|étoiles|4,9/i);
    expect(html).not.toContain("Appeler");
  });

  it("escapes hostile text coming from a crawled site", () => {
    const hostile: PreviewDocument = {
      ...docs.rich,
      site: { ...docs.rich.site, name: '<img src=x onerror="alert(1)">' },
    };
    const html = renderToStaticMarkup(<PreviewSite doc={hostile} />);
    expect(html).not.toContain('<img src=x onerror="alert(1)">');
    expect(html).toContain("&lt;img src=x onerror=");
  });
});
