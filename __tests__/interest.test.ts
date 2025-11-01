import { calculateBalance } from '../lib/interest';
import { Transaction, InterestRate } from '../lib/types';

describe('Interest Calculation', () => {
  describe('calculateBalance', () => {
    it('should return zero for empty transactions', () => {
      const result = calculateBalance([], [], new Date('2024-11-01'));
      expect(result.balance).toBe(0);
      expect(result.principal).toBe(0);
      expect(result.accruedInterest).toBe(0);
    });

    it('should calculate simple deposit without interest', () => {
      const transactions: Transaction[] = [
        { type: 'deposit', amount: 1000, date: '2024-10-01' }
      ];
      const rates: InterestRate[] = [];
      
      const result = calculateBalance(transactions, rates, new Date('2024-10-01'));
      expect(result.balance).toBe(1000);
      expect(result.principal).toBe(1000);
      expect(result.accruedInterest).toBe(0);
    });

    it('should calculate daily interest without compounding', () => {
      const transactions: Transaction[] = [
        { type: 'deposit', amount: 1000, date: '2024-10-01' }
      ];
      const rates: InterestRate[] = [
        { rate: 5, effective_date: '2024-10-01' } // 5% annual rate
      ];
      
      // After 10 days
      const result = calculateBalance(transactions, rates, new Date('2024-10-10'));
      
      // Daily rate = 5% / 365 = 0.0136986%
      // Daily interest = 1000 * 0.05 / 365 = 0.136986
      // 10 days = 0.136986 * 10 = 1.36986
      expect(result.principal).toBe(1000);
      expect(result.accruedInterest).toBeCloseTo(1.37, 2);
      expect(result.balance).toBeCloseTo(1001.37, 2);
    });

    it('should show accrued interest in the middle of the month', () => {
      const transactions: Transaction[] = [
        { type: 'deposit', amount: 10000, date: '2024-10-01' }
      ];
      const rates: InterestRate[] = [
        { rate: 12, effective_date: '2024-10-01' } // 12% annual rate
      ];
      
      // Check on Oct 15 (halfway through month)
      const result = calculateBalance(transactions, rates, new Date('2024-10-15'));
      
      // Daily interest = 10000 * 0.12 / 365 = 3.2877
      // 15 days = 3.2877 * 15 = 49.315
      expect(result.principal).toBe(10000);
      expect(result.accruedInterest).toBeCloseTo(49.32, 1);
      expect(result.balance).toBeCloseTo(10049.32, 1);
    });

    it('should compound interest at month end', () => {
      const transactions: Transaction[] = [
        { type: 'deposit', amount: 10000, date: '2024-10-01' }
      ];
      const rates: InterestRate[] = [
        { rate: 12, effective_date: '2024-10-01' } // 12% annual rate
      ];
      
      // Check on Nov 1 (after compounding on Oct 31)
      const result = calculateBalance(transactions, rates, new Date('2024-11-01'));
      
      // October has 31 days
      // Daily interest = 10000 * 0.12 / 365 = 3.2877
      // 31 days = 3.2877 * 31 = 101.92
      // After compounding, this becomes principal
      // Then 1 day in November = (10000 + 101.92) * 0.12 / 365 = 3.32
      expect(result.principal).toBeCloseTo(10101.92, 1);
      expect(result.accruedInterest).toBeCloseTo(3.32, 1);
      expect(result.balance).toBeCloseTo(10105.24, 1);
    });

    it('should handle multiple months of compounding', () => {
      const transactions: Transaction[] = [
        { type: 'deposit', amount: 10000, date: '2024-10-01' }
      ];
      const rates: InterestRate[] = [
        { rate: 12, effective_date: '2024-10-01' }
      ];
      
      // Check on Jan 1, 2025 (after 3 months)
      const result = calculateBalance(transactions, rates, new Date('2025-01-01'));
      
      // This should compound at end of Oct, Nov, Dec
      expect(result.principal).toBeGreaterThan(10300); // At least 3% growth
      expect(result.balance).toBeGreaterThan(result.principal);
    });

    it('should handle withdrawals', () => {
      const transactions: Transaction[] = [
        { type: 'deposit', amount: 10000, date: '2024-10-01' },
        { type: 'withdrawal', amount: 2000, date: '2024-10-15' }
      ];
      const rates: InterestRate[] = [
        { rate: 12, effective_date: '2024-10-01' }
      ];
      
      const result = calculateBalance(transactions, rates, new Date('2024-10-20'));
      
      // Should calculate interest on 10000 for 15 days, then on 8000 for 5 days
      expect(result.principal).toBeLessThan(8100);
      expect(result.principal).toBeGreaterThan(8000);
    });

    it('should handle interest rate changes', () => {
      const transactions: Transaction[] = [
        { type: 'deposit', amount: 10000, date: '2024-10-01' }
      ];
      const rates: InterestRate[] = [
        { rate: 5, effective_date: '2024-10-01' },
        { rate: 10, effective_date: '2024-10-15' } // Rate doubles halfway through month
      ];
      
      const result = calculateBalance(transactions, rates, new Date('2024-10-31'));
      
      // First 14 days at 5%, then 17 days at 10%
      // Should be between single-rate calculations
      const lowEstimate = (10000 * 0.05 / 365) * 31; // All at 5%
      const highEstimate = (10000 * 0.10 / 365) * 31; // All at 10%
      
      expect(result.accruedInterest).toBeGreaterThan(lowEstimate);
      expect(result.accruedInterest).toBeLessThan(highEstimate);
    });

    it('should not compound interest mid-month', () => {
      const transactions: Transaction[] = [
        { type: 'deposit', amount: 10000, date: '2024-10-01' }
      ];
      const rates: InterestRate[] = [
        { rate: 12, effective_date: '2024-10-01' }
      ];
      
      // Check on Oct 15
      const result = calculateBalance(transactions, rates, new Date('2024-10-15'));
      
      // Principal should still be the original deposit
      expect(result.principal).toBe(10000);
      // But accrued interest should be positive
      expect(result.accruedInterest).toBeGreaterThan(0);
    });

    it('should handle multiple deposits', () => {
      const transactions: Transaction[] = [
        { type: 'deposit', amount: 5000, date: '2024-10-01' },
        { type: 'deposit', amount: 3000, date: '2024-10-10' },
        { type: 'deposit', amount: 2000, date: '2024-10-20' }
      ];
      const rates: InterestRate[] = [
        { rate: 12, effective_date: '2024-10-01' }
      ];
      
      const result = calculateBalance(transactions, rates, new Date('2024-10-31'));
      
      // Principal should be sum of deposits
      expect(result.principal).toBeCloseTo(10000, 0);
      // Interest should be calculated on varying balances
      expect(result.accruedInterest).toBeGreaterThan(0);
    });

    it('should handle zero interest rate', () => {
      const transactions: Transaction[] = [
        { type: 'deposit', amount: 10000, date: '2024-10-01' }
      ];
      const rates: InterestRate[] = [
        { rate: 0, effective_date: '2024-10-01' }
      ];
      
      const result = calculateBalance(transactions, rates, new Date('2024-10-31'));
      
      expect(result.principal).toBe(10000);
      expect(result.accruedInterest).toBe(0);
      expect(result.balance).toBe(10000);
    });

    it('should handle interest transactions from previous compounding', () => {
      const transactions: Transaction[] = [
        { type: 'deposit', amount: 10000, date: '2024-10-01' },
        { type: 'interest', amount: 100, date: '2024-11-01', description: 'Interest compounded for October 2024' }
      ];
      const rates: InterestRate[] = [
        { rate: 12, effective_date: '2024-10-01' }
      ];
      
      const result = calculateBalance(transactions, rates, new Date('2024-11-15'));
      
      // The interest transaction should be included in balance
      expect(result.balance).toBeGreaterThan(10100);
    });
  });
});
