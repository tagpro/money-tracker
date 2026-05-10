FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variable for build
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time environment variables (from build-args)
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Bundle the migration script to include all dependencies
RUN bun build scripts/migrate.ts --outfile=scripts/migrate.js --target=bun --bundle

RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

USER bun

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=builder --chown=bun:bun /app/.next/standalone ./
COPY --from=builder --chown=bun:bun /app/package.json ./package.json
COPY --from=builder --chown=bun:bun /app/.next/static ./.next/static
COPY --from=builder --chown=bun:bun /app/drizzle ./drizzle
COPY --from=builder --chown=bun:bun /app/scripts/migrate.js ./scripts/migrate.js

# Start the application using bun
CMD ["bun", "server.js"]
