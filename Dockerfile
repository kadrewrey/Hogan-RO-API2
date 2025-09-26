# Hogan RO API v2 Dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 fastify
RUN adduser --system --uid 1001 fastify

# Copy built application
COPY --from=builder --chown=fastify:fastify /app/dist ./dist
COPY --from=builder --chown=fastify:fastify /app/node_modules ./node_modules
COPY --from=builder --chown=fastify:fastify /app/package.json ./package.json

USER fastify

EXPOSE 3000

ENV PORT 3000
ENV HOST 0.0.0.0

CMD ["node", "dist/server.js"]