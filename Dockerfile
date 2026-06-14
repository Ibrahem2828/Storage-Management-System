FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN npm install --global npm@10.8.2

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY nest-cli.json tsconfig.json tsconfig.build.json tsconfig.database.json ./
COPY database ./database
COPY src ./src

RUN npm run build \
  && npm prune --omit=dev \
  && npm cache clean --force

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_PATH=/app/data/storage.sqlite \
    UPLOADS_DIR=/app/uploads \
    CORS_ORIGIN=*

COPY package.json package-lock.json ./
COPY database/schema.sql ./database/schema.sql
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-database ./dist-database
COPY docker/entrypoint.sh /usr/local/bin/sms-entrypoint

RUN mkdir -p /app/data /app/uploads /app/reports /app/backups \
  && chmod +x /usr/local/bin/sms-entrypoint

EXPOSE 4000

ENTRYPOINT ["sms-entrypoint"]
