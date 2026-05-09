const { createClient } = require('@libsql/client');
const crypto = require('crypto');

async function createInvite() {
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL || 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    // Ensure invite_codes table exists
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

    const code = crypto.randomBytes(16).toString('hex');

    await db.execute({
      sql: 'INSERT INTO invite_codes (code, created_by) VALUES (?, ?)',
      args: [code, 'system-seed'],
    });

    console.log('\n✅ Invite code created successfully!\n');
    console.log(`   Code: ${code}`);
    console.log(`\n   Sign up at: /signup?invite=${code}\n`);
  } catch (error) {
    console.error('Error creating invite code:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

createInvite();
