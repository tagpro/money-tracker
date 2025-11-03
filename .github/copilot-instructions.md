# Loan Tracker - GitHub Copilot Instructions

## Project Overview

This is a **personal loan tracker application** for tracking loans between friends with interest calculations, transaction history, and CSV exports.

**Tech Stack**: Next.js 16 (App Router, Turbopack), React 19, TypeScript, TailwindCSS v3, Turso (libSQL), Drizzle ORM, Better Auth, deployed on Fly.io.

**Authentication**: Invite-only system. First user = admin, can create invite codes for friends.

## Critical Implementation Rules

### ⚠️ Better Auth + Turso Integration

**MUST USE**: Drizzle ORM adapter
**NEVER USE**: Kysely adapter (has version conflicts with @libsql/client)

**Correct pattern** (from safe-fin project):
```typescript
import { drizzle } from "drizzle-orm/libsql";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createClient } from "@libsql/client";
import * as schema from "../db/schema";

const tursoClient = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(tursoClient, { schema });

const adapter = drizzleAdapter(db, {
  provider: "sqlite",
  schema,
});
```

### ⚠️ BigInt Serialization

**Problem**: SQLite returns BigInt for `lastInsertRowid`, which can't be JSON serialized.

**Solution**: Always convert to Number:
```typescript
const result = await db.run(/* ... */);
return NextResponse.json({ 
  id: Number(result.lastInsertRowid),
  ...body 
});
```

**Applies to**: All API routes that insert into database.

### ⚠️ Next.js 16 Suspense Requirement

**Rule**: `useSearchParams()` MUST be wrapped in Suspense boundary.

**Pattern**:
```tsx
'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function MyForm() {
  const searchParams = useSearchParams();
  // component logic
}

export default function MyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MyForm />
    </Suspense>
  );
}
```

### ⚠️ TailwindCSS Configuration

**Use**: Tailwind CSS v3 (NOT v4)

**postcss.config.mjs**:
```javascript
export default {
  plugins: {
    tailwindcss: {},      // NOT '@tailwindcss/postcss'
    autoprefixer: {},
  },
};
```

### ⚠️ Build-Time Environment Variables

**Rule**: `NEXT_PUBLIC_*` variables are baked in at build time!

**Dockerfile MUST include**:
```dockerfile
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
```

**fly.toml MUST include**:
```toml
[build.args]
  NEXT_PUBLIC_APP_URL = "https://loan-tracker.fly.dev"
```

## Project Structure

```
app/
├── api/
│   ├── auth/[...all]/        # Better Auth handler
│   ├── transactions/         # Transaction CRUD
│   ├── interest-rates/       # Interest rate CRUD
│   ├── invites/              # Invite management (admin only)
│   ├── balance/              # Balance calculation
│   ├── export/               # CSV export with daily interest
│   ├── accrue-interest/      # API to manually trigger interest accrual (POST)
│   └── init/                 # Database initialization (deprecated - use migrations)
├── login/                    # Login page
├── signup/                   # Signup page (with invite verification)
├── invites/                  # Admin invite management UI
├── page.tsx                  # Main app (protected)
└── layout.tsx                # Root layout

lib/
├── auth/
│   ├── auth.ts               # Better Auth server (Drizzle adapter)
│   └── client.ts             # Better Auth client hooks
├── db/
│   └── schema/
│       ├── auth.ts           # Drizzle schema for auth tables
│       └── index.ts          # Schema exports
└── db.ts                     # Turso client + app tables

scripts/
└── add-accrued-interest.ts   # Monthly interest calculation

drizzle/
└── 0000_gorgeous_ikaris.sql  # Auth tables migration
```

## Database Schema

### App Tables (lib/db/schema/app.ts - Drizzle)
- **transactions**: id, type (deposit/withdrawal/interest), amount, date, description, createdAt
- **interestRates**: id, rate, effectiveDate, createdAt
- **balanceSnapshots**: id, date (unique), balance, createdAt
- **inviteCodes**: id, code (unique), email, usedBy, createdBy, usedAt, createdAt, expiresAt

