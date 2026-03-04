import { calculateBalance, parseDate, formatDateLocal, toLocalMidnight } from '../lib/interest';
import { Transaction, InterestRate } from '../lib/types';

// Helper: same rounding as the production code
const r = (x: number) => Math.round(x * 100) / 100;

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
        expect(d.getMonth()).toBe(1);
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
        const d = new Date(2024, 1, 1, 0, 0, 0, 0);
        expect(formatDateLocal(d)).toBe('2024-02-01');
      });

      it('should pad single-digit months and days', () => {
        const d = new Date(2024, 0, 5, 0, 0, 0, 0);
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

      // Same day = 0 completed days, no interest
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

      // 1 completed day (Jan 1)
      const rawAccrued = 1 * 10000 * 5 / 365 / 100;
      const result = calculateBalance(transactions, mockRates, new Date('2024-01-02'));

      expect(result.balance).toBe(r(10000 + rawAccrued));
      expect(result.principal).toBe(10000);
      expect(result.accruedInterest).toBe(r(rawAccrued));
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

      // 10 completed days (Jan 1-10)
      const rawAccrued = 10 * 10000 * 5 / 365 / 100;
      const result = calculateBalance(transactions, mockRates, new Date('2024-01-11'));

      expect(result.balance).toBe(r(10000 + rawAccrued));
      expect(result.principal).toBe(10000);
      expect(result.accruedInterest).toBe(r(rawAccrued));
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

      // 31 completed days (Jan 1-31), compound on Feb 1, Feb 1 = endDate so no Feb accrual
      const janCompound = r(31 * 10000 * 5 / 365 / 100);
      const result = calculateBalance(transactions, mockRates, new Date('2024-02-01'));

      expect(result.principal).toBe(10000 + janCompound);
      expect(result.balance).toBe(10000 + janCompound);
      expect(result.accruedInterest).toBe(0);
    });

    it('should earn interest on prior interest (compound interest)', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      // Jan: 31 days → compound (rounded)
      const janCompound = r(31 * (10000 * 5 / 365 / 100));
      const balanceAfterJan = 10000 + janCompound;

      // Feb: 29 days at 5% on compounded balance (2024 is leap year), compound on Mar 1
      const febCompound = r(29 * (balanceAfterJan * 5 / 365 / 100));

      // Simple interest for comparison
      const febSimple = r(29 * (10000 * 5 / 365 / 100));

      const result = calculateBalance(transactions, mockRates, parseDate('2024-03-01'));

      // Mar 1 = endDate, no accrual
      expect(result.principal).toBe(r(balanceAfterJan + febCompound));
      expect(result.accruedInterest).toBe(0);
      // Verify compound > simple
      expect(result.principal).toBeGreaterThan(10000 + janCompound + febSimple);
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

      // Jan compound, then 1 completed day in Feb (Feb 1)
      const janCompound = r(31 * 10000 * 5 / 365 / 100);
      const balanceAfterJan = 10000 + janCompound;
      const febRaw = 1 * balanceAfterJan * 5 / 365 / 100;
      const result = calculateBalance(transactions, mockRates, new Date('2024-02-02'));

      expect(result.principal).toBe(balanceAfterJan);
      expect(result.accruedInterest).toBe(r(febRaw));
      expect(result.balance).toBe(r(balanceAfterJan + febRaw));
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

      // Feb 1 = endDate, no Feb accrual
      const result = calculateBalance(transactions, mockRates, new Date('2024-02-01'));

      expect(result.balance).toBe(10042.47);
      expect(result.principal).toBe(10042.47);
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

      // 1 completed day (Feb 1) on 10042.47
      const febDaily = 1 * 10042.47 * 5 / 365 / 100;
      const result = calculateBalance(transactions, mockRates, new Date('2024-02-02'));

      expect(result.principal).toBe(10042.47);
      expect(result.accruedInterest).toBe(r(febDaily));
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

      // Mar 1 = endDate, no accrual
      const result = calculateBalance(transactions, mockRates, new Date('2024-03-01'));

      expect(result.principal).toBe(10000 + 42.47 + 39.91);
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

      const resultWithout = calculateBalance(baseTransactions, mockRates, parseDate('2024-03-15'));

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

      const resultWith = calculateBalance(transactionsWithInterest, mockRates, parseDate('2024-03-15'));

      expect(resultWith.balance).toBe(resultWithout.balance);
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

      // 14 completed days (Jan 1-14) on 10000, Jan 15 = endDate
      const rawAccrued = 14 * 10000 * 5 / 365 / 100;
      const result = calculateBalance(transactions, mockRates, new Date('2024-01-15'));

      expect(result.balance).toBe(r(8000 + rawAccrued));
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

      // Jan 1-14 (14 days on 10000) + Jan 15-31 (17 days on 8000), compound on Feb 1
      const janRaw = 14 * (10000 * 5 / 365 / 100) + 17 * (8000 * 5 / 365 / 100);
      const janCompound = r(janRaw);
      const result = calculateBalance(transactions, mockRates, new Date('2024-02-01'));

      // Feb 1 = endDate, no accrual
      expect(result.principal).toBe(8000 + janCompound);
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

      // 29 days (Feb 1-29), compound on Mar 1
      const febCompound = r(29 * 10000 * 5 / 365 / 100);
      const result = calculateBalance(transactions, mockRates, new Date('2024-03-01'));

      expect(result.principal).toBe(10000 + febCompound);
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

      const resultLocal = calculateBalance(transactions, mockRates, parseDate('2024-02-01'));
      const resultConstructor = calculateBalance(transactions, mockRates, new Date(2024, 1, 1));

      expect(resultLocal.balance).toBe(resultConstructor.balance);
      expect(resultLocal.principal).toBe(resultConstructor.principal);
      expect(resultLocal.accruedInterest).toBe(resultConstructor.accruedInterest);
    });
  });

  describe('Interest Rate Changes', () => {
    it('should apply new rate from its effective date (mid-month change)', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      const rates: InterestRate[] = [
        { id: 1, rate: 5.0, effective_date: '2024-01-01' },
        { id: 2, rate: 8.0, effective_date: '2024-01-15' },
      ];

      // Jan 1-14 (14 days at 5%) + Jan 15-31 (17 days at 8%), compound on Feb 1
      const janRaw = 14 * (10000 * 5 / 365 / 100) + 17 * (10000 * 8 / 365 / 100);
      const janCompound = r(janRaw);
      const result = calculateBalance(transactions, rates, parseDate('2024-02-01'));

      expect(result.principal).toBe(10000 + janCompound);
      expect(result.accruedInterest).toBe(0);
    });

    it('should use the earlier rate before the new rate takes effect', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      const rates: InterestRate[] = [
        { id: 1, rate: 5.0, effective_date: '2024-01-01' },
        { id: 2, rate: 10.0, effective_date: '2024-02-01' },
      ];

      // 20 completed days at 5% (Jan 1-20), Jan 21 = endDate
      const rawAccrued = 20 * (10000 * 5 / 365 / 100);
      const result = calculateBalance(transactions, rates, parseDate('2024-01-21'));

      expect(result.accruedInterest).toBe(r(rawAccrued));
    });

    it('should apply new rate exactly on its effective date', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      const rates: InterestRate[] = [
        { id: 1, rate: 5.0, effective_date: '2024-01-01' },
        { id: 2, rate: 10.0, effective_date: '2024-01-11' },
      ];

      // 10 days at 5% (Jan 1-10) + 1 day at 10% (Jan 11), Jan 12 = endDate
      const rawAccrued = 10 * (10000 * 5 / 365 / 100) + 1 * (10000 * 10 / 365 / 100);
      const result = calculateBalance(transactions, rates, parseDate('2024-01-12'));

      expect(result.accruedInterest).toBe(r(rawAccrued));
    });

    it('should handle rate decrease', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      const rates: InterestRate[] = [
        { id: 1, rate: 10.0, effective_date: '2024-01-01' },
        { id: 2, rate: 3.0, effective_date: '2024-01-16' },
      ];

      // Jan 1-15 (15 days at 10%) + Jan 16-31 (16 days at 3%)
      const janRaw = 15 * (10000 * 10 / 365 / 100) + 16 * (10000 * 3 / 365 / 100);
      const result = calculateBalance(transactions, rates, parseDate('2024-02-01'));

      expect(result.principal).toBe(10000 + r(janRaw));
    });

    it('should handle rate change to 0%', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      const rates: InterestRate[] = [
        { id: 1, rate: 5.0, effective_date: '2024-01-01' },
        { id: 2, rate: 0, effective_date: '2024-01-16' },
      ];

      // Only 15 days of interest at 5% (Jan 1-15), then 0 for rest
      const janRaw = 15 * (10000 * 5 / 365 / 100);
      const result = calculateBalance(transactions, rates, parseDate('2024-02-01'));

      expect(result.principal).toBe(10000 + r(janRaw));
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

      // Jan: 31 days at 5% → compound
      const janCompound = r(31 * (10000 * 5 / 365 / 100));
      const balanceAfterJan = 10000 + janCompound;

      // Feb: 29 days at 7% on compounded balance → compound
      const febCompound = r(29 * (balanceAfterJan * 7 / 365 / 100));

      // Mar 1 = endDate, no accrual
      const result = calculateBalance(transactions, rates, parseDate('2024-03-01'));
      expect(result.principal).toBe(balanceAfterJan + febCompound);
      expect(result.accruedInterest).toBe(0);
    });

    it('should handle rates provided in unsorted order', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      const rates: InterestRate[] = [
        { id: 2, rate: 8.0, effective_date: '2024-01-16' },
        { id: 1, rate: 5.0, effective_date: '2024-01-01' },
      ];

      const janRaw = 15 * (10000 * 5 / 365 / 100) + 16 * (10000 * 8 / 365 / 100);
      const result = calculateBalance(transactions, rates, parseDate('2024-02-01'));

      expect(result.principal).toBe(10000 + r(janRaw));
    });

    it('should not apply a future rate to current calculations', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-01-01' },
      ];

      const rates: InterestRate[] = [
        { id: 1, rate: 5.0, effective_date: '2024-01-01' },
        { id: 2, rate: 99.0, effective_date: '2024-06-01' },
      ];

      // 10 completed days at 5% (Jan 1-10), Jan 11 = endDate
      const rawAccrued = 10 * (10000 * 5 / 365 / 100);
      const result = calculateBalance(transactions, rates, parseDate('2024-01-11'));

      expect(result.accruedInterest).toBe(r(rawAccrued));
    });

    it('should use 4.5% for Dec 2025 and 5% for Jan 2026 when rate changes at year boundary', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2025-12-01' },
      ];

      const rates: InterestRate[] = [
        { id: 1, rate: 4.5, effective_date: '2025-12-01' },
        { id: 2, rate: 5.0, effective_date: '2026-01-01' },
      ];

      // Dec: 31 days at 4.5% → compound on Jan 1
      const decCompound = r(31 * (10000 * 4.5 / 365 / 100));
      const balanceAfterDec = 10000 + decCompound;

      // Jan 1-15: 15 completed days at 5% on compounded balance, Jan 16 = endDate
      const janRaw = 15 * (balanceAfterDec * 5 / 365 / 100);

      const result = calculateBalance(transactions, rates, parseDate('2026-01-16'));

      expect(result.principal).toBe(balanceAfterDec);
      expect(result.accruedInterest).toBe(r(janRaw));
    });

    it('should use rate from before first transaction if rate predates it', () => {
      const transactions: Transaction[] = [
        { id: 1, type: 'deposit', amount: 10000, date: '2024-03-01' },
      ];

      const rates: InterestRate[] = [
        { id: 1, rate: 6.0, effective_date: '2023-01-01' },
      ];

      // 1 completed day (Mar 1), Mar 2 = endDate
      const rawAccrued = 1 * (10000 * 6 / 365 / 100);
      const result = calculateBalance(transactions, rates, parseDate('2024-03-02'));

      expect(result.accruedInterest).toBe(r(rawAccrued));
    });
  });

  describe('Duplicate Interest Prevention', () => {
    it('should not double-compound when interest transaction exists on the same day as auto-compound', () => {
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

      // 14 completed days (Feb 1-14) on 10042.47, Feb 15 = endDate
      const rawAccrued = 14 * (10042.47 * 5 / 365 / 100);
      const result = calculateBalance(transactions, mockRates, parseDate('2024-02-15'));

      expect(result.principal).toBe(10042.47);
      expect(result.accruedInterest).toBe(r(rawAccrued));
    });

    it('should produce consistent results whether interest is recorded or auto-compounded', () => {
      const txNoInterest: Transaction[] = [
        {
          id: 1,
          type: 'deposit',
          amount: 10000,
          date: '2024-01-01',
        },
      ];

      const resultAuto = calculateBalance(txNoInterest, mockRates, parseDate('2024-02-15'));

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

      expect(resultRecorded.balance).toBe(resultAuto.balance);
    });
  });
});
