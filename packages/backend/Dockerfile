# Build stage
FROM oven/bun:1 as builder

WORKDIR /app

# Copy workspace files
COPY package.json bun.lockb* ./
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source files
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

# Build
WORKDIR /app/packages/backend
RUN bun run build

# Production stage
FROM oven/bun:1-slim

WORKDIR /app

# Copy built files
COPY --from=builder /app/packages/backend/dist ./dist
COPY --from=builder /app/packages/backend/package.json ./
COPY --from=builder /app/packages/backend/drizzle ./drizzle

# Install production dependencies only
RUN bun install --production --frozen-lockfile

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the server
CMD ["bun", "run", "dist/index.js"]



