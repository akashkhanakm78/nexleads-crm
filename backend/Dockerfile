# ─── Stage 1: Build TypeScript ───────────────────────────────────────────────
FROM node:20-slim AS builder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && \
    pnpm config set registry https://registry.npmmirror.com && \
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

# Copy node_modules and compiled output from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

EXPOSE 5000

CMD ["node", "dist/index.js"]
