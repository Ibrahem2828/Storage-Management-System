FROM node:20-bookworm-slim AS builder

WORKDIR /app

ENV NODE_ENV=development

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY nest-cli.json tsconfig.json tsconfig.build.json tsconfig.seed.json ./
COPY src ./src

RUN npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000 \
    DATABASE_URL=file:/app/data/SMSdata.db \
    UPLOADS_DIR=/app/uploads \
    REPORTS_DIR=/app/reports \
    BACKUPS_DIR=/app/backups \
    CORS_ORIGIN=*



    
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev \
  && npx prisma generate \
  && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-seed ./dist-seed
COPY docker/entrypoint.sh /usr/local/bin/sms-entrypoint

RUN mkdir -p /app/data /app/uploads /app/reports /app/backups \
  && chmod +x /usr/local/bin/sms-entrypoint

EXPOSE 4000

ENTRYPOINT ["sms-entrypoint"]
