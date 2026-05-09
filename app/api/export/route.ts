import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions as transactionsTable, interestRates as interestRatesTable } from '@/lib/db/schema/app';
import { asc } from 'drizzle-orm';
import { Transaction, InterestRate } from '@/lib/types';
import { parseDate, formatDateLocal, simulateInterestLedger } from '@/lib/interest';
import { auth } from '@/lib/auth/auth';

export async function GET(request: Request) {
  try {
    // 1. Verify Authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    if (transactions.length === 0) {
      return new NextResponse('No data to export', { status: 404 });
    }

    // Use the simulation as the source of truth for the ledger
    const endDate = new Date();
    const { postings: expectedPostings } = simulateInterestLedger(
      transactions.filter(t => t.type !== 'interest'),
      interestRates,
      endDate,
      false
    );

    // Create a map of expected interest postings for easy lookup during the daily loop
    const expectedInterestMap = new Map(expectedPostings.map(p => [p.date, p]));

    // Calculate daily interest for CSV
    const startDate = parseDate(transactions[0].date);
    const end = new Date();
    end.setHours(0, 0, 0, 0);

    let csv = 'Date,Balance,Daily Interest Rate (%),Daily Interest Amount,Principal,Accrued Interest (Month),Transaction Type,Transaction Amount,Description\n';
    
    let balance = 0;
    let principal = 0;
    let accruedInterest = 0;
    let currentDate = new Date(startDate);
    let transactionIndex = 0;
    
    // Sort transactions by date for the loop
    const sortedTx = [...transactions].sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
    const sortedRates = [...interestRates].sort((a, b) => parseDate(a.effective_date).getTime() - parseDate(b.effective_date).getTime());

    function getRateForDate(date: Date): number {
      let rate = 0;
      for (const r of sortedRates) {
        if (parseDate(r.effective_date).getTime() <= date.getTime()) {
          rate = r.rate;
        } else {
          break;
        }
      }
      return rate;
    }

    while (currentDate <= end) {
      const currentDateStr = formatDateLocal(currentDate);
      let transactionType = '';
      let transactionAmount = 0;
      let transactionDesc = '';
      
      // 1. Compounding at the start of the 1st
      if (currentDate.getDate() === 1 && accruedInterest > 0) {
        const expected = expectedInterestMap.get(currentDateStr);
        if (expected) {
          balance += expected.amount;
          principal += expected.amount;
          accruedInterest = 0;
          // We don't record this as a transaction yet, it will be picked up 
          // if it exists in the DB or shown as simulated
        }
      }

      // 2. Process transactions for this day
      while (
        transactionIndex < sortedTx.length &&
        parseDate(sortedTx[transactionIndex].date).getTime() <= currentDate.getTime()
      ) {
        const transaction = sortedTx[transactionIndex];
        transactionType = transaction.type;
        transactionAmount = transaction.amount;
        transactionDesc = transaction.description || '';
        
        if (transaction.type === 'deposit') {
          balance += transaction.amount;
          principal += transaction.amount;
        } else if (transaction.type === 'withdrawal') {
          balance -= transaction.amount;
          principal -= transaction.amount;
        } else if (transaction.type === 'interest') {
          // If we encounter an interest transaction in the DB, it should 
          // ideally match our expected compounding. We reset accrual.
          // Note: In a clean state, balance/principal already updated above if it was the 1st.
          // If the DB transaction is on a different day or duplicated, we follow the DB for the "Balance" column.
          // But to keep it simple and consistent with simulateInterestLedger:
          accruedInterest = 0;
        }
        transactionIndex++;
      }

      // 3. Daily interest accrual
      const currentRate = getRateForDate(currentDate);
      const dailyInterest = balance > 0 && currentRate > 0 
        ? (balance * currentRate) / 365 / 100 
        : 0;
      
      if (dailyInterest > 0) {
        accruedInterest += dailyInterest;
      }

      // Add row to CSV
      csv += `${currentDateStr},${balance.toFixed(2)},${currentRate.toFixed(2)},${dailyInterest.toFixed(4)},${principal.toFixed(2)},${accruedInterest.toFixed(2)},${transactionType},${transactionAmount || ''},\"${transactionDesc}\"\n`;

      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Add summary section
    csv += '\n\nTransactions Summary\n';
    csv += 'Type,Date,Amount,Description,Created At\n';
    
    transactions.forEach((t) => {
      csv += `${t.type},${t.date},${t.amount},"${t.description || ''}",${t.created_at}\n`;
    });

    csv += '\n\nInterest Rates\n';
    csv += 'Rate (%),Effective Date,Created At\n';
    
    interestRates.forEach((r) => {
      csv += `${r.rate},${r.effective_date},${r.created_at}\n`;
    });

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="loan-tracker-daily-${formatDateLocal(new Date())}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
