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
      // Demonstrations live under their own path; the bare prefix has no page.
      { source: "/demonstrations", destination: "/etudes-de-cas", permanent: false },
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
    ];
  },
};

export default nextConfig;
