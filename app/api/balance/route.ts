import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateBalance } from '@/lib/interest';
import { Transaction, InterestRate } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const transactionsResult = await db.execute('SELECT * FROM transactions ORDER BY date ASC');
    const ratesResult = await db.execute('SELECT * FROM interest_rates ORDER BY effective_date ASC');

    const transactions = transactionsResult.rows as unknown as Transaction[];
    const interestRates = ratesResult.rows as unknown as InterestRate[];

    const balance = calculateBalance(transactions, interestRates, new Date(targetDate));

    return NextResponse.json(balance);
  } catch (error) {
    console.error('Error calculating balance:', error);
    return NextResponse.json({ error: 'Failed to calculate balance' }, { status: 500 });
  }
}
