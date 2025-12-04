import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions as transactionsTable, interestRates as interestRatesTable } from '@/lib/db/schema/app';
import { asc } from 'drizzle-orm';
import { Transaction, InterestRate } from '@/lib/types';
import { parseDate } from '@/lib/interest';

function getCurrentRate(rates: InterestRate[], date: Date): number {
  let currentRate = 0;
  const sortedRates = [...rates].sort(
    (a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime()
  );

  for (const rate of sortedRates) {
    if (parseDate(rate.effective_date) <= date) {
      currentRate = rate.rate;
    } else {
      break;
    }
  }
  return currentRate;
}

export async function POST() {
  try {
    const transactionsData = await db.select().from(transactionsTable).orderBy(asc(transactionsTable.date));
    const ratesData = await db.select().from(interestRatesTable).orderBy(asc(interestRatesTable.effectiveDate));

    const transactions: Transaction[] = transactionsData.map(t => ({
      id: t.id,
      type: t.type as 'deposit' | 'withdrawal' | 'interest',
      amount: t.amount,
      date: t.date,
      description: t.description || undefined,
      created_at: t.createdAt || undefined,
    }));

    const interestRates: InterestRate[] = ratesData
      .filter(r => r.effectiveDate) // Filter out any with null/undefined effectiveDate
      .map(r => ({
        id: r.id,
        rate: r.rate,
        effective_date: r.effectiveDate,
        created_at: r.createdAt || undefined,
      }));

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions found' }, { status: 404 });
    }

    // Calculate accrued interest from first transaction date to today
    const startDate = parseDate(transactions[0].date);
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    let balance = 0;
    let principal = 0;
    let accruedInterest = 0;
    let currentDate = new Date(startDate);
    let transactionIndex = 0;
    let interestTransactionsAdded = 0;

    while (currentDate <= endDate) {
      const currentDateStr = currentDate.toISOString().split('T')[0];

      // Process all transactions for this date
      while (
        transactionIndex < transactions.length &&
        parseDate(transactions[transactionIndex].date).getTime() <= currentDate.getTime()
      ) {
        const transaction = transactions[transactionIndex];

        if (transaction.type === 'deposit') {
          balance += transaction.amount;
          principal += transaction.amount;
        } else if (transaction.type === 'withdrawal') {
          balance -= transaction.amount;
          principal -= transaction.amount;
        } else if (transaction.type === 'interest') {
          balance += transaction.amount;
          // If we find an interest transaction, it means interest for the previous period
          // has already been compounded. We should reset accrued interest to avoid double counting.
          accruedInterest = 0;
        }
        transactionIndex++;
      }

      // Calculate daily interest
      const currentRate = getCurrentRate(interestRates, currentDate);
      const dailyInterest = balance > 0 && currentRate > 0
        ? (balance * currentRate) / 365 / 100
        : 0;

      // Check if this is the first day of the month and we have accrued interest
      if (currentDate.getDate() === 1 && accruedInterest > 0) {
        // Compound the accrued interest from previous month
        balance += accruedInterest;
        principal += accruedInterest;

        // Record this as an interest transaction in the database
        const previousMonth = new Date(currentDate);
        previousMonth.setDate(0); // Last day of previous month
        const monthName = previousMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        await db.insert(transactionsTable).values({
          type: 'interest',
          amount: accruedInterest,
          date: currentDateStr,
          description: `Interest compounded for ${monthName}`,
        });

        interestTransactionsAdded++;
        accruedInterest = 0;
      }

      if (dailyInterest > 0) {
        accruedInterest += dailyInterest;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return NextResponse.json({
      success: true,
      interestTransactionsAdded,
      currentAccruedInterest: accruedInterest,
      message: `Added ${interestTransactionsAdded} interest transaction(s) to history. Current month accrued interest: ${accruedInterest.toFixed(2)}`
    });
  } catch (error) {
    console.error('Error adding accrued interest:', error);
    return NextResponse.json({ error: 'Failed to add accrued interest' }, { status: 500 });
  }
}
