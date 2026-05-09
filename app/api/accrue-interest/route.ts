import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions as transactionsTable, interestRates as interestRatesTable } from '@/lib/db/schema/app';
import { asc, eq } from 'drizzle-orm';
import { Transaction, InterestRate } from '@/lib/types';
import { simulateInterestLedger, applyMissingInterest, getCurrentMelbourneDate } from '@/lib/interest';
import { auth } from '@/lib/auth/auth';

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

    const targetDate = getCurrentMelbourneDate();
    const { postings: expected, accruedInterest: currentMonthAccrued } = simulateInterestLedger(
      nonInterestTx,
      interestRates,
      targetDate,
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

// POST: Auto-accrue or apply corrections
export async function POST(request: Request) {
  try {
    // 1. Verify Authentication (Session or API Key)
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { action?: string } = {};
    try {
      body = await request.json();
    } catch {
      // No body = auto-accrue mode
    }

    if (body.action === 'apply') {
      // Delete all existing interest transactions and re-insert correct ones
      await db.delete(transactionsTable).where(eq(transactionsTable.type, 'interest'));
      
      const targetDate = getCurrentMelbourneDate();
      const result = await applyMissingInterest(targetDate);

      return NextResponse.json({
        success: true,
        message: `Re-calculated and updated all interest transactions. ${result.message}`,
      });
    }

    // Default: auto-accrue — insert only missing interest postings
    const targetDate = getCurrentMelbourneDate();
    const result = await applyMissingInterest(targetDate);

    return NextResponse.json({
      success: true,
      interestTransactionsAdded: result.added,
      message: result.message
    });
  } catch (error) {
    console.error('Error adding accrued interest:', error);
    return NextResponse.json({ error: 'Failed to add accrued interest' }, { status: 500 });
  }
}
