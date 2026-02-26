import { calculateBalance, parseDate, formatDateLocal, toLocalMidnight } from '../lib/interest';
import { Transaction, InterestRate } from '../lib/types';

describe('Interest Calculation', () => {
  const mockRates: InterestRate[] = [
    {
      id: 1,
      rate: 5.0,
      effective_date: '2024-01-01',
      created_at: '2024-01-01T00:00:00.000Z',
    },
  ];

  describe('Date Utility Functions', () => {
    describe('parseDate', () => {
      it('should parse YYYY-MM-DD to local midnight', () => {
        const d = parseDate('2024-02-01');
        expect(d.getFullYear()).toBe(2024);
        expect(d.getMonth()).toBe(1); // 0-indexed
        expect(d.getDate()).toBe(1);
        expect(d.getHours()).toBe(0);
        expect(d.getMinutes()).toBe(0);
        expect(d.getSeconds()).toBe(0);
      });

      it('should throw for empty string', () => {
        expect(() => parseDate('')).toThrow('Date string is required');
      });
    });

    describe('formatDateLocal', () => {
      it('should format a Date as YYYY-MM-DD using local time', () => {
        const d = new Date(2024, 1, 1, 0, 0, 0, 0); // Feb 1 local
        expect(formatDateLocal(d)).toBe('2024-02-01');
      });

      it('should pad single-digit months and days', () => {
        const d = new Date(2024, 0, 5, 0, 0, 0, 0); // Jan 5
        expect(formatDateLocal(d)).toBe('2024-01-05');
      });

      it('should round-trip with parseDate', () => {
        expect(formatDateLocal(parseDate('2024-12-31'))).toBe('2024-12-31');
        expect(formatDateLocal(parseDate('2024-01-01'))).toBe('2024-01-01');
        expect(formatDateLocal(parseDate('2024-02-29'))).toBe('2024-02-29');
      });
    });

    describe('toLocalMidnight', () => {
      it('should strip time component to local midnight', () => {
        const d = new Date(2024, 1, 1, 15, 30, 45, 123);
        const midnight = toLocalMidnight(d);
        expect(midnight.getFullYear()).toBe(2024);
        expect(midnight.getMonth()).toBe(1);
        expect(midnight.getDate()).toBe(1);
        expect(midnight.getHours()).toBe(0);
        expect(midnight.getMinutes()).toBe(0);
        expect(midnight.getSeconds()).toBe(0);
        expect(midnight.getMilliseconds()).toBe(0);
      });

      it('should not shift dates when already at midnight', () => {
        const d = new Date(2024, 5, 15, 0, 0, 0, 0);
        const midnight = toLocalMidnight(d);
        expect(formatDateLocal(midnight)).toBe('2024-06-15');
      });
    });
  });

  describe('Basic Balance Calculations', () => {
    it('should return zero for empty transactions', () => {
      const result = calculateBalance([], mockRates, new Date('2024-01-15'));
      expect(result).toEqual({
        balance: 0,
        principal: 0,
        accruedInterest: 0,
      });
    });

    it('should calculate balance with single deposit on same day', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      const result = calculateBalance(transactions, mockRates, new Date('2024-01-01'));

      expect(result.balance).toBe(10000);
      expect(result.principal).toBe(10000);
      expect(result.accruedInterest).toBe(0);
    });
  });

  describe('Daily Interest Accrual', () => {
    it('should calculate daily interest correctly after 1 day', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      // Daily interest = 10000 * 5% / 365 = 1.3698...
      const result = calculateBalance(transactions, mockRates, new Date('2024-01-02'));

      expect(result.balance).toBeCloseTo(10001.37, 2);
      expect(result.principal).toBe(10000);
      expect(result.accruedInterest).toBeCloseTo(1.37, 2);
    });

    it('should accrue interest over 10 days', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      // 10 days of interest: 10000 * 5% / 365 * 10 = 13.70
      const result = calculateBalance(transactions, mockRates, new Date('2024-01-11'));

      expect(result.balance).toBeCloseTo(10013.70, 2);
      expect(result.principal).toBe(10000);
      expect(result.accruedInterest).toBeCloseTo(13.70, 2);
    });
  });

  describe('Monthly Compounding', () => {
    it('should compound interest at end of month', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      // Calculate to Feb 1 (should compound Jan's interest)
      // 31 days of interest: 10000 * 5% / 365 * 31 = 42.47
      const result = calculateBalance(transactions, mockRates, new Date('2024-02-01'));

      expect(result.principal).toBeCloseTo(10042.47, 2);
      expect(result.balance).toBeCloseTo(10042.47, 2);
      expect(result.accruedInterest).toBeCloseTo(0, 2);
    });

    it('should continue accruing after month-end compounding', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      // Feb 2: should have compounded Jan + 1 day of Feb interest
      const result = calculateBalance(transactions, mockRates, new Date('2024-02-02'));

      // Compounded principal: ~10042.47 (31 days in Jan)
      // Feb 1 interest: 10042.47 * 5% / 365 = 1.375
      expect(result.principal).toBeCloseTo(10042.47, 1);
      expect(result.accruedInterest).toBeCloseTo(1.38, 1);
      expect(result.balance).toBeCloseTo(10043.85, 1);
    });
  });

  describe('Interest Transactions', () => {
    it('should handle interest transaction and include in principal', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          type: 'interest',
          amount: 42.47,
          date: '2024-02-01',
          description: 'Interest compounded for January 2024',
          created_at: '2024-02-01T00:00:00.000Z',
        },
      ];

      const result = calculateBalance(transactions, mockRates, new Date('2024-02-01'));

      expect(result.balance).toBeCloseTo(10042.47, 1);
      expect(result.principal).toBeCloseTo(10042.47, 1);
      expect(result.accruedInterest).toBe(0);
    });

    it('should NOT double count interest if transaction already exists', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          type: 'interest',
          amount: 42.47,
          date: '2024-02-01',
          description: 'Interest compounded for January 2024',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      const result = calculateBalance(transactions, mockRates, new Date('2024-02-02'));

      expect(result.principal).toBeCloseTo(10042.47, 2);
      // Feb 1 interest: 10042.47 * 5% / 365 = 1.375
      expect(result.accruedInterest).toBeCloseTo(1.38, 2);
    });

    it('should handle multiple months of interest transactions without double-compounding', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          type: 'interest',
          amount: 42.47,
          date: '2024-02-01',
          description: 'Interest compounded for January 2024',
          created_at: '2024-02-01T00:00:00.000Z',
        },
        {
          id: 3,
          type: 'interest',
          amount: 39.91,
          date: '2024-03-01',
          description: 'Interest compounded for February 2024',
          created_at: '2024-03-01T00:00:00.000Z',
        },
      ];

      const result = calculateBalance(transactions, mockRates, new Date('2024-03-01'));

      // Total principal should include deposit + both interest amounts
      expect(result.principal).toBeCloseTo(10000 + 42.47 + 39.91, 1);
      expect(result.accruedInterest).toBe(0);
    });

    it('should produce same balance with or without interest transactions for completed months', () => {
      const baseTransactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      // Without interest transactions (virtual compounding)
      const resultWithout = calculateBalance(baseTransactions, mockRates, parseDate('2024-03-15'));

      // Calculate what interest would have been for Jan
      const janInterest = calculateBalance(baseTransactions, mockRates, parseDate('2024-02-01'));

      const transactionsWithInterest: Transaction[] = [
        ...baseTransactions,
        {
          id: 2,
          type: 'interest',
          amount: Math.round((janInterest.principal - 10000) * 100) / 100,
          date: '2024-02-01',
          description: 'Interest compounded for January 2024',
          created_at: '2024-02-01T00:00:00.000Z',
        },
      ];

      // With interest transaction for Jan (should give same result)
      const resultWith = calculateBalance(transactionsWithInterest, mockRates, parseDate('2024-03-15'));

      expect(resultWith.balance).toBeCloseTo(resultWithout.balance, 1);
    });
  });

  describe('Withdrawals', () => {
    it('should handle withdrawal correctly', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          type: 'withdrawal',
          amount: 2000,
          date: '2024-01-15',
          description: 'Withdrawal',
          created_at: '2024-01-15T00:00:00.000Z',
        },
      ];

      const result = calculateBalance(transactions, mockRates, new Date('2024-01-15'));

      // Should have 14 days of interest (Jan 1-14) before withdrawal
      // 14 * 10000 * 5% / 365 = 19.18
      // Balance = 10000 + 19.18 - 2000 = 8019.18
      expect(result.balance).toBeCloseTo(8019.18, 2);
      expect(result.principal).toBe(8000);
    });

    it('should accrue interest on reduced balance after withdrawal', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          type: 'withdrawal',
          amount: 2000,
          date: '2024-01-15',
          description: 'Withdrawal',
          created_at: '2024-01-15T00:00:00.000Z',
        },
      ];

      // Calculate to end of month
      const result = calculateBalance(transactions, mockRates, new Date('2024-02-01'));

      // Interest for Jan 1-14 on 10000 + Jan 15-31 on 8000
      // = (14 * 10000 * 5% / 365) + (17 * 8000 * 5% / 365)
      // = 19.18 + 18.63 = 37.81
      expect(result.principal).toBeCloseTo(8037.81, 2);
      expect(result.accruedInterest).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle no interest rates', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      const result = calculateBalance(transactions, [], new Date('2024-02-01'));

      expect(result.balance).toBe(10000);
      expect(result.principal).toBe(10000);
      expect(result.accruedInterest).toBe(0);
    });

    it('should handle leap year (29 days in February)', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-02-01',
          description: 'Leap year test',
          created_at: '2024-02-01T00:00:00.000Z',
        },
      ];

      // Feb 2024 has 29 days
      const result = calculateBalance(transactions, mockRates, new Date('2024-03-01'));

      // 29 days of interest: 10000 * 5% / 365 * 29 = 39.73
      expect(result.principal).toBeCloseTo(10039.73, 2);
    });

    it('should handle targetDate parsed via parseDate for consistent local-time behavior', () => {
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ];

      // Using parseDate (local) vs new Date() constructor — should give same result
      const resultLocal = calculateBalance(transactions, mockRates, parseDate('2024-02-01'));
      const resultConstructor = calculateBalance(transactions, mockRates, new Date(2024, 1, 1));

      expect(resultLocal.balance).toBeCloseTo(resultConstructor.balance, 2);
      expect(resultLocal.principal).toBeCloseTo(resultConstructor.principal, 2);
      expect(resultLocal.accruedInterest).toBeCloseTo(resultConstructor.accruedInterest, 2);
    });
  });

  describe('Interest Rate Changes', () => {
    it('should apply new rate from its effective date (mid-month change)', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      // 5% for first 14 days, then 8% for remaining 17 days of Jan
      const rates: InterestRate[] = [
        { id: 1, rate: 5.0, effective_date: '2024-01-01' },
        { id: 2, rate: 8.0, effective_date: '2024-01-15' },
      ];

      const result = calculateBalance(transactions, rates, parseDate('2024-02-01'));

      // Jan 1-14 (14 days at 5%): 10000 * 5 / 365 / 100 * 14 = 19.18
      // Jan 15-31 (17 days at 8%): 10000 * 8 / 365 / 100 * 17 = 37.26
      // Total: 56.44
      const expected = 14 * (10000 * 5 / 365 / 100) + 17 * (10000 * 8 / 365 / 100);
      expect(result.principal).toBeCloseTo(10000 + expected, 1);
      expect(result.accruedInterest).toBe(0); // compounded at month end
    });

    it('should use the earlier rate before the new rate takes effect', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      // Rate changes on Feb 1, so all of Jan should use 5%
      const rates: InterestRate[] = [
        { id: 1, rate: 5.0, effective_date: '2024-01-01' },
        { id: 2, rate: 10.0, effective_date: '2024-02-01' },
      ];

      // Check mid-Jan — only 5% should apply, 10% hasn't kicked in
      const result = calculateBalance(transactions, rates, parseDate('2024-01-21'));

      // 20 days at 5% (Jan 1-20)
      const expected = 20 * (10000 * 5 / 365 / 100);
      expect(result.accruedInterest).toBeCloseTo(expected, 2);
    });

    it('should apply new rate exactly on its effective date', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      const rates: InterestRate[] = [
        { id: 1, rate: 5.0, effective_date: '2024-01-01' },
        { id: 2, rate: 10.0, effective_date: '2024-01-11' },
      ];

      // Check balance on Jan 12 — should have 10 days at 5% + 1 day at 10%
      const result = calculateBalance(transactions, rates, parseDate('2024-01-12'));

      const expected = 10 * (10000 * 5 / 365 / 100) + 1 * (10000 * 10 / 365 / 100);
      expect(result.accruedInterest).toBeCloseTo(expected, 2);
    });

    it('should handle rate decrease', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      const rates: InterestRate[] = [
        { id: 1, rate: 10.0, effective_date: '2024-01-01' },
        { id: 2, rate: 3.0, effective_date: '2024-01-16' },
      ];

      const result = calculateBalance(transactions, rates, parseDate('2024-02-01'));

      // Jan 1-15 (15 days at 10%): 10000 * 10 / 365 / 100 * 15 = 41.10
      // Jan 16-31 (16 days at 3%): 10000 * 3 / 365 / 100 * 16 = 13.15
      // Total: 54.25
      const expected = 15 * (10000 * 10 / 365 / 100) + 16 * (10000 * 3 / 365 / 100);
      expect(result.principal).toBeCloseTo(10000 + expected, 1);
    });

    it('should handle rate change to 0%', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      const rates: InterestRate[] = [
        { id: 1, rate: 5.0, effective_date: '2024-01-01' },
        { id: 2, rate: 0, effective_date: '2024-01-16' },
      ];

      const result = calculateBalance(transactions, rates, parseDate('2024-02-01'));

      // Only 15 days of interest at 5%, then 0 for the rest
      const expected = 15 * (10000 * 5 / 365 / 100);
      expect(result.principal).toBeCloseTo(10000 + expected, 2);
    });

    it('should handle multiple rate changes across months', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      const rates: InterestRate[] = [
        { id: 1, rate: 5.0, effective_date: '2024-01-01' },
        { id: 2, rate: 7.0, effective_date: '2024-02-01' },
        { id: 3, rate: 3.0, effective_date: '2024-03-01' },
      ];

      // Jan: 31 days at 5%
      const janInterest = 31 * (10000 * 5 / 365 / 100);
      const balanceAfterJan = 10000 + janInterest;

      // Feb: 29 days at 7% (2024 is leap year) on compounded balance
      const febInterest = 29 * (balanceAfterJan * 7 / 365 / 100);
      const balanceAfterFeb = balanceAfterJan + febInterest;

      // Mar 1: both months compounded, no accrued for current month yet
      const result = calculateBalance(transactions, rates, parseDate('2024-03-01'));
      expect(result.principal).toBeCloseTo(balanceAfterFeb, 0);
      expect(result.accruedInterest).toBe(0);
    });

    it('should handle rates provided in unsorted order', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      // Rates intentionally out of order
      const rates: InterestRate[] = [
        { id: 2, rate: 8.0, effective_date: '2024-01-16' },
        { id: 1, rate: 5.0, effective_date: '2024-01-01' },
      ];

      const result = calculateBalance(transactions, rates, parseDate('2024-02-01'));

      const expected = 15 * (10000 * 5 / 365 / 100) + 16 * (10000 * 8 / 365 / 100);
      expect(result.principal).toBeCloseTo(10000 + expected, 1);
    });

    it('should not apply a future rate to current calculations', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      // Rate starts in Feb but we're only looking at Jan
      const rates: InterestRate[] = [
        { id: 1, rate: 5.0, effective_date: '2024-01-01' },
        { id: 2, rate: 99.0, effective_date: '2024-06-01' },
      ];

      const result = calculateBalance(transactions, rates, parseDate('2024-01-11'));

      // Only 5% should apply (10 days)
      const expected = 10 * (10000 * 5 / 365 / 100);
      expect(result.accruedInterest).toBeCloseTo(expected, 2);
    });

    it('should use 4.5% for Dec 2025 and 5% for Jan 2026 when rate changes at year boundary', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2025-12-01' },
      ];

      const rates: InterestRate[] = [
        { id: 1, rate: 4.5, effective_date: '2025-12-01' },
        { id: 2, rate: 5.0, effective_date: '2026-01-01' },
      ];

      // Dec: 31 days at 4.5%
      const decInterest = 31 * (10000 * 4.5 / 365 / 100);
      const balanceAfterDec = 10000 + decInterest;

      // Jan 1-15: 15 days at 5% on compounded balance
      const janInterest = 15 * (balanceAfterDec * 5 / 365 / 100);

      const result = calculateBalance(transactions, rates, parseDate('2026-01-16'));

      expect(result.principal).toBeCloseTo(balanceAfterDec, 1);
      expect(result.accruedInterest).toBeCloseTo(janInterest, 1);
    });

    it('should use rate from before first transaction if rate predates it', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-03-01' },
      ];

      // Rate set way before first transaction
      const rates: InterestRate[] = [
        { id: 1, rate: 6.0, effective_date: '2023-01-01' },
      ];

      const result = calculateBalance(transactions, rates, parseDate('2024-03-02'));

      const expected = 1 * (10000 * 6 / 365 / 100);
      expect(result.accruedInterest).toBeCloseTo(expected, 2);
    });
  });

  describe('Duplicate Interest Prevention', () => {
    it('should not double-compound when interest transaction exists on the same day as auto-compound', () => {
      // This simulates what happens when accrue-interest has already inserted an interest
      // transaction for Feb 1, and calculateBalance also tries to auto-compound at month boundary
      const transactions: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
          description: 'Initial deposit',
          created_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 2,
          type: 'interest',
          amount: 42.47,
          date: '2024-02-01',
          description: 'Interest compounded for January 2024',
          created_at: '2024-02-01T00:00:00.000Z',
        },
      ];

      // On Feb 15, principal should be exactly deposit + interest tx, no extra compounding
      const result = calculateBalance(transactions, mockRates, parseDate('2024-02-15'));

      expect(result.principal).toBeCloseTo(10042.47, 2);
      // 14 days of interest on 10042.47 (Feb 1-14)
      const expectedAccrued = 14 * (10042.47 * 5 / 365 / 100);
      expect(result.accruedInterest).toBeCloseTo(expectedAccrued, 2);
    });

    it('should produce consistent results whether interest is recorded or auto-compounded', () => {
      // Case A: no interest transactions, pure auto-compounding
      const txNoInterest: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
        },
      ];

      const resultAuto = calculateBalance(txNoInterest, mockRates, parseDate('2024-02-15'));

      // Case B: with recorded interest transaction matching the auto-compound amount
      const janResult = calculateBalance(txNoInterest, mockRates, parseDate('2024-02-01'));
      const janInterest = janResult.principal - 10000;

      const txWithInterest: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
        },
        {
          id: 2,
          type: 'interest',
          amount: Math.round(janInterest * 100) / 100,
          date: '2024-02-01',
        },
      ];

      const resultRecorded = calculateBalance(txWithInterest, mockRates, parseDate('2024-02-15'));

      // Both approaches should yield the same balance
      expect(resultRecorded.balance).toBeCloseTo(resultAuto.balance, 1);
    });
  });
});
