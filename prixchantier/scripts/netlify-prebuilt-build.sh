#!/usr/bin/env bash
set -euo pipefail

cp netlify.toml /tmp/prixchantier-netlify-outer.toml
restore() {
  cp /tmp/prixchantier-netlify-outer.toml netlify.toml
}
trap restore EXIT

rm -rf .netlify
mkdir -p .netlify
printf '{"siteId":"043f9a8f-7a88-4f95-b3c8-85b8c5606799"}' > .netlify/state.json

cat > netlify.toml <<'EOF'
[build]
  command = "npm run build"

[[plugins]]
  package = "@netlify/plugin-nextjs"
EOF

NETLIFY_NEXT_PLUGIN_SKIP=0 npx -y netlify-cli@latest build --offline
restore
trap - EXIT

test -f .netlify/functions/___netlify-server-handler.zip
test -d .netlify/static
test -d .netlify/edge-functions/___netlify-edge-handler-node-middleware
