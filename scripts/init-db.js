const { createClient } = require('@libsql/client');

async function initializeDatabase() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    console.log('Initializing database...');

    // Create transactions table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('deposit', 'withdrawal', 'interest')),
        amount REAL NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Transactions table created');

    // Create interest_rates table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS interest_rates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rate REAL NOT NULL,
        effective_date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Interest rates table created');

    // Create balance_snapshots table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS balance_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL UNIQUE,
        balance REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ Balance snapshots table created');

    console.log('\n✅ Database initialized successfully!');
    
    // Insert sample data
    const shouldAddSample = process.argv.includes('--sample');
    if (shouldAddSample) {
      console.log('\nAdding sample data...');
      
      await db.execute({
        sql: 'INSERT INTO interest_rates (rate, effective_date) VALUES (?, ?)',
        args: [5.5, '2024-01-01'],
      });
      
      await db.execute({
        sql: 'INSERT INTO transactions (type, amount, date, description) VALUES (?, ?, ?, ?)',
        args: ['deposit', 1000, '2024-01-01', 'Initial loan amount'],
      });
      
      console.log('✓ Sample data added');
    }
    
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

initializeDatabase();