### Auth Tables (lib/db/schema/auth.ts)
- **user**: id, name, email, emailVerified, image, createdAt, updatedAt
- **session**: id, expiresAt, token, userId, ipAddress, userAgent, createdAt, updatedAt
- **account**: id, accountId, providerId, userId, password, accessToken, refreshToken, createdAt, updatedAt
- **verification**: id, identifier, value, expiresAt, createdAt, updatedAt

## Key Features & Logic

### Interest Calculation
- **Formula**: Daily compound interest
- **Calculation**: `dailyRate = (annualRate / 100) / 365; interest = balance * dailyRate`
- **Accrual**: Interest calculated daily, **added to account on 1st of each month**
- **Manual Trigger**: 
  - Script: `npm run add-accrued-interest` (CLI)
  - API: `POST /api/accrue-interest` (Web UI button)
- **Transaction**: Accrued interest creates a new "interest" type transaction
- **Location**: 
  - Script: `scripts/add-accrued-interest.ts`
  - API: `app/api/accrue-interest/route.ts`
- **UI**: Button in main app to trigger interest accrual and update display

### CSV Export
- Shows ALL days from initial deposit to current date
- Columns: Date, Transaction, Interest Accrued, Running Balance
- Includes daily interest even on days without transactions

### Authentication Flow
1. First user signs up → automatically admin
2. Admin creates invite codes → shares URLs
3. Friends click invite link → verify code → signup
4. Invite marked as used (one-time only)
5. Admins: first user OR emails in `ADMIN_EMAILS` env var

### Invite System
- 32-character random codes
- Optional email-locking
- Default expiry: 7 days
- One-time use only
- Admin-only creation

## Environment Variables

### Local (.env.local)
```bash
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token
BETTER_AUTH_SECRET=random-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAILS=admin@example.com
```

### Production (Fly.io)
```bash
fly secrets set \
  TURSO_DATABASE_URL="libsql://prod-db.turso.io" \
  TURSO_AUTH_TOKEN="prod-token" \
  BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  NEXT_PUBLIC_APP_URL="https://loan-tracker.fly.dev" \
  ADMIN_EMAILS="admin@example.com"
```

## Common Commands

### Development
```bash
npm run dev              # Start dev server
npm test                # Run tests
npm run test:watch      # Watch mode
```

### Database
```bash
# Run consolidated migration (for new databases)
cat drizzle/0000_consolidated_all_tables.sql | turso db shell <db-name>

# Generate new migration after schema changes
npm run db:generate

# Or manually
npx drizzle-kit generate --dialect=sqlite --schema=./lib/db/schema/index.ts

# Add monthly interest (CLI)
npm run add-accrued-interest

# Or use the API endpoint (Web UI)
curl -X POST http://localhost:3000/api/accrue-interest
```

### Deployment
```bash
fly deploy                    # Deploy
fly logs                      # View logs
fly ssh console              # SSH into container
fly secrets list             # List secrets
```

### Testing Auth
```bash
# Signup
curl -X POST http://localhost:3000/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123","name":"Test"}'

# Sign in
curl -X POST http://localhost:3000/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123"}'

# Get session
curl http://localhost:3000/api/auth/get-session
```

## Coding Standards

### API Routes
- Always handle errors with try/catch
- Return proper HTTP status codes (200, 201, 400, 401, 500)
- Convert BigInt to Number before JSON.stringify
- Use NextResponse.json() for responses
- **Use Drizzle ORM for all database operations** (not raw SQL)

### Client Components
- Mark with `'use client'` when using hooks
- Wrap useSearchParams() in Suspense
- Use Better Auth hooks from `lib/auth/client.ts`
- Handle loading and error states

### Database Operations with Drizzle
```typescript
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema/app';
import { eq, desc, asc, count } from 'drizzle-orm';

// Select all
const all = await db.select().from(transactions);

// Select with where
const one = await db.select().from(transactions).where(eq(transactions.id, 1));

// Insert
const result = await db.insert(transactions).values({ 
  type: 'deposit', 
  amount: 100, 
  date: '2025-01-01' 
});
const insertedId = Number(result.lastInsertRowid);

// Update
await db.update(transactions)
  .set({ amount: 200 })
  .where(eq(transactions.id, 1));

// Delete
await db.delete(transactions).where(eq(transactions.id, 1));

// Order by
await db.select().from(transactions).orderBy(desc(transactions.date));

// Count
await db.select({ count: count() }).from(transactions);
```

