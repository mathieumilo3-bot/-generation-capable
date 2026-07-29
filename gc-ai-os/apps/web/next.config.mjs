/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@gc-ai-os/shared-types",
    "@gc-ai-os/model-provider",
    "@gc-ai-os/agents-core",
    "@gc-ai-os/cto-agent",
    "@gc-ai-os/devops-agent",
    "@gc-ai-os/orchestrator",
    "@gc-ai-os/memory",
    "@gc-ai-os/security",
    "@gc-ai-os/runtime",
  ],
};

export default nextConfig;
