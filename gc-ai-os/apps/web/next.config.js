const path = require("node:path");

/** @type {import("next").NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  serverExternalPackages: ["@gc-ai-os/runtime"],
};

module.exports = nextConfig;
