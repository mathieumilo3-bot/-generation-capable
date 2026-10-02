/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Le pipeline (FFmpeg, Remotion, node:sqlite) ne doit jamais être
  // bundlé par webpack — uniquement exécuté par Node directement dans les
  // routes API. Next 14 expose ça sous experimental (stabilisé en
  // `serverExternalPackages` à partir de Next 15).
  experimental: {
    serverComponentsExternalPackages: ["@video-editor/pipeline", "@video-editor/render", "@video-editor/db", "@remotion/bundler", "@remotion/renderer"],
  },
};

export default nextConfig;
