import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inviteCodes } from '@/lib/db/schema/app';
import { eq, isNull, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const { code, email } = await request.json();

    if (!code || !email) {
      return NextResponse.json({ error: 'Missing code or email' }, { status: 400 });
    }

    // Mark invite as used
    await db.update(inviteCodes)
      .set({ 
        usedBy: email, 
        usedAt: new Date().toISOString() 
      })
      .where(and(
        eq(inviteCodes.code, code),
        isNull(inviteCodes.usedBy)
      ));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error marking invite as used:', error);
    return NextResponse.json({ error: 'Failed to mark invite as used' }, { status: 500 });
  }
}
