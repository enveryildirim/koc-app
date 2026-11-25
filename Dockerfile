# SınavKur üretim imajı (Dokploy). Ayrıntı: DEPLOY.md
# Debian tabanlı: Prisma motoru (OpenSSL) ve sharp için.
ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- Bağımlılıklar ----------
FROM ${NODE_IMAGE} AS deps
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci --no-audit --no-fund

# ---------- Derleme ----------
FROM ${NODE_IMAGE} AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# ---------- Prisma CLI (açılışta migrate deploy için) ----------
# Standalone çıktısı CLI'ı içermez; yalnızca CLI ve motorları ayrı bir klasöre kurulur.
FROM ${NODE_IMAGE} AS prisma-cli
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /cli
COPY package.json ./app-package.json
RUN PRISMA_VERSION=$(node -p "require('./app-package.json').dependencies.prisma.replace(/^[^0-9]*/, '')") \
 && npm init -y >/dev/null && npm install --no-audit --no-fund "prisma@${PRISMA_VERSION}"

# ---------- Çalışma ----------
FROM ${NODE_IMAGE} AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/data/app.db \
    STORAGE_DIR=/app/data/storage

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=build --chown=node:node /app/prisma/migrations ./prisma/migrations
COPY --from=build --chown=node:node /app/scripts ./scripts
COPY --from=prisma-cli --chown=node:node /cli/node_modules ./prisma-cli/node_modules
COPY --chown=node:node docker-entrypoint.sh ./docker-entrypoint.sh

# Kalıcı veri: Dokploy'da adlandırılmış volume buraya bağlanır (sinavkur-data → /app/data).
# Klasör imajda node kullanıcısına ait olduğu için yeni volume da bu sahiplikle oluşur.
RUN mkdir -p /app/data/storage /app/data/backups && chown -R node:node /app/data && chmod +x docker-entrypoint.sh

USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
