/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le pipeline (FFmpeg, Remotion, node:sqlite) ne doit jamais être
  // bundlé par webpack — uniquement exécuté par Node directement dans les
  // routes API. Next 14 expose ça sous experimental (stabilisé en
  // `serverExternalPackages` à partir de Next 15).
  experimental: {
    serverComponentsExternalPackages: [
      "@video-editor/pipeline",
      "@video-editor/render",
      "@video-editor/db",
      "@video-editor/ingest",
      "@remotion/bundler",
      "@remotion/renderer",
      "@aws-sdk/client-s3",
      "@aws-sdk/lib-storage",
      "@aws-sdk/s3-request-presigner",
    ],
  },
};

export default nextConfig;
