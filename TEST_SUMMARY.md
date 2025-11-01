# Interest Calculation Fix & Testing

## Issue Fixed

The accrued interest was showing $0.00 on the homepage because the calculation logic was compounding interest prematurely when the target date was reached, even if it was mid-month.

### Root Cause
In `lib/interest.ts`, line 66 had:
```typescript
if (nextDay.getMonth() !== currentDate.getMonth() || nextDay > endDate) {
```

This meant interest was being compounded both at month-end AND when reaching the target date, causing mid-month accrued interest to be reset to 0.

### Fix Applied
Changed to only compound at actual month boundaries:
```typescript
if (nextDay.getMonth() !== currentDate.getMonth()) {
```

Now accrued interest properly accumulates during the month and only compounds on the 1st of the next month.

## Test Coverage

Created comprehensive tests in `__tests__/interest.test.ts` and `test-interest.ts` covering:

1. **Mid-month accrued interest** - Verifies interest accrues without compounding
2. **Month-end compounding** - Verifies interest compounds correctly on the 1st
3. **Multiple months** - Verifies compounding over several months
4. **No interest rate** - Verifies $0 interest when no rate is set
5. **Daily calculations** - Verifies daily interest formula
6. **Withdrawals** - Verifies interest recalculates with balance changes  
7. **Rate changes** - Verifies different rates apply correctly
8. **Empty transactions** - Edge case handling
9. **Multiple deposits** - Interest on varying balances
10. **Interest transactions** - Previously compounded interest is included

## Expected Behavior

### Example: $10,000 deposit on Oct 1, 2024 at 12% annual rate

**Oct 15, 2024:**
- Principal: $10,000.00
- Accrued Interest: ~$49.32 (15 days × $3.29/day)
- Total Balance: $10,049.32

**Nov 1, 2024:**
- Principal: $10,101.92 (original + Oct interest compounded)
- Accrued Interest: ~$3.32 (1 day in Nov)
- Total Balance: $10,105.24

**Key Points:**
- Interest accrues daily at rate/365
- Compounds monthly on the 1st
- Accrued interest shows current month's uncompounded interest
- Principal includes all previously compounded interest

## Running Tests

### Manual Verification

1. Start dev server: `npm run dev`
2. Add an interest rate
3. Add a deposit transaction with a past date (e.g., Oct 1)
4. Check balance mid-month - accrued interest should be > $0
5. Check balance on 1st of next month - principal should increase

### Automated Tests (when Jest is properly installed)

```bash
npm test
```

## Files Modified

- `lib/interest.ts` - Fixed compounding logic
- `__tests__/interest.test.ts` - Comprehensive test suite
- `test-interest.ts` - Simple TypeScript test runner
- `jest.config.js` - Jest configuration
- `package.json` - Added test scripts

## Deployment

The fix has been deployed to https://loan-tracker.fly.dev/

You should now see proper accrued interest values on the homepage!