### TypeScript
- Enable strict mode
- Define types for API responses
- Use proper types for database queries
- Avoid `any` type

## Common Issues & Solutions

### Build Errors

**Error**: `Cannot find module '@tailwindcss/postcss'`
- **Root Cause**: Next.js 16 caches module resolution
- **Fix**: 
  1. Delete `.next` folder: `rm -rf .next`
  2. Verify `postcss.config.mjs` uses `tailwindcss` (not `@tailwindcss/postcss`)
  3. Restart dev server
- **Why it happens**: Intermittent issue with Turbopack hot reloading

**Error**: `useSearchParams() should be wrapped in a suspense boundary`
- Fix: Wrap component in `<Suspense>`

**Error**: `Do not know how to serialize a BigInt`
- Fix: Convert to Number: `Number(result.lastInsertRowid)`

**Error**: `Cannot read properties of undefined (reading 'split')` in parseDate
- **Root Cause**: API receiving undefined/null date parameter
- **Fix**: Add validation before calling functions that expect dates:
```typescript
if (!dateStr) {
  throw new Error('Date string is required');
}
```
- **Applies to**: All date parsing in `lib/interest.ts`

### Runtime Errors

**Error**: CORS policy error in production
- Fix: Set `NEXT_PUBLIC_APP_URL` build arg in Dockerfile and fly.toml

**Error**: `no such table: user`
- Fix: Run migration: `cat drizzle/0000_gorgeous_ikaris.sql | turso db shell <db-name>`

**Error**: Database connection fails
- Fix: Verify TURSO_DATABASE_URL and TURSO_AUTH_TOKEN

### Authentication Issues

**Problem**: Can't sign up
- Solution: First user doesn't need invite. Subsequent users need valid invite code.

**Problem**: Session not persisting
- Solution: Check BETTER_AUTH_SECRET is set. Clear browser cookies.

**Problem**: "Unauthorized" creating invites
- Solution: User must be signed in AND (first user OR in ADMIN_EMAILS)

## Deployment Checklist

### First Time
1. Create Turso database
2. Set all Fly.io secrets
3. Update fly.toml build args
4. Update Dockerfile with NEXT_PUBLIC_APP_URL
5. Deploy: `fly deploy`
6. Run consolidated migration on Turso:
   ```bash
   cat drizzle/0000_consolidated_all_tables.sql | turso db shell <db-name>
   ```
7. Create first admin user (signup directly)
8. Create invites for friends

### Subsequent Deploys
1. Test locally: `npm run dev`
2. Run tests: `npm test`
3. Build locally: `npm run build` (verify no errors)
4. Deploy: `fly deploy`
5. Verify deployment: Check homepage loads
6. Check logs if issues: `fly logs`

## File Conventions

### Naming
- API routes: kebab-case folders
- Components: PascalCase files
- Utils/libs: camelCase files
- Types: PascalCase with .ts extension

### File Organization
- Keep API routes in `app/api/`
- Keep auth logic in `lib/auth/`
- Keep database schemas in `lib/db/schema/`
- Keep tests in `__tests__/`
- Keep scripts in `scripts/`

## Testing Requirements

### Unit Tests
- Test interest calculation logic
- Test utility functions
- Location: `__tests__/`
- Run: `npm test`

### Manual Testing
- Signup/login flow
- Transaction CRUD
- Interest rate changes
- CSV export
- Invite creation and use
- Monthly interest accrual (both CLI and API)
- Accrue interest button in UI
- Balance display shows correct accrued interest
- Transaction history includes interest transactions

## Security Best Practices

- Passwords hashed by Better Auth (bcrypt)
- Sessions stored in database (not localStorage)
- HTTPS enforced on Fly.io
- Database credentials in secrets
- Invite codes are 32-char random strings
- Email verification disabled (invite system provides verification)

## Package Versions (Critical!)

```json
{
  "next": "16.0.1",
  "react": "19.x",
  "better-auth": "1.3.34",
  "drizzle-orm": "latest",
  "@libsql/client": "0.15.15",
  "tailwindcss": "3.x"
}
```

