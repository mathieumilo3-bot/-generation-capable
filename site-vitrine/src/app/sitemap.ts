import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";
import { SECTORS } from "@/lib/data/sectors";
import { ARTICLES } from "@/lib/data/articles";
import { SEO_LANDINGS } from "@/lib/data/seo-landings";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/audit`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/secteurs`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/applications`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/ressources`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/solutions`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/creation-site-internet`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/agence-web`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/acquisition`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/seo`, changeFrequency: "monthly", priority: 0.6 },
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

  const solutionRoutes: MetadataRoute.Sitemap = SEO_LANDINGS.map((page) => ({
    url: `${SITE_URL}/solutions/${page.slug}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticRoutes, ...solutionRoutes, ...sectorRoutes, ...articleRoutes];
}
