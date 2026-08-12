# Image de déploiement (Fly.io / Railway / Render / tout hébergeur Docker
# avec disque persistant). Base Debian, pas Alpine : le bundler Remotion
# (@rspack/binding-linux-x64-gnu) est un binaire natif lié à glibc.
FROM node:22-bookworm-slim

# ffmpeg (moteur de montage) + dépendances runtime Chromium headless
# (Remotion télécharge son propre binaire chrome-headless-shell au build,
# voir plus bas — ces libs sont ce dont CE binaire a besoin pour s'exécuter).
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg ca-certificates wget \
    fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libcairo2 \
    libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0 \
    libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 \
    libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY apps ./apps
COPY db-migrations ./db-migrations

RUN pnpm install --frozen-lockfile
RUN pnpm run build

# Pré-télécharge le Chromium headless-shell de Remotion pendant le build de
# l'image — voir packages/render/scripts/ensure-browser.mjs. Évite toute
# dépendance réseau et toute latence au premier rendu en production.
RUN node packages/render/scripts/ensure-browser.mjs

ENV NODE_ENV=production
ENV VIDEO_EDITOR_STORAGE_ROOT=/data
EXPOSE 3000

WORKDIR /app/apps/web
CMD ["node", "node_modules/.bin/next", "start", "-p", "3000"]
