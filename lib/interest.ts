import { Transaction, InterestRate } from './types';

// Utility to parse a date string (YYYY-MM-DD) into a Date object at local midnight
export function parseDate(dateStr: string): Date {
  if (!dateStr) {
    throw new Error('Date string is required');
  }
  const parts = dateStr.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0);
}

export function calculateBalance(
  transactions: Transaction[],
  interestRates: InterestRate[],
  targetDate: Date
): { balance: number; principal: number; accruedInterest: number } {
  if (transactions.length === 0) {
    return { balance: 0, principal: 0, accruedInterest: 0 };
  }

  // Sort transactions by date
  const sortedTransactions = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Sort interest rates by effective date
  const sortedRates = [...interestRates].sort(
    (a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime()
  );

  let balance = 0;
  let principal = 0;
  let accruedInterest = 0;

  // Start from the first transaction date - parse as local date
  const startDate = parseDate(sortedTransactions[0].date);

  // Parse target date properly too
  const endDate = new Date(targetDate);
  endDate.setHours(0, 0, 0, 0);

  let currentDate = new Date(startDate);
  let transactionIndex = 0;

  while (currentDate.getTime() <= endDate.getTime()) {
    // Process all transactions for this date
    let hasInterestTransaction = false;
    while (transactionIndex < sortedTransactions.length) {
      const txDate = parseDate(sortedTransactions[transactionIndex].date);

      if (txDate.getTime() <= currentDate.getTime()) {
        const transaction = sortedTransactions[transactionIndex];
        if (transaction.type === 'deposit') {
          balance += transaction.amount;
          principal += transaction.amount;
        } else if (transaction.type === 'withdrawal') {
          balance -= transaction.amount;
          principal -= transaction.amount;
        } else if (transaction.type === 'interest') {
          // Interest transactions add to both balance and principal
          balance += transaction.amount;
          principal += transaction.amount;
          hasInterestTransaction = true;
        }
        transactionIndex++;
      } else {
        break;
      }
    }

    // If we had an interest transaction today, reset accrued interest
    // (the transaction represents the compounding)
    if (hasInterestTransaction) {
      accruedInterest = 0;
    }

    // Move to next day BEFORE checking interest calculation
    const tomorrow = new Date(currentDate);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Calculate daily interest only if we're NOT on the target date
    // (interest accrues overnight, so we don't see it until tomorrow)
    if (currentDate.getTime() < endDate.getTime()) {
      const currentRate = getCurrentRate(sortedRates, currentDate);
      if (currentRate > 0 && balance > 0) {
        const dailyInterest = (balance * currentRate) / 365 / 100;
        accruedInterest += dailyInterest;
      }
    }

    // Check if tomorrow will have an interest transaction
    let tomorrowHasInterest = false;
    if (transactionIndex < sortedTransactions.length) {
      const nextTxDate = parseDate(sortedTransactions[transactionIndex].date);
      if (nextTxDate.getTime() === tomorrow.getTime() &&
        sortedTransactions[transactionIndex].type === 'interest') {
        tomorrowHasInterest = true;
      }
    }

    // Only auto-compound if:
    // 1. There was no interest transaction today
    // 2. Tomorrow is a new month
    // 3. Tomorrow won't have an interest transaction (to avoid double-compounding)
    if (!hasInterestTransaction &&
      !tomorrowHasInterest &&
      tomorrow.getMonth() !== currentDate.getMonth()) {
      balance += accruedInterest;
      principal += accruedInterest;
      accruedInterest = 0;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    balance: Math.round((balance + accruedInterest) * 100) / 100,
    principal: Math.round(principal * 100) / 100,
    accruedInterest: Math.round(accruedInterest * 100) / 100,
  };
}

function getCurrentRate(rates: InterestRate[], date: Date): number {
  if (!rates || rates.length === 0) {
    return 0;
  }

  let currentRate = 0;
  for (const rate of rates) {
    if (!rate || !rate.effective_date) {
      continue;
    }
    const rateDate = parseDate(rate.effective_date);
    if (rateDate.getTime() <= date.getTime()) {
      currentRate = rate.rate;
    } else {
      break;
    }
  }
  return currentRate;
}

export function getMonthEndDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setDate(1); // Start from the beginning of the month

  while (current <= endDate) {
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    if (monthEnd <= endDate) {
      dates.push(new Date(monthEnd));
    }
    current.setMonth(current.getMonth() + 1);
  }

  return dates;
}
