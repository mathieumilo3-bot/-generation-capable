import { describe, expect, it } from "vitest";
import { ARTICLES } from "./articles";
import { SEO_LANDINGS } from "./seo-landings";

describe("SEO content registry", () => {
  it("keeps solution slugs unique", () => {
    const slugs = SEO_LANDINGS.map((page) => page.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps article slugs unique", () => {
    const slugs = ARTICLES.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps every related solution reference valid", () => {
    const validSlugs = new Set(SEO_LANDINGS.map((page) => page.slug));
    for (const page of SEO_LANDINGS) {
      for (const related of page.related) {
        expect(validSlugs.has(related), `${page.slug} references missing solution ${related}`).toBe(true);
      }
    }
  });

  it("gives each commercial landing enough substance to stand alone", () => {
    for (const page of SEO_LANDINGS) {
      expect(page.title.trim().length, `${page.slug} title`).toBeGreaterThan(20);
      expect(page.metaDescription.trim().length, `${page.slug} meta description`).toBeGreaterThan(80);
      expect(page.h1.trim().length, `${page.slug} h1`).toBeGreaterThan(20);
      expect(page.intro.trim().length, `${page.slug} intro`).toBeGreaterThan(100);
      expect(page.blocks.length, `${page.slug} blocks`).toBeGreaterThanOrEqual(4);
      expect(page.faqs.length, `${page.slug} faqs`).toBeGreaterThanOrEqual(3);
    }
  });

  it("does not duplicate exact commercial titles or H1s", () => {
    const titles = SEO_LANDINGS.map((page) => page.title.toLowerCase());
    const h1s = SEO_LANDINGS.map((page) => page.h1.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(h1s).size).toBe(h1s.length);
  });

  it("keeps resource articles substantial enough to support commercial pages", () => {
    for (const article of ARTICLES) {
      expect(article.content.length, `${article.slug} paragraphs`).toBeGreaterThanOrEqual(4);
      expect(article.excerpt.trim().length, `${article.slug} excerpt`).toBeGreaterThan(50);
    }
  });
});
