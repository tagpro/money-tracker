import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions, interestRates } from '@/lib/db/schema/app';
import { asc } from 'drizzle-orm';
import { calculateBalance } from '@/lib/interest';
import { Transaction, InterestRate } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const transactionsData = await db.select().from(transactions).orderBy(asc(transactions.date));
    const ratesData = await db.select().from(interestRates).orderBy(asc(interestRates.effectiveDate));

    // Map database results to expected types
    const mappedTransactions: Transaction[] = transactionsData.map(t => ({
      id: t.id,
      type: t.type as 'deposit' | 'withdrawal' | 'interest',
      amount: t.amount,
      date: t.date,
      description: t.description || undefined,
      created_at: t.createdAt || undefined,
    }));

    const mappedRates: InterestRate[] = ratesData
      .filter(r => r.effectiveDate) // Filter out any with null/undefined effectiveDate
      .map(r => ({
        id: r.id,
        rate: r.rate,
        effective_date: r.effectiveDate,
        created_at: r.createdAt || undefined,
      }));

    const balance = calculateBalance(
      mappedTransactions, 
      mappedRates, 
      new Date(targetDate)
    );

    return NextResponse.json(balance);
  } catch (error) {
    console.error('Error calculating balance:', error);
    return NextResponse.json({ error: 'Failed to calculate balance' }, { status: 500 });
  }
}
