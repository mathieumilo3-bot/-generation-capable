import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { SECTORS } from "@/lib/data/sectors";
import { ARTICLES } from "@/lib/data/articles";
import { SEO_LANDINGS } from "@/lib/data/seo-landings";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/audit`, lastModified: "2026-09-22", changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/a-propos`, lastModified: "2026-09-22", changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/secteurs`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/applications`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/ressources`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/solutions`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/creation-site-internet`, lastModified: "2026-09-21", changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/agence-web`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/acquisition`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/seo`, lastModified: "2026-09-22", changeFrequency: "monthly", priority: 0.6 },
  ];

  const sectorRoutes: MetadataRoute.Sitemap = SECTORS.map((sector) => ({
    url: `${SITE_URL}/secteurs/${sector.slug}`,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const articleRoutes: MetadataRoute.Sitemap = ARTICLES.map((article) => ({
    url: `${SITE_URL}/ressources/${article.slug}`,
    lastModified: article.publishedAt,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  const updatedSolutionDates: Record<string, string> = {
    "referencement-local": "2026-09-21",
    "marketing-digital-btp": "2026-09-22",
    "audit-seo": "2026-09-21",
    "google-business-profile": "2026-09-21",
    "generation-de-leads": "2026-09-21",
    "publicite-google-ads": "2026-09-21",
    "generation-leads-b2b": "2026-09-21",
    "creation-site-artisan": "2026-09-22",
  };

  const solutionRoutes: MetadataRoute.Sitemap = SEO_LANDINGS.map((page) => ({
    url: `${SITE_URL}/solutions/${page.slug}`,
    lastModified: updatedSolutionDates[page.slug] ?? "2026-09-20",
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...solutionRoutes, ...sectorRoutes, ...articleRoutes];
}
