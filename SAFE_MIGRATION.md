# Safe Migration Guide for Existing Database

## Overview

Your database already has tables created by `/api/init`. The new Drizzle migration creates the exact same tables, so we need to handle this gracefully.

## Option 1: Skip Migration (RECOMMENDED - Zero Downtime)

Since the tables already exist with the correct schema, **you don't need to run the migration at all!**

The Drizzle ORM code works with existing tables. Just deploy the new code:

```bash
fly deploy
```

That's it! ✅

### Why This Works

- The table schemas haven't changed, only how we query them
- Drizzle reads the existing tables just fine
- No data migration needed
- Zero downtime
- No risk of data loss

## Option 2: Verify Schema Matches (Optional)

If you want to be extra sure, verify your existing schema matches:

```bash
# Connect to your database
turso db shell <your-db-name>

# Check table structure
.schema transactions
.schema interest_rates
.schema balance_snapshots
.schema invite_codes
```

Expected schemas:
```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal', 'interest')),
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE interest_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rate REAL NOT NULL,
  effective_date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE balance_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  balance REAL NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invite_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  email TEXT,
  used_by TEXT,
  created_by TEXT,
  used_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT
);
```

If they match, you're good! Just deploy.

## Option 3: Full Backup and Restore (If Schemas Don't Match)

**⚠️ Only do this if your schemas are different from above!**

### Step 1: Backup Data

```bash
# Export all data to CSV/SQL
turso db shell <your-db-name>
```

In the Turso shell:
```sql
-- Backup transactions
.mode csv
.output transactions_backup.csv
SELECT * FROM transactions;

-- Backup interest_rates
.output interest_rates_backup.csv
SELECT * FROM interest_rates;

-- Backup invite_codes (if exists)
.output invite_codes_backup.csv
SELECT * FROM invite_codes;

-- Backup balance_snapshots (if exists)
.output balance_snapshots_backup.csv
SELECT * FROM balance_snapshots;

.output stdout
```

Or use SQL dump:
```bash
# Better: Get full SQL dump
turso db shell <your-db-name> .dump > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Step 2: Drop Old Tables

```bash
turso db shell <your-db-name>
```

```sql
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS interest_rates;
DROP TABLE IF EXISTS balance_snapshots;
DROP TABLE IF EXISTS invite_codes;
```

### Step 3: Run New Migration

```bash
cat drizzle/0000_consolidated_all_tables.sql | turso db shell <your-db-name>
```

### Step 4: Restore Data

```bash
turso db shell <your-db-name>
```

```sql
-- Restore transactions
.mode csv
.import transactions_backup.csv transactions

-- Restore interest_rates
.import interest_rates_backup.csv interest_rates

-- Restore invite_codes
.import invite_codes_backup.csv invite_codes

-- Restore balance_snapshots
.import balance_snapshots_backup.csv balance_snapshots
```

Or from SQL dump:
```bash
cat backup_YYYYMMDD_HHMMSS.sql | turso db shell <your-db-name>
```

### Step 5: Verify Data

```bash
turso db shell <your-db-name>
```

```sql
SELECT COUNT(*) FROM transactions;
SELECT COUNT(*) FROM interest_rates;
SELECT COUNT(*) FROM invite_codes;
SELECT COUNT(*) FROM balance_snapshots;
```

### Step 6: Deploy

```bash
fly deploy
```

## Option 4: Test Locally First

Before touching production, test the migration locally:

```bash
# 1. Create a local backup
cp local.db local_backup.db

# 2. Drop tables
sqlite3 local.db "DROP TABLE IF EXISTS transactions;"
sqlite3 local.db "DROP TABLE IF EXISTS interest_rates;"
sqlite3 local.db "DROP TABLE IF EXISTS balance_snapshots;"
sqlite3 local.db "DROP TABLE IF EXISTS invite_codes;"

# 3. Run migration
cat drizzle/0000_consolidated_all_tables.sql | sqlite3 local.db

# 4. Test the app
npm run dev

# 5. Verify everything works
# - Add a transaction
# - Add an interest rate
# - Check balance calculation
# - Export CSV
```

If local testing works, deploy to production.

## Recommended Approach

**For most cases**: Use **Option 1** (Skip Migration)

Your existing tables work fine with the new Drizzle code. The schemas are identical.

**Only use Option 3** if:
- You modified table schemas manually
- You have schema inconsistencies
- You want to start fresh

## Rollback Plan

If something goes wrong after deployment:

```bash
# 1. Revert deployment
fly deploy --image <previous-image-id>

# Or redeploy previous version
git revert <commit-hash>
fly deploy

# 2. Database stays the same (no changes needed)
```

## Verification After Deployment

After deploying, verify everything works:

```bash
# Check the app is running
curl https://loan-tracker.fly.dev/

# Try deprecated endpoint (should return 410)
curl https://loan-tracker.fly.dev/api/init

# Check transactions API
curl https://loan-tracker.fly.dev/api/transactions
```

## FAQ

**Q: Will the new code work with my existing tables?**  
A: Yes! The Drizzle ORM reads existing tables. No migration needed if schemas match.

**Q: Do I need to run the migration SQL file?**  
A: No, if your tables already exist with the correct schema (from `/api/init`).

**Q: What if I get errors after deploying?**  
A: Check the logs (`fly logs`). Most likely it's a missing environment variable or auth token issue, not database-related.

**Q: Can I test without affecting production?**  
A: Yes! Use Option 4 to test locally first.

**Q: What about the auth tables?**  
A: If you already ran `drizzle/0000_gorgeous_ikaris.sql`, they're fine. The consolidated migration includes them, but won't break if they exist.

## Summary

**Easiest path**: 
1. Just deploy: `fly deploy`
2. Verify it works
3. Done! ✅

No data backup needed since the schemas are identical.
