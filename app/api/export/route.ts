import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Transaction, InterestRate } from '@/lib/types';

function getCurrentRate(rates: InterestRate[], date: Date): number {
  let currentRate = 0;
  const sortedRates = [...rates].sort(
    (a, b) => new Date(a.effective_date).getTime() - new Date(b.effective_date).getTime()
  );
  
  for (const rate of sortedRates) {
    if (new Date(rate.effective_date) <= date) {
      currentRate = rate.rate;
    } else {
      break;
    }
  }
  return currentRate;
}

export async function GET() {
  try {
    const transactionsResult = await db.execute('SELECT * FROM transactions ORDER BY date ASC');
    const ratesResult = await db.execute('SELECT * FROM interest_rates ORDER BY effective_date ASC');

    const transactions = transactionsResult.rows as unknown as Transaction[];
    const interestRates = ratesResult.rows as unknown as InterestRate[];

    if (transactions.length === 0) {
      return new NextResponse('No data to export', { status: 404 });
    }

    // Calculate daily interest from first transaction date to today
    const startDate = new Date(transactions[0].date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    // Create CSV content with daily interest
    let csv = 'Date,Balance,Daily Interest Rate (%),Daily Interest Amount,Principal,Accrued Interest (Month),Transaction Type,Transaction Amount,Description\n';
    
    let balance = 0;
    let principal = 0;
    let accruedInterest = 0;
    let currentDate = new Date(startDate);
    let transactionIndex = 0;
    
    while (currentDate <= endDate) {
      const currentDateStr = currentDate.toISOString().split('T')[0];
      let transactionType = '';
      let transactionAmount = 0;
      let transactionDesc = '';
      
      // Process all transactions for this date
      while (
        transactionIndex < transactions.length &&
        new Date(transactions[transactionIndex].date).getTime() <= currentDate.getTime()
      ) {
        const transaction = transactions[transactionIndex];
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
          balance += transaction.amount;
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
        
        await db.execute({
          sql: 'INSERT INTO transactions (type, amount, date, description) VALUES (?, ?, ?, ?)',
          args: ['interest', accruedInterest, currentDateStr, `Interest compounded for ${monthName}`],
        });
        
        accruedInterest = 0;
      }
      
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
        'Content-Disposition': `attachment; filename="loan-tracker-daily-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}
