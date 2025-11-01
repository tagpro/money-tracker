import { Transaction, InterestRate } from './types';

export function calculateBalance(
  transactions: Transaction[],
  interestRates: InterestRate[],
  targetDate: Date
): { balance: number; principal: number; accruedInterest: number } {
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
  let currentDate = new Date(sortedTransactions[0]?.date || targetDate);
  
  if (sortedTransactions.length === 0) {
    return { balance: 0, principal: 0, accruedInterest: 0 };
  }

  currentDate.setHours(0, 0, 0, 0);
  const endDate = new Date(targetDate);
  endDate.setHours(0, 0, 0, 0);

  let transactionIndex = 0;
  let lastCompoundDate = new Date(currentDate);
  lastCompoundDate.setDate(1); // Start of the month

  while (currentDate <= endDate) {
    // Process all transactions for this date
    while (
      transactionIndex < sortedTransactions.length &&
      new Date(sortedTransactions[transactionIndex].date).getTime() <= currentDate.getTime()
    ) {
      const transaction = sortedTransactions[transactionIndex];
      if (transaction.type === 'deposit') {
        balance += transaction.amount;
        principal += transaction.amount;
      } else if (transaction.type === 'withdrawal') {
        balance -= transaction.amount;
        principal -= transaction.amount;
      } else if (transaction.type === 'interest') {
        // Interest already added
        balance += transaction.amount;
      }
      transactionIndex++;
    }

    // Calculate daily interest
    const currentRate = getCurrentRate(sortedRates, currentDate);
    if (currentRate > 0 && balance > 0) {
      const dailyInterest = (balance * currentRate) / 365 / 100;
      accruedInterest += dailyInterest;
    }

    // Check if we need to compound (end of month)
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    if (nextDay.getMonth() !== currentDate.getMonth() || nextDay > endDate) {
      // Compound the interest
      balance += accruedInterest;
      principal += accruedInterest;
      accruedInterest = 0;
      lastCompoundDate = new Date(nextDay);
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
  let currentRate = 0;
  for (const rate of rates) {
    if (new Date(rate.effective_date) <= date) {
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
