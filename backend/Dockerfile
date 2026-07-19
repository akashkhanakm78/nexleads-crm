# ─── Stage 1: Build TypeScript ───────────────────────────────────────────────
FROM node:20-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && \
    pnpm config set verify-store-integrity false && \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm prisma generate
RUN pnpm run build

# ─── Stage 2: Production Runtime ─────────────────────────────────────────────
FROM node:20-slim AS runner

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Install only production deps and regenerate Prisma client in runner
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN npm install -g pnpm && \
    pnpm config set verify-store-integrity false && \
    pnpm install --frozen-lockfile --prod && \
    pnpm prisma generate

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

EXPOSE 5000

CMD ["node", "dist/index.js"]
