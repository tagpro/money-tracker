import { calculateBalance } from './lib/interest';
import { Transaction, InterestRate } from './lib/types';

console.log('Testing Interest Calculation...\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.error(`  ${error}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertClose(actual: number, expected: number, tolerance: number, message: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

// Test 1: Accrued interest in middle of month
test('Should show accrued interest mid-month', () => {
  const transactions: Transaction[] = [
    { type: 'deposit', amount: 10000, date: '2024-10-01' }
  ];
  const rates: InterestRate[] = [
    { rate: 12, effective_date: '2024-10-01' }
  ];
  const result = calculateBalance(transactions, rates, new Date('2024-10-15'));
  
  console.log(`  Principal: ${result.principal}, Accrued: ${result.accruedInterest.toFixed(2)}, Balance: ${result.balance.toFixed(2)}`);
  assert(result.principal === 10000, 'Principal should be 10000');
  assert(result.accruedInterest > 0, 'Accrued interest should be positive');
  assertClose(result.accruedInterest, 49.32, 1, 'Accrued interest');
});

// Test 2: Compounding at month end
test('Should compound interest at month end', () => {
  const transactions: Transaction[] = [
    { type: 'deposit', amount: 10000, date: '2024-10-01' }
  ];
  const rates: InterestRate[] = [
    { rate: 12, effective_date: '2024-10-01' }
  ];
  const result = calculateBalance(transactions, rates, new Date('2024-11-01'));
  
  console.log(`  Principal: ${result.principal.toFixed(2)}, Accrued: ${result.accruedInterest.toFixed(2)}, Balance: ${result.balance.toFixed(2)}`);
  assert(result.principal > 10000, 'Principal should be greater than 10000 after compounding');
  assertClose(result.principal, 10101.92, 2, 'Principal after compounding');
  assert(result.accruedInterest > 0, 'Should have new accrued interest for November');
});

// Test 3: No interest without rate
test('Should not accrue interest without a rate', () => {
  const transactions: Transaction[] = [
    { type: 'deposit', amount: 10000, date: '2024-10-01' }
  ];
  const rates: InterestRate[] = [];
  const result = calculateBalance(transactions, rates, new Date('2024-10-15'));
  
  console.log(`  Principal: ${result.principal}, Accrued: ${result.accruedInterest}, Balance: ${result.balance}`);
  assert(result.principal === 10000, 'Principal should be 10000');
  assert(result.accruedInterest === 0, 'Accrued interest should be 0');
  assert(result.balance === 10000, 'Balance should equal principal');
});

// Test 4: Daily interest calculation
test('Should calculate daily interest correctly', () => {
  const transactions: Transaction[] = [
    { type: 'deposit', amount: 1000, date: '2024-10-01' }
  ];
  const rates: InterestRate[] = [
    { rate: 5, effective_date: '2024-10-01' }
  ];
  const result = calculateBalance(transactions, rates, new Date('2024-10-10'));
  
  console.log(`  Principal: ${result.principal}, Accrued: ${result.accruedInterest.toFixed(2)}, Balance: ${result.balance.toFixed(2)}`);
  assert(result.principal === 1000, 'Principal should be 1000');
  assertClose(result.accruedInterest, 1.37, 0.05, 'Accrued interest for 10 days');
});

// Test 5: Multiple months compounding
test('Should compound over multiple months', () => {
  const transactions: Transaction[] = [
    { type: 'deposit', amount: 10000, date: '2024-10-01' }
  ];
  const rates: InterestRate[] = [
    { rate: 12, effective_date: '2024-10-01' }
  ];
  const result = calculateBalance(transactions, rates, new Date('2025-01-01'));
  
  console.log(`  Principal: ${result.principal.toFixed(2)}, Accrued: ${result.accruedInterest.toFixed(2)}, Balance: ${result.balance.toFixed(2)}`);
  assert(result.principal > 10300, 'Principal should grow by at least 3% over 3 months');
  assert(result.balance > result.principal, 'Balance should include accrued interest');
});

// Test 6: Withdrawals
test('Should handle withdrawals correctly', () => {
  const transactions: Transaction[] = [
    { type: 'deposit', amount: 10000, date: '2024-10-01' },
    { type: 'withdrawal', amount: 2000, date: '2024-10-15' }
  ];
  const rates: InterestRate[] = [
    { rate: 12, effective_date: '2024-10-01' }
  ];
  const result = calculateBalance(transactions, rates, new Date('2024-10-20'));
  
  console.log(`  Principal: ${result.principal.toFixed(2)}, Accrued: ${result.accruedInterest.toFixed(2)}, Balance: ${result.balance.toFixed(2)}`);
  assert(result.principal < 8100, 'Principal should be less than 8100');
  assert(result.principal > 8000, 'Principal should be greater than 8000');
});

// Test 7: Empty transactions
test('Should handle empty transactions', () => {
  const result = calculateBalance([], [], new Date('2024-11-01'));
  
  console.log(`  Principal: ${result.principal}, Accrued: ${result.accruedInterest}, Balance: ${result.balance}`);
  assert(result.balance === 0, 'Balance should be 0');
  assert(result.principal === 0, 'Principal should be 0');
  assert(result.accruedInterest === 0, 'Accrued interest should be 0');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
