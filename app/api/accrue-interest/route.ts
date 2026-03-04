import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions as transactionsTable, interestRates as interestRatesTable } from '@/lib/db/schema/app';
import { asc, eq } from 'drizzle-orm';
import { Transaction, InterestRate } from '@/lib/types';
import { simulateInterestLedger } from '@/lib/interest';

async function fetchAllData() {
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
    .filter(r => r.effectiveDate)
    .map(r => ({
      id: r.id,
      rate: r.rate,
      effective_date: r.effectiveDate,
      created_at: r.createdAt || undefined,
    }));

  return { transactions, interestRates };
}

// GET: Verify interest calculations — compare expected vs recorded
export async function GET() {
  try {
    const { transactions, interestRates } = await fetchAllData();

    if (transactions.length === 0) {
      return NextResponse.json({ discrepancies: [], allCorrect: true, currentMonthAccrued: 0 });
    }

    const existingInterest = transactions.filter(t => t.type === 'interest');
    const nonInterestTx = transactions.filter(t => t.type !== 'interest');

    const { postings: expected, accruedInterest: currentMonthAccrued } = simulateInterestLedger(
      nonInterestTx,
      interestRates,
      new Date(),
      false,
    );

    const existingByDate = new Map(existingInterest.map(t => [t.date, t]));
    const expectedDates = new Set(expected.map(e => e.date));
    const discrepancies: {
      date: string;
      month: string;
      expected: number;
      actual: number | null;
      existingTransactionId: number | null;
      action: 'update' | 'insert' | 'delete';
    }[] = [];

    for (const exp of expected) {
      const actual = existingByDate.get(exp.date);
      if (!actual) {
        discrepancies.push({
          date: exp.date,
          month: exp.description.replace('Interest compounded for ', ''),
          expected: exp.amount,
          actual: null,
          existingTransactionId: null,
          action: 'insert',
        });
      } else if (Math.abs(actual.amount - exp.amount) > 0.01) {
        discrepancies.push({
          date: exp.date,
          month: exp.description.replace('Interest compounded for ', ''),
          expected: exp.amount,
          actual: actual.amount,
          existingTransactionId: actual.id || null,
          action: 'update',
        });
      }
    }

    for (const [date, tx] of existingByDate) {
      if (!expectedDates.has(date)) {
        const d = new Date(date + 'T00:00:00');
        const previousMonth = new Date(d);
        previousMonth.setDate(0);
        const monthName = previousMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        discrepancies.push({
          date,
          month: monthName,
          expected: 0,
          actual: tx.amount,
          existingTransactionId: tx.id || null,
          action: 'delete',
        });
      }
    }

    discrepancies.sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      discrepancies,
      allCorrect: discrepancies.length === 0,
      currentMonthAccrued,
    });
  } catch (error) {
    console.error('Error verifying interest:', error);
    return NextResponse.json({ error: 'Failed to verify interest' }, { status: 500 });
  }
}

// POST: Auto-accrue (no body) or apply corrections ({ action: 'apply' })
export async function POST(request: Request) {
  try {
    let body: { action?: string } = {};
    try {
      body = await request.json();
    } catch {
      // No body = auto-accrue mode
    }

    if (body.action === 'apply') {
      // Delete all existing interest transactions and re-insert correct ones
      await db.delete(transactionsTable).where(eq(transactionsTable.type, 'interest'));

      const { transactions, interestRates } = await fetchAllData();
      const { postings: expected } = simulateInterestLedger(
        transactions,
        interestRates,
        new Date(),
        false,
      );

      for (const exp of expected) {
        await db.insert(transactionsTable).values({
          type: 'interest',
          amount: exp.amount,
          date: exp.date,
          description: exp.description,
        });
      }

      return NextResponse.json({
        success: true,
        message: `Re-calculated and updated ${expected.length} interest transaction(s).`,
      });
    }

    // Default: auto-accrue — insert only missing interest postings
    const { transactions, interestRates } = await fetchAllData();

    if (transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions found' }, { status: 404 });
    }

    const nonInterestTx = transactions.filter(t => t.type !== 'interest');
    const existingInterestDates = new Set(
      transactions.filter(t => t.type === 'interest').map(t => t.date)
    );

    const { postings, accruedInterest } = simulateInterestLedger(
      nonInterestTx,
      interestRates,
      new Date(),
      false,
    );

    let interestTransactionsAdded = 0;
    for (const posting of postings) {
      if (!existingInterestDates.has(posting.date)) {
        await db.insert(transactionsTable).values({
          type: 'interest',
          amount: posting.amount,
          date: posting.date,
          description: posting.description,
        });
        interestTransactionsAdded++;
      }
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
