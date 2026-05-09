# Testing & Deployment: Auto-Accrue System

This guide explains how to test the new idempotent interest accrual system locally and how to deploy it to production.

## 1. Local Testing Setup

### Step A: Apply Migrations
First, ensure your local `local.db` is up to date:
```bash
# Automatically apply all pending migrations
bun run db:migrate
```

### Step B: Generate a Local API Key
Since you need an API key to test the authenticated endpoint, run this temporary script to create one for your user:

```bash
# Create a temporary script
cat <<EOF > scripts/gen-test-key.ts
import { auth } from "../lib/auth/auth";
import { db } from "../lib/db";
import { user } from "../lib/db/schema/auth";

async function run() {
  const firstUser = await db.select().from(user).limit(1);
  if (firstUser.length === 0) {
    console.error("No user found. Please sign up in the UI first.");
    return;
  }

  const key = await auth.api.createApiKey({
    body: {
      name: "Local Test Key",
      userId: firstUser[0].id
    }
  });

  console.log("\n✅ API KEY GENERATED:");
  console.log(key.key);
  console.log("\nKeep this key safe. Use it in your curl commands below.");
}

run().catch(console.error);
EOF

# Run it
bun scripts/gen-test-key.ts
```

---

## 2. Verify Idempotency & Timezone

### Step A: Start the Server
```bash
bun dev
```

### Step B: Trigger Accrual via Curl
Replace `YOUR_KEY` with the key generated in Step 1B.

```bash
# 1. Trigger first time (should add missing transactions)
curl -X POST http://localhost:3000/api/accrue-interest \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json"

# 2. Trigger again immediately (should add 0 transactions)
curl -X POST http://localhost:3000/api/accrue-interest \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json"
```

### Step C: Check Database
Verify that transactions were added correctly:
```bash
sqlite3 local.db "SELECT * FROM transactions WHERE type='interest';"
```

---

## 3. Production Deployment

### Step A: Deploy Code to Fly.io
Simply push to `main` or run:
```bash
fly deploy
```
Migrations will run automatically during the deployment process.

### Step B: Generate Production API Key
1. Login to your production site.
2. (Optional) If you haven't built a UI for keys yet, use `fly ssh console` and run the generation script logic there, or temporarily expose a route.
3. **Recommended**: Use the `fix-db.ts` logic to ensure your prod DB is clean before the first cron runs.

### Step C: Configure GitHub Secrets
1. Go to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**.
2. Add a new repository secret:
   - Name: `CRON_API_KEY`
   - Value: `[Your Production API Key]`

---

## 4. Maintenance

- **Manual Re-sync**: If you ever suspect the ledger is out of sync, call the API with the `"action": "apply"` body. This will wipe and regenerate all interest entries safely.
- **Logs**: Monitor the "Actions" tab in GitHub to ensure the daily cron is running successfully.
