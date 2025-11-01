# Loan Tracker

A Next.js application to track loans with daily interest calculations, compounded monthly. This app allows you to manage transactions, set interest rates, and view balance history.

## Features

- ✅ Add/remove money from the balance at any date
- ✅ Calculate interest accrued on the balance to date
- ✅ Monthly compounding with daily interest rate calculation
- ✅ Change interest rate at any date
- ✅ View balance at any given date, including accrued interest
- ✅ View complete transaction history
- ✅ Export data to CSV for record-keeping
- ✅ SQLite database hosted on Turso

## Prerequisites

- Node.js 18+ installed
- A Turso account (optional - can use local SQLite)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Database

#### Option A: Use Turso (Recommended for production)

1. Sign up for a free account at [turso.tech](https://turso.tech)
2. Create a new database using the Turso CLI:

```bash
turso db create loan-tracker
```

3. Get your database URL and auth token:

```bash
turso db show loan-tracker
turso db tokens create loan-tracker
```

4. Create a `.env.local` file in the root directory:

```env
TURSO_DATABASE_URL=libsql://your-database-url.turso.io
TURSO_AUTH_TOKEN=your-auth-token
```

#### Option B: Use Local SQLite

If you don't set the environment variables, the app will automatically create a local `local.db` file in the project root.

### 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Guide

### Adding Transactions

1. Select transaction type (Deposit or Withdrawal)
2. Enter the amount
3. Select the date
4. Add an optional description
5. Click "Add Transaction"

### Setting Interest Rates

1. Enter the annual interest rate as a percentage (e.g., 5.5 for 5.5%)
2. Select the effective date from which this rate applies
3. Click "Set Interest Rate"

**Note:** Interest is calculated daily based on the annual rate (rate/365) and compounded monthly. At the end of each month, accrued interest is added to the principal.

### Viewing Balance

- The current balance is displayed at the top of the page
- You can select any date to see the balance as of that date
- The display shows:
  - **Total Balance**: Principal + Accrued Interest
  - **Principal**: The base amount (deposits - withdrawals + previous compounded interest)
  - **Accrued Interest**: Interest earned in the current month (not yet compounded)

### Exporting Data

Click the "Export CSV" button to download a CSV file containing all transactions and interest rate history.

## Database Schema

### Transactions Table
- `id`: Auto-increment primary key
- `type`: 'deposit', 'withdrawal', or 'interest'
- `amount`: Transaction amount
- `date`: Transaction date
- `description`: Optional description
- `created_at`: Timestamp of record creation

### Interest Rates Table
- `id`: Auto-increment primary key
- `rate`: Annual interest rate (percentage)
- `effective_date`: Date from which the rate is effective
- `created_at`: Timestamp of record creation

### Balance Snapshots Table
- `id`: Auto-increment primary key
- `date`: Date of snapshot
- `balance`: Balance amount
- `created_at`: Timestamp of record creation

## Interest Calculation Logic

The interest calculation follows these rules:

1. **Daily Calculation**: Interest is calculated daily using the formula:
   ```
   Daily Interest = (Current Balance × Annual Rate / 100) / 365
   ```

2. **Monthly Compounding**: At the end of each month, all accrued interest is added to the principal:
   ```
   New Principal = Previous Principal + Accrued Interest
   ```

3. **Rate Changes**: When the interest rate changes, the new rate applies from the effective date forward. Previous calculations remain unchanged.

## Deployment

### Build for Production

```bash
npm run build
npm start
```

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project to Vercel
3. Add your environment variables (TURSO_DATABASE_URL and TURSO_AUTH_TOKEN)
4. Deploy

## Technology Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite via Turso (@libsql/client)
- **Export**: CSV generation

## Security Notes

- This is designed for personal use without authentication
- If deploying publicly, consider adding authentication (e.g., NextAuth.js)
- Keep your Turso auth token secure and never commit it to version control
- The `.env.local` file is gitignored by default

## Contributing

This is a personal project, but feel free to fork and modify for your own use.

## License

ISC
