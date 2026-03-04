import { Transaction, InterestRate } from './types';

// Utility to parse a date string (YYYY-MM-DD) into a Date object at local midnight
export function parseDate(dateStr: string): Date {
  if (!dateStr) {
    throw new Error('Date string is required');
  }
  const parts = dateStr.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0);
}

// Format a Date as YYYY-MM-DD using local time (never UTC)
export function formatDateLocal(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Normalize a Date to local midnight (strips time component using local timezone)
export function toLocalMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export type InterestPosting = {
  date: string;
  amount: number;
  description: string;
};

export type InterestSimulationResult = {
  balance: number;
  principal: number;
  accruedInterest: number;
  postings: InterestPosting[];
};

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

/**
 * Single source of truth for interest simulation.
 *
 * Walks day-by-day from the first transaction date to endDate (inclusive).
 *
 * Interest accrual for a month includes the 1st through the last day of
 * that month.  Compounding happens on the 1st of the next month *before*
 * that day's interest is calculated, so the 1st's interest belongs to the
 * new month.
 *
 * @param includeInterestTx  When true, existing interest transactions in
 *   the input are applied (add to balance/principal, reset accrual).
 *   When false they are ignored — useful for computing "expected" postings.
 */
export function simulateInterestLedger(
  transactions: Transaction[],
  interestRates: InterestRate[],
  endDate: Date,
  includeInterestTx: boolean = true,
): InterestSimulationResult {
  if (transactions.length === 0) {
    return { balance: 0, principal: 0, accruedInterest: 0, postings: [] };
  }

  const sortedTx = [...transactions].sort(
    (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime()
  );

  const sortedRates = [...interestRates].sort(
    (a, b) => parseDate(a.effective_date).getTime() - parseDate(b.effective_date).getTime()
  );

  let balance = 0;
  let principal = 0;
  let accruedInterest = 0;
  const postings: InterestPosting[] = [];

  const start = parseDate(sortedTx[0].date);
  const end = toLocalMidnight(endDate);
  let currentDate = new Date(start);
  let txIndex = 0;

  while (currentDate.getTime() <= end.getTime()) {
    // --- 1. Compound on the 1st of each month (before processing that day) ---
    if (currentDate.getDate() === 1 && accruedInterest > 0) {
      // When including interest txs, check if one already exists for today
      // to avoid double-compounding
      let todayHasInterestTx = false;
      if (includeInterestTx) {
        for (let i = txIndex; i < sortedTx.length; i++) {
          const txDate = parseDate(sortedTx[i].date);
          if (txDate.getTime() > currentDate.getTime()) break;
          if (sortedTx[i].type === 'interest') {
            todayHasInterestTx = true;
            break;
          }
        }
      }

      if (!todayHasInterestTx) {
        const previousMonth = new Date(currentDate);
        previousMonth.setDate(0);
        const monthName = previousMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const roundedAmount = Math.round(accruedInterest * 100) / 100;

        postings.push({
          date: formatDateLocal(currentDate),
          amount: roundedAmount,
          description: `Interest compounded for ${monthName}`,
        });

        balance += roundedAmount;
        principal += roundedAmount;
        accruedInterest = 0;
      }
    }

    // --- 2. Apply transactions for this day ---
    let hasInterestTxToday = false;
    while (txIndex < sortedTx.length) {
      const txDate = parseDate(sortedTx[txIndex].date);
      if (txDate.getTime() > currentDate.getTime()) break;

      const tx = sortedTx[txIndex];
      if (tx.type === 'deposit') {
        balance += tx.amount;
        principal += tx.amount;
      } else if (tx.type === 'withdrawal') {
        balance -= tx.amount;
        principal -= tx.amount;
      } else if (tx.type === 'interest' && includeInterestTx) {
        balance += tx.amount;
        principal += tx.amount;
        hasInterestTxToday = true;
      }
      txIndex++;
    }

    // If an existing interest transaction was applied today, reset accrual
    // (it already represents compounding for the previous period)
    if (hasInterestTxToday) {
      accruedInterest = 0;
    }

    // --- 3. Accrue daily interest (only for completed days, exclude endDate) ---
    if (currentDate.getTime() < end.getTime()) {
    const currentRate = getCurrentRate(sortedRates, currentDate);
    if (currentRate > 0 && balance > 0) {
      const dailyInterest = (balance * currentRate) / 365 / 100;
      accruedInterest += dailyInterest;
    }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    balance: Math.round((balance + accruedInterest) * 100) / 100,
    principal: Math.round(principal * 100) / 100,
    accruedInterest: Math.round(accruedInterest * 100) / 100,
    postings,
  };
}

export function calculateBalance(
  transactions: Transaction[],
  interestRates: InterestRate[],
  targetDate: Date
): { balance: number; principal: number; accruedInterest: number } {
  const result = simulateInterestLedger(transactions, interestRates, targetDate, true);
  return {
    balance: result.balance,
    principal: result.principal,
    accruedInterest: result.accruedInterest,
  };
}

export function getMonthEndDates(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setDate(1);

  while (current <= endDate) {
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    if (monthEnd <= endDate) {
      dates.push(new Date(monthEnd));
    }
    current.setMonth(current.getMonth() + 1);
  }

  return dates;
}