## When Making Changes

### Adding Features
1. Update database schema if needed
2. Generate migration with drizzle-kit
3. Test migration locally
4. Update API routes
5. Update UI components
6. Add tests
7. Update documentation

### Modifying Auth
- Never change Better Auth adapter (stay with Drizzle)
- Test auth flow after changes
- Verify invite system still works
- Check session persistence

### Database Changes
1. Update schema file
2. Generate migration: `npx drizzle-kit generate`
3. Test locally
4. Apply to dev Turso DB
5. Test thoroughly
6. Apply to prod Turso DB
7. Document changes

## Important Don'ts

❌ Don't use Kysely with Better Auth
❌ Don't forget Suspense for useSearchParams()
❌ Don't serialize BigInt to JSON
❌ Don't use @tailwindcss/postcss (use tailwindcss v3)
❌ Don't forget NEXT_PUBLIC_* build args
❌ Don't commit .env.local
❌ Don't reuse invite codes
❌ Don't skip tests
❌ Don't deploy without testing locally
❌ Don't use `/api/init` endpoint (deprecated - use migrations)
❌ Don't pass undefined/null dates to parseDate function

## Important Do's

✅ Use Drizzle ORM for Better Auth
✅ Wrap useSearchParams() in Suspense
✅ Convert BigInt to Number
✅ Use standard Tailwind v3
✅ Set build args for NEXT_PUBLIC_*
✅ Run tests before deploying
✅ Generate new invite codes
✅ Document changes
✅ Follow TypeScript strict mode
✅ Use consolidated migrations for database setup
✅ Validate date parameters before parsing
✅ Delete `.next` folder if TailwindCSS errors appear

## References

- Next.js 16: https://nextjs.org/docs
- Better Auth: https://www.better-auth.com/docs
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- Turso: https://docs.turso.tech/
- Fly.io: https://fly.io/docs/
- Safe-fin (reference): https://github.com/anmol-fzr/safe-fin

## Recent Changes (November 2025)

### Interest Accrual Improvements
- ✅ Added `POST /api/accrue-interest` endpoint for manual triggering
- ✅ UI button in main app to accrue interest on-demand
- ✅ Interest transactions now properly added to transaction history
- ✅ Fixed interest type from "deposit" to "interest" for clarity
- ✅ Both CLI script and API endpoint available

### Bug Fixes
- ✅ Fixed parseDate() null/undefined handling
- ✅ Fixed TailwindCSS intermittent module errors (delete `.next` folder)
- ✅ Fixed balance calculation to include all transaction types
- ✅ Fixed accrued interest display showing $0 incorrectly

### Database Migration
- ✅ Consolidated all tables into single migration file
- ✅ Deprecated `/api/init` endpoint (use migrations instead)
- ✅ All database setup now via Drizzle migrations

### Testing
- ✅ Added comprehensive tests for interest calculation
- ✅ Tests verify daily interest accrual logic
- ✅ Tests verify monthly compounding on 1st of month
- ✅ Tests verify transaction history includes interest

## API Endpoints Reference

### Authentication
- `POST /api/auth/sign-up/email` - Create account
- `POST /api/auth/sign-in/email` - Sign in
- `GET /api/auth/get-session` - Get current session

### Transactions
- `GET /api/transactions` - List all transactions
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Interest Rates
- `GET /api/interest-rates` - List all rates
- `POST /api/interest-rates` - Create rate
- `PUT /api/interest-rates/:id` - Update rate
- `DELETE /api/interest-rates/:id` - Delete rate

### Balance & Interest
- `GET /api/balance?date=YYYY-MM-DD` - Get balance at specific date
- `POST /api/accrue-interest` - Manually trigger interest accrual

### Invites (Admin Only)
- `GET /api/invites` - List all invites
- `POST /api/invites` - Create invite code
- `GET /api/invites/verify?code=XXX` - Verify invite code

### Export
- `GET /api/export` - Download CSV with daily interest breakdown

### Deprecated
- `POST /api/init` - Database initialization (use migrations instead)

---

**Last Updated**: November 3, 2025
**Version**: 1.1.0
**Status**: Production Ready ✅
