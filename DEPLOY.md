# Deploying Loan Tracker to Fly.io

This guide will walk you through deploying your loan tracker application to Fly.io.

## Prerequisites

1. A [Fly.io account](https://fly.io/app/sign-up) (free tier available)
2. [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) installed on your machine
3. A [Turso](https://turso.tech) database set up (recommended for production)

## Step 1: Install Fly CLI

```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex
```

## Step 2: Login to Fly.io

```bash
fly auth login
```

This will open a browser window for you to authenticate.

## Step 3: Set Up Turso Database

1. Install Turso CLI:
```bash
brew install tursodatabase/tap/turso
# or
curl -sSfL https://get.tur.so/install.sh | bash
```

2. Login to Turso:
```bash
turso auth login
```

3. Create a database:
```bash
turso db create loan-tracker
```

4. Get the database URL:
```bash
turso db show loan-tracker
```

5. Create an auth token:
```bash
turso db tokens create loan-tracker
```

6. Save both the URL and token - you'll need them in the next step.

## Step 4: Create Fly.io Configuration

Create a `fly.toml` file in your project root (already done if it exists, otherwise create it):

```toml
app = "loan-tracker-[your-name]"  # Replace with a unique name
primary_region = "sjc"  # Or your preferred region

[build]
  [build.args]
    NODE_VERSION = "22"

[env]
  PORT = "8080"
  NODE_ENV = "production"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

  [http_service.concurrency]
    type = "requests"
    hard_limit = 250
    soft_limit = 200

[[vm]]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1
```

## Step 5: Create Dockerfile

Create a `Dockerfile` in your project root:

```dockerfile
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variable for build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

## Step 6: Update next.config.js

Update your `next.config.js` to enable standalone output:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}

module.exports = nextConfig
```

## Step 7: Create .dockerignore

Create a `.dockerignore` file:

```
.git
.gitignore
.next
node_modules
npm-debug.log
README.md
.env
.env.local
.env.*.local
*.db
*.db-shm
*.db-wal
```

## Step 8: Initialize Fly App

```bash
fly launch --no-deploy
```

When prompted:
- Choose a unique app name (or let Fly generate one)
- Select your region
- Don't add any databases (we're using Turso)
- Don't deploy yet (we need to set secrets first)

## Step 9: Set Environment Variables

Set your Turso database credentials as secrets:

```bash
fly secrets set TURSO_DATABASE_URL="libsql://your-database-url.turso.io"
fly secrets set TURSO_AUTH_TOKEN="your-auth-token-here"
```

## Step 10: Deploy!

```bash
fly deploy
```

This will:
- Build your Docker image
- Push it to Fly.io's registry
- Deploy your app
- Give you a URL like `https://loan-tracker-[your-name].fly.dev`

## Step 11: Initialize the Database

Your database tables will be created automatically when the app first starts (thanks to the `initDatabase()` call in `app/layout.tsx`).

To verify it worked, visit your app URL and add a test transaction.

## Step 12: Monitor Your App

```bash
# View logs
fly logs

# Check app status
fly status

# Open your app in browser
fly open

# SSH into your app (if needed)
fly ssh console
```

## Updating Your App

Whenever you make changes:

```bash
# Deploy the latest code
fly deploy

# If you need to update secrets
fly secrets set TURSO_DATABASE_URL="new-value"
```

## Cost Considerations

**Fly.io Free Tier includes:**
- Up to 3 shared-cpu-1x VMs with 256MB RAM
- 160GB/month outbound data transfer
- Auto-stop/start machines (perfect for personal projects)

**Turso Free Tier includes:**
- 500 databases
- 9GB total storage
- 1 billion row reads/month
- Perfect for this use case!

## Troubleshooting

### App won't start
```bash
fly logs
```
Check for errors in the logs.

### Database connection issues
Verify your secrets are set correctly:
```bash
fly secrets list
```

### Build failures
Make sure all dependencies are in `package.json` and run `npm install` locally first to test.

### Need to reset the database
Connect to Turso directly:
```bash
turso db shell loan-tracker
```

Then drop and recreate tables if needed.

## Custom Domain (Optional)

If you want to use your own domain:

```bash
# Add a certificate for your domain
fly certs add yourdomain.com

# Follow the instructions to add DNS records
fly certs show yourdomain.com
```

## Backup Strategy

Your data is stored in Turso, which provides:
- Automatic backups
- Point-in-time recovery
- Multi-region replication (on paid plans)

You can also export your data anytime using the CSV export feature in the app!

## Security Recommendations

1. **Add authentication** if you plan to expose this publicly:
   ```bash
   npm install next-auth
   ```

2. **Set up IP allowlist** on Turso if needed

3. **Enable HTTPS** (automatically done by Fly.io)

4. **Regular backups** - use the CSV export feature regularly

## Resources

- [Fly.io Documentation](https://fly.io/docs/)
- [Turso Documentation](https://docs.turso.tech/)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

## Quick Reference Commands

```bash
# Deploy
fly deploy

# View logs
fly logs

# App status
fly status

# Open app
fly open

# Scale down to zero (pause)
fly scale count 0

# Scale up
fly scale count 1

# SSH into app
fly ssh console

# Destroy app
fly apps destroy loan-tracker
```

Enjoy your deployed loan tracker! 🚀
