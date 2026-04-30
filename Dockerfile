# syntax=docker/dockerfile:1.6

# ---- deps stage: install all node_modules (with native build toolchain) ----
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---- builder stage: prisma generate + next build ----
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time DATABASE_URL is only used to satisfy Prisma's env() validation
# during `next build` static-page tracing. It is NOT used at runtime — the real
# DATABASE_URL comes from the runtime environment (docker-compose .env).
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public
ENV DATABASE_URL=${DATABASE_URL}
RUN npx prisma generate && npm run build

# ---- runner stage: minimal runtime image ----
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

# Copy built app and the runtime files we need
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/next.config.js ./next.config.js
COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nextjs
EXPOSE 3002

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "scripts/start-with-worker.js"]
