# ============================================================================
# AI Engine - Cloud Run Service (Multi-stage Build)
# Optimized for Cloud Run cold start & minimal image size
#
# v7.0 - 2026-01-08 (Security & Registry Optimization)
# - Explicit Alpine 3.21 version for reproducibility
# - Enhanced security with non-root user
# - Artifact Registry migration (gcr.io deprecated)
# - cpu-boost enabled for faster cold start
#
# v6.0 - 2026-01-06 (Docker & Build Optimization)
# - Node.js 24.x LTS (latest stable)
# - npm ci for reproducible builds
# - BuildKit cache mounts for faster rebuilds
# - Optimized COPY order for better layer caching
# - Updated memory to 512MB for SSOT data handling
#
# v5.0 - 2026-01-06 (SSOT Data Sync & Optimization)
# - hourly-data SSOT: Vercel ↔ Cloud Run 동기화
# - npm cache clean for smaller image
#
# v4.0 - 2025-12-29 (Observability & Resilience)
# - Langfuse LLM Observability
# - Circuit Breaker pattern
# ============================================================================

# Build arguments - explicit versions for reproducibility
ARG NODE_VERSION=24
ARG ALPINE_VERSION=3.21

# ============================================================================
# Stage 1: Dependencies (cached layer)
# ============================================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS deps

WORKDIR /app

# Install dumb-init for proper signal handling (PID 1 problem)
# Use --no-cache to avoid storing apk index in image
RUN apk add --no-cache dumb-init

# Copy package files first (maximize cache hit)
COPY package.json package-lock.json ./

# Install dependencies with npm ci for reproducibility
# Note: Cloud Build caches layers, so npm cache is cleaned to reduce image size
RUN npm ci --legacy-peer-deps --ignore-scripts && \
    npm cache clean --force

# ============================================================================
# Stage 2: Build
# ============================================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS builder

WORKDIR /app

# Copy deps from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy config files first (rarely change)
COPY package.json tsconfig.json ./

# Copy source directory
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Prune dev dependencies after build
RUN npm prune --production --legacy-peer-deps

# ============================================================================
# Stage 3: Production (minimal)
# ============================================================================
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner

# Build-time metadata
ARG APP_VERSION=8.0.0
ARG BUILD_DATE
ARG GIT_SHA

# OCI Image Labels (standard)
LABEL org.opencontainers.image.title="AI Engine"
LABEL org.opencontainers.image.version="${APP_VERSION}"
LABEL org.opencontainers.image.description="Multi-Agent AI Supervisor for OpenManager AI"
LABEL org.opencontainers.image.source="https://github.com/skyasu2/openmanager-ai"
LABEL org.opencontainers.image.created="${BUILD_DATE}"
LABEL org.opencontainers.image.revision="${GIT_SHA}"
LABEL org.opencontainers.image.base.name="node:24-alpine3.21"

# Custom labels
LABEL ai.framework="vercel-ai-sdk-v6"
LABEL ai.pattern="multi-agent-ssot"
LABEL ai.observability="langfuse"
LABEL ai.resilience="circuit-breaker"
LABEL ai.registry="artifact-registry"

WORKDIR /app

# Production environment
ENV NODE_ENV=production
ENV PORT=8080

# Cloud Run optimized Node.js settings (FREE TIER)
# - max-old-space-size: 384MB (within 512Mi container limit)
# - enable-source-maps: Better error traces
# - dns-result-order: IPv4 first (Cloud Run optimization)
# - no-warnings: Reduce noise in logs
ENV NODE_OPTIONS="--max-old-space-size=384 --enable-source-maps --dns-result-order=ipv4first"

# Copy dumb-init from deps stage
COPY --from=deps /usr/bin/dumb-init /usr/bin/dumb-init

# Security: non-root user with minimal privileges
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs --home /app appuser

# Copy only production dependencies from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy built files
COPY --from=builder /app/dist ./dist

# Copy data files (SSOT)
# - precomputed-states.json: O(1) lookup for AI context
# - hourly-data/: Synced with src/data/hourly-data/ (FALLBACK)
# - otel-processed/: Pre-aggregated OTel metrics (PRIMARY)
COPY data/precomputed-states.json ./data/
COPY data/hourly-data/ ./data/hourly-data/
COPY data/otel-processed/ ./data/otel-processed/

# Copy config files (SSOT)
# - system-rules.json: Threshold values synced with Vercel
COPY config/system-rules.json ./config/

# Set ownership and switch to non-root
RUN chown -R appuser:nodejs /app
USER appuser

# Health check (lightweight, using wget)
# - Increased start-period for cold start
# - Reduced retries for faster failure detection
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=2 \
    CMD wget -q --spider http://localhost:8080/health || exit 1

EXPOSE 8080

# Use dumb-init as entrypoint for proper signal handling
# - Forwards SIGTERM to node process
# - Ensures graceful shutdown (Langfuse trace flush)
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Direct node execution (fastest startup)
CMD ["node", "dist/server.js"]
