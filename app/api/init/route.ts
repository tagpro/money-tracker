import { NextResponse } from 'next/server';

/**
 * @deprecated This endpoint is deprecated. 
 * Use Drizzle migrations instead:
 * 
 * Run: cat drizzle/0000_consolidated_all_tables.sql | turso db shell <db-name>
 * 
 * Or apply all migrations: npm run db:push
 */
export async function GET() {
  return NextResponse.json({ 
    error: 'This endpoint is deprecated. Use Drizzle migrations instead.',
    instructions: 'Run: cat drizzle/0000_consolidated_all_tables.sql | turso db shell <db-name>'
  }, { status: 410 }); // 410 Gone
}

