import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { code, email } = await request.json();

    if (!code || !email) {
      return NextResponse.json({ error: 'Missing code or email' }, { status: 400 });
    }

    // Mark invite as used
    await db.execute({
      sql: 'UPDATE invite_codes SET used_by = ?, used_at = ? WHERE code = ? AND used_by IS NULL',
      args: [email, new Date().toISOString(), code],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking invite as used:', error);
    return NextResponse.json({ error: 'Failed to mark invite as used' }, { status: 500 });
  }
}
