FROM node:22-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

WORKDIR /app

COPY gc-ai-os/package.json gc-ai-os/pnpm-lock.yaml gc-ai-os/pnpm-workspace.yaml gc-ai-os/turbo.json ./gc-ai-os/
COPY gc-ai-os/apps ./gc-ai-os/apps
COPY gc-ai-os/packages ./gc-ai-os/packages

WORKDIR /app/gc-ai-os
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @gc-ai-os/web build

WORKDIR /app/gc-ai-os/apps/web
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["pnpm", "start"]
