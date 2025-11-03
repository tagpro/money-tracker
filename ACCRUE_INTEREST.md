# Accrue Interest Feature

## Overview

This feature allows you to manually add accrued interest to your transaction history, converting it from "accrued interest" to actual principal in your account.

## How It Works

### What Happens

1. Calculates daily interest from your first transaction to today
2. On the 1st of each month, compounds the previous month's accrued interest
3. Adds an "interest" transaction to your history for each month
4. Updates your principal balance accordingly

### Interest Calculation

- **Daily Interest** = (Balance × Annual Rate) / 365 / 100
- **Accrued Interest** = Sum of daily interest for the month
- **Compounding Date** = 1st day of each month

### Example

If you have:
- Balance: $10,000
- Interest Rate: 5% per year
- Daily Interest: ($10,000 × 5) / 365 / 100 = $1.37/day
- Monthly Accrued (30 days): $1.37 × 30 = $41.10

On the 1st of the next month:
- A transaction is added: "Interest compounded for [Month Year]"
- Amount: $41.10
- Type: interest
- Your principal increases by $41.10

## Using the Feature

### Via UI (Recommended)

1. Login to the app
2. Click the **"Accrue Interest"** button (blue button in the top right)
3. Confirm the action
4. Interest transactions will be added to your history
5. Transaction list will refresh automatically

### Via API

```bash
curl -X POST https://loan-tracker.fly.dev/api/accrue-interest \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "success": true,
  "interestTransactionsAdded": 3,
  "currentAccruedInterest": 41.10,
  "message": "Added 3 interest transaction(s) to history. Current month accrued interest: 41.10"
}
```

## Important Notes

### ⚠️ Idempotency

This API is **NOT idempotent**! Running it multiple times will:
- Add duplicate interest transactions
- Inflate your balance incorrectly

**Best Practice**: Run this once per month, on the 1st.

### When to Use

**Good Times:**
- ✅ At the start of a new month (to compound last month's interest)
- ✅ When you want to see historical interest as transactions
- ✅ Before exporting a report

**Bad Times:**
- ❌ Multiple times in the same month
- ❌ Mid-month (current month interest won't be added yet)
- ❌ Every day (will create duplicates)

### What Gets Added

Only **completed months** get interest transactions added.

**Example (today is Nov 15, 2025):**
- ✅ October 2025 interest → Added on Nov 1
- ✅ September 2025 interest → Added on Oct 1
- ❌ November 2025 interest → Not added yet (month not complete)

Current month's accrued interest is shown in the response but **not** added to transactions.

## Difference from Export CSV

### Export CSV
- Calculates interest daily for the entire history
- **Adds interest transactions to the database** on the 1st of each month
- Downloads a CSV file with all calculations
- Safe to run multiple times (adds new interest transactions each time)

### Accrue Interest
- Only adds interest transactions (no CSV)
- Faster than export
- Updates your transaction history
- Shows current month's accrued interest (not yet added)

## Checking Results

After running, check:

1. **Transaction History**: New "interest" transactions appear
   - Type: interest
   - Description: "Interest compounded for [Month Year]"
   - Date: 1st of the month

2. **Balance**: Principal increases by the interest amount

3. **Current Balance Card**: 
   - Total Balance includes compounded interest
   - Principal includes compounded interest
   - Accrued Interest shows current month only

## Automation (Future)

Currently manual. You could automate this with:

1. **Cron Job**:
   ```bash
   # Run on 1st of every month at 2am
   0 2 1 * * curl -X POST https://loan-tracker.fly.dev/api/accrue-interest
   ```

2. **GitHub Actions**:
   ```yaml
   name: Accrue Interest
   on:
     schedule:
       - cron: '0 2 1 * *'  # 1st of month at 2am
   
   jobs:
     accrue:
       runs-on: ubuntu-latest
       steps:
         - run: curl -X POST https://loan-tracker.fly.dev/api/accrue-interest
   ```

3. **Fly.io Cron** (if available in your plan)

## Troubleshooting

### "No transactions found"
- You need at least one deposit/withdrawal first
- Check `/api/transactions` to see if you have data

### Duplicate interest transactions
- You ran the API multiple times
- **Solution**: Delete duplicate transactions manually or reset database

### Interest amount seems wrong
- Check your interest rates (`/api/interest-rates`)
- Verify the effective dates are correct
- Interest compounds monthly, not daily

### No new transactions added
- All months already have interest compounded
- Current month isn't complete yet (will be added on 1st of next month)

## API Details

### Endpoint
```
POST /api/accrue-interest
```

### Authentication
Requires valid session (handled automatically in browser)

### Response
```typescript
{
  success: boolean;
  interestTransactionsAdded: number;
  currentAccruedInterest: number;
  message: string;
}
```

### Error Response
```typescript
{
  error: string;
}
```

### Status Codes
- `200` - Success
- `404` - No transactions found
- `500` - Server error

## Example Workflow

### Monthly Process (Recommended)

1. **1st of Month**: 
   - Click "Accrue Interest" button
   - Verify new transaction appears
   - Check principal increased correctly

2. **Throughout Month**:
   - Add deposits/withdrawals as normal
   - Watch "Accrued Interest" grow in the balance card

3. **End of Month**:
   - Export CSV for records (optional)
   - Verify accrued interest amount

4. **Next Month 1st**:
   - Repeat step 1

## Technical Details

The API:
1. Fetches all transactions (ordered by date)
2. Fetches all interest rates (ordered by effective date)
3. Iterates through each day from first transaction to today
4. Calculates daily interest based on current rate
5. On 1st of each month, adds accrued interest as a transaction
6. Returns count of transactions added

Code: `app/api/accrue-interest/route.ts`
