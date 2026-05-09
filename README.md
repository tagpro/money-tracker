# Loan Tracker

A Next.js application to track loans with daily interest calculations, compounded monthly. This app allows you to manage transactions, set interest rates, and view balance history.

## Features

- ✅ Add/remove money from the balance at any date
- ✅ Calculate interest accrued on the balance to date
- ✅ **Idempotent Monthly Compounding**: Accrue interest safely without duplicates.
- ✅ **Automated Accrual**: Daily GitHub Actions ensure interest is compounded on the 1st of every month.
- ✅ **Secure Authentication**: Invite-only system powered by Better Auth.
- ✅ **API Key Support**: Generate keys for automated scripts or external integrations.
- ✅ View balance at any given date, including accrued interest.
- ✅ View complete transaction history.
- ✅ Export data to CSV for record-keeping.
- ✅ SQLite database hosted on Turso or local file.

## Prerequisites

- [Bun](https://bun.sh) installed (recommended)
- A Turso account (optional - can use local SQLite)

## Setup Instructions

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Database

#### Option A: Use Turso (Recommended for production)

1. Sign up for a free account at [turso.tech](https://turso.tech)
2. Create a new database: `turso db create loan-tracker`
3. Apply migrations: `cat drizzle/0000_consolidated_all_tables.sql | turso db shell loan-tracker`
4. Set `.env.local`:
   ```env
   TURSO_DATABASE_URL=libsql://your-database.turso.io
   TURSO_AUTH_TOKEN=your-token
   ```

#### Option B: Use Local SQLite

```bash
cat drizzle/0000_consolidated_all_tables.sql | sqlite3 local.db
```

### 3. Run the Development Server

```bash
bun dev
```

### 4. Create Your First Account

The first user to sign up becomes the admin. Open [http://localhost:3000/signup](http://localhost:3000/signup) to create your account. Subsequent users will require an invite code.

## Automation & API Keys

This project uses a GitHub Action to automate interest accrual on the 1st of every month.

1. Generate an **API Key** in the User Settings.
2. Add the key to your GitHub Secrets as `CRON_API_KEY`.
3. The workflow in `.github/workflows/auto-accrue.yml` handles the daily check.

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Runtime**: Bun
- **ORM**: Drizzle ORM
- **Auth**: Better Auth (with API Key plugin)
- **Database**: SQLite (via Turso or local file)
- **Deployment**: Fly.io

## Contributing

This is a personal project, but feel free to fork and modify for your own use.

## License

ISC
