import { createClient } from '@libsql/client';

export const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export async function initDatabase() {
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

  // Create interest_rates table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS interest_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rate REAL NOT NULL,
      effective_date TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create balance_snapshots table for caching monthly balances
  await db.execute(`
    CREATE TABLE IF NOT EXISTS balance_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      balance REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create invite_codes table for user invitations
  await db.execute(`
    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      email TEXT,
      used_by TEXT,
      created_by TEXT,
      used_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT
    )
  `);

  console.log('Database initialized successfully');
}
