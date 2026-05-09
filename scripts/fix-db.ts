
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { transactions as transactionsTable, interestRates as interestRatesTable } from '../lib/db/schema/app';
import { asc, eq } from 'drizzle-orm';
import { simulateInterestLedger } from '../lib/interest';
import { Transaction, InterestRate } from '../lib/types';
import * as fs from 'fs';

async function fix() {
  const dbFile = 'money-tracker.db';
  
  if (!fs.existsSync(dbFile)) {
    console.error(`Error: ${dbFile} not found in the current directory.`);
    process.exit(1);
  }

  // 1. Backup
  const backupFile = `${dbFile}.backup.${Date.now()}`;
  fs.copyFileSync(dbFile, backupFile);
  console.log(`✓ Backed up ${dbFile} to ${backupFile}`);

  const client = createClient({
    url: `file:${dbFile}`,
  });
  const db = drizzle(client);

  try {
    console.log('Fetching data...');
    const transactionsData = await db.select().from(transactionsTable).orderBy(asc(transactionsTable.date));
    const ratesData = await db.select().from(interestRatesTable).orderBy(asc(interestRatesTable.effectiveDate));

    const transactions: Transaction[] = transactionsData.map(t => ({
      id: t.id,
      type: t.type as 'deposit' | 'withdrawal' | 'interest',
      amount: t.amount,
      date: t.date,
      description: t.description || undefined,
    }));

    const interestRates: InterestRate[] = ratesData
      .filter(r => r.effectiveDate)
      .map(r => ({
        id: r.id,
        rate: r.rate,
        effective_date: r.effectiveDate,
      }));

    const nonInterestTx = transactions.filter(t => t.type !== 'interest');
    
    console.log('Calculating correct interest postings...');
    const { postings: expected } = simulateInterestLedger(
      nonInterestTx,
      interestRates,
      new Date(),
      false,
    );

    console.log(`Cleaning up ${transactions.filter(t => t.type === 'interest').length} old interest entries...`);
    await db.delete(transactionsTable).where(eq(transactionsTable.type, 'interest'));

    console.log(`Inserting ${expected.length} correct interest entries...`);
    for (const exp of expected) {
      await db.insert(transactionsTable).values({
        type: 'interest',
        amount: exp.amount,
        date: exp.date,
        description: exp.description,
      });
    }

    console.log('\n✅ Database fixed successfully!');
    console.log(`   Processed ${expected.length} interest transactions.`);
    
  } catch (error) {
    console.error('Error fixing database:', error);
  } finally {
    client.close();
  }
}

fix();
