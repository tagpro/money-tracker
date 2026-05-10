import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './db/schema';

// This import ensures that the migrator is included in the Next.js standalone output
// so that it can be used by the migration script during deployment.
import 'drizzle-orm/libsql/migrator';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:local.db',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export const rawClient = client; // For raw SQL queries if needed

