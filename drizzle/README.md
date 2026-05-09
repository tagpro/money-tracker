# Database Migrations

This project uses **Drizzle ORM** for all database operations and migrations.

## Migration Files

- `0000_consolidated_all_tables.sql` - **USE THIS** for new deployments (includes all tables: auth + app)
- `0000_gorgeous_ikaris.sql` - Auth tables only (deprecated, use consolidated)
- `0001_spicy_zeigeist.sql` - App tables only (deprecated, use consolidated)

## Running Migrations

### Automated (Recommended)

Migrations are now **automatic** on every deployment! 

- **How it works**: The `fly.toml` includes a `release_command` that runs `bun run db:migrate` before the new version of the app starts.
- **Safety**: If a migration fails, the deployment stops, and your production app remains on the previous stable version.

### Local Development Setup

For local development with file-based SQLite (`local.db`):

```bash
# Apply all pending migrations
bun run db:migrate
```

## Generating New Migrations

When you modify the schema in `lib/db/schema/`:

```bash
# Generate migration
bun run db:generate
```

This will create a new file in `drizzle/`. You don't need to manually apply it to production anymore—just commit the new file and push to `main`. The GitHub Action and Fly.io will handle the rest.

## Database Studio

To explore your database with a GUI:

```bash
bun run db:studio
```

## Schema Files

- `lib/db/schema/auth.ts` - Better Auth tables (user, session, account, verification)
- `lib/db/schema/app.ts` - App tables (transactions, interest_rates, balance_snapshots, invite_codes)
- `lib/db/schema/index.ts` - Exports all schemas

## Database Client

The app uses Drizzle ORM for type-safe database operations:

```typescript
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema/app';
import { eq } from 'drizzle-orm';

// Select
const allTransactions = await db.select().from(transactions);

// Insert
await db.insert(transactions).values({ type: 'deposit', amount: 100, date: '2025-01-01' });

// Update
await db.update(transactions).set({ amount: 200 }).where(eq(transactions.id, 1));

// Delete
await db.delete(transactions).where(eq(transactions.id, 1));
```

## Deprecated

### `/api/init` Endpoint

This endpoint is **deprecated** and will return a 410 Gone status.

**Before** (deprecated):
```bash
curl http://localhost:3000/api/init
```

**Now** (use migrations):
```bash
cat drizzle/0000_consolidated_all_tables.sql | turso db shell <db-name>
```

## Local Development

For local development with file-based SQLite:

```bash
# Create local db
cat drizzle/0000_consolidated_all_tables.sql | sqlite3 local.db

# Or if you have turso CLI
cat drizzle/0000_consolidated_all_tables.sql | turso db shell file:local.db
```

## Production Deployment

1. Deploy your app: `fly deploy`
2. Apply migrations to production Turso database
3. Verify tables exist

```bash
# Apply migration
cat drizzle/0000_consolidated_all_tables.sql | turso db shell <prod-db-name>

# Verify
turso db shell <prod-db-name>
> .tables
> .schema user
```

## Troubleshooting

### "table already exists" error

This means the migration has already been run. You can safely ignore this or drop the tables first (⚠️ **data loss**):

```sql
DROP TABLE IF EXISTS transactions;
DROP TABLE IF EXISTS interest_rates;
DROP TABLE IF EXISTS balance_snapshots;
DROP TABLE IF EXISTS invite_codes;
DROP TABLE IF EXISTS user;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS verification;
```

### Migration not applying

Make sure you're logged in to Turso:

```bash
turso auth login
```

### Can't find database

List your databases and use the exact name:

```bash
turso db list
```

## Best Practices

1. ✅ Always generate migrations after schema changes
2. ✅ Test migrations locally first
3. ✅ Use Drizzle ORM instead of raw SQL
4. ✅ Keep migration files in version control
5. ✅ Apply migrations in order (0000, 0001, 0002, etc.)
6. ❌ Don't edit migration files after they've been applied
7. ❌ Don't use `/api/init` endpoint (it's deprecated)
