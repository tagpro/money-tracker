import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { inviteCodes } from '@/lib/db/schema/app';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ valid: false, error: 'No invite code provided' }, { status: 400 });
    }

    const result = await db.select().from(inviteCodes).where(eq(inviteCodes.code, code));

    if (result.length === 0) {
      return NextResponse.json({ valid: false, error: 'Invalid invite code' }, { status: 404 });
    }

    const invite = result[0];

    // Check if already used
    if (invite.usedBy) {
      return NextResponse.json({ valid: false, error: 'Invite code already used' }, { status: 400 });
    }

    // Check if expired
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      return NextResponse.json({ valid: false, error: 'Invite code expired' }, { status: 400 });
    }

    return NextResponse.json({ 
      valid: true,
      email: invite.email 
    });
  } catch (error) {
    console.error('Error verifying invite:', error);
    return NextResponse.json({ valid: false, error: 'Failed to verify invite code' }, { status: 500 });
  }
}
