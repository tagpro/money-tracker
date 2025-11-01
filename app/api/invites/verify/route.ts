import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ valid: false, error: 'No invite code provided' }, { status: 400 });
    }

    const result = await db.execute({
      sql: 'SELECT * FROM invite_codes WHERE code = ?',
      args: [code],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ valid: false, error: 'Invalid invite code' }, { status: 404 });
    }

    const invite = result.rows[0] as any;

    // Check if already used
    if (invite.used_by) {
      return NextResponse.json({ valid: false, error: 'Invite code already used' }, { status: 400 });
    }

    // Check if expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
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
