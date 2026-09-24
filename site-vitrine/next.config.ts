import type { NextConfig } from "next";
import path from "path";

/**
 * Sent on every response. Deliberately excludes a Content-Security-Policy:
 * the App Router emits inline bootstrap scripts, so a useful CSP needs
 * per-request nonces via middleware — a separate change, tracked in the
 * README, rather than a permissive policy that only looks protective.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Lets /api/preview/health report which commit is deployed (burn-in waits for it).
  env: { GC_BUILD_COMMIT: process.env.COMMIT_REF ?? "" },
  turbopack: {
    root: path.join(__dirname),
  },
  // No need to advertise the framework and its version.
  poweredByHeader: false,
  async redirects() {
    return [
      // /cas-clients had become a second copy of /applications, down to the
      // same <title>. One canonical page, the old URLs still resolve.
      { source: "/cas-clients", destination: "/applications", permanent: true },
      { source: "/cas-clients/:slug", destination: "/applications", permanent: true },
      // Short, memorable entry points keep external links stable while each
      // search intent has one canonical destination.
      { source: "/marketing-digital", destination: "/solutions/agence-marketing-digital", permanent: true },
      { source: "/google-ads", destination: "/solutions/publicite-google-ads", permanent: true },
      { source: "/meta-ads", destination: "/solutions/publicite-meta-ads", permanent: true },
      { source: "/seo-local", destination: "/solutions/referencement-local", permanent: true },
      { source: "/google-business", destination: "/solutions/google-business-profile", permanent: true },
      { source: "/generation-de-leads", destination: "/solutions/generation-de-leads", permanent: true },
      { source: "/generation-leads-b2b", destination: "/solutions/generation-leads-b2b", permanent: true },
      { source: "/marketing-btp", destination: "/solutions/marketing-digital-btp", permanent: true },
      { source: "/site-dentiste", destination: "/solutions/creation-site-dentiste", permanent: true },
      { source: "/marketing-dentiste", destination: "/solutions/marketing-digital-dentiste", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Lead data: never cached by an intermediary, never indexed.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        // Signed, immutable image proxy of the preview engine: cacheable.
        source: "/api/preview/image",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
      {
        // Private previews of real companies: never indexed, never followed.
        source: "/audit/preview-v2/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/audit/preview-v2",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
