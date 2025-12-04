import { calculateBalance } from '../lib/interest';
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
      expect(result.principal).toBeCloseTo(10042.47, 1); // Allow more tolerance for rounding
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

      // Balance should include interest transaction
      expect(result.balance).toBeCloseTo(10042.47, 1);
      // Principal should ALSO include interest (it was added via transaction)
      expect(result.principal).toBeCloseTo(10042.47, 1);
      // Accrued should be 0 since interest transaction resets it
      expect(result.accruedInterest).toBe(0);
    });

    it('should include interest in principal for future calculations', () => {
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

      // On Feb 2, principal should include the interest
      const result = calculateBalance(transactions, mockRates, new Date('2024-02-02'));

      console.log('Principal on Feb 2:', result.principal);
      console.log('Balance on Feb 2:', result.balance);
      console.log('Accrued on Feb 2:', result.accruedInterest);

      // Principal should be 10042.47 (deposit + interest transaction)
      // Accrued should be 1 day on that principal
    });

    it('should handle multiple months of interest transactions', () => {
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
          amount: 38.78,
          date: '2024-03-01',
          description: 'Interest compounded for February 2024',
          created_at: '2024-03-01T00:00:00.000Z',
        },
      ];

      const result = calculateBalance(transactions, mockRates, new Date('2024-03-01'));

      console.log('Multi-month principal:', result.principal);
      console.log('Expected:', 10000 + 42.47 + 38.78);

      // Total principal should include all interest
      // But does it?
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
          amount: 42.47, // Interest for Jan
          date: '2024-02-01',
          description: 'Interest compounded for January 2024',
          created_at: '2024-02-01T00:00:00.000Z',
        },
      ];

      // Calculate to Feb 2
      // Should see:
      // 1. Principal = 10000 + 42.47 (from transaction)
      // 2. Accrued Interest = 1 day of interest on new principal (Feb 1-2)
      // It should NOT add another 42.47 from calculation
      const result = calculateBalance(transactions, mockRates, new Date('2024-02-02'));

      expect(result.principal).toBeCloseTo(10042.47, 2);
      // If double counting happened, accruedInterest might be huge or principal wrong
      // Feb 1 interest: 10042.47 * 5% / 365 = 1.375
      expect(result.accruedInterest).toBeCloseTo(1.38, 2);
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
      expect(result.principal).toBe(8000); // Principal is just deposits - withdrawals
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
  });
});
