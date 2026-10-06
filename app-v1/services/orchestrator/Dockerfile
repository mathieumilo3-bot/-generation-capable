# Build depuis la racine app-v1 :  docker build -f services/orchestrator/Dockerfile -t orchestrator .
FROM node:22-slim AS base
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/config/package.json packages/config/
COPY packages/domain/package.json packages/domain/
COPY packages/api/package.json packages/api/
COPY packages/video-engine/package.json packages/video-engine/
COPY services/orchestrator/package.json services/orchestrator/
COPY supabase/functions/package.json supabase/functions/
# Les autres workspaces ne sont pas nécessaires à l'orchestrateur : on installe uniquement les siens.
RUN npm ci --workspace @app/orchestrator --include-workspace-root --ignore-scripts
COPY packages packages
COPY services/orchestrator services/orchestrator
COPY supabase/functions/_shared supabase/functions/_shared
ENV NODE_ENV=production
USER node
CMD ["npx", "tsx", "services/orchestrator/src/index.ts"]
