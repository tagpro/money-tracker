import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth/auth';
import crypto from 'crypto';

// Generate a new invite code (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin (first user or has admin role)
    const usersResult = await db.execute('SELECT COUNT(*) as count FROM user');
    const userCount = (usersResult.rows[0] as any).count;
    
    // First user is always admin, or check if user email is in ADMIN_EMAILS env
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
    const isAdmin = userCount === 1 || adminEmails.includes(session.user.email);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can create invite codes' }, { status: 403 });
    }

    const body = await request.json();
    const { email, expiresInDays = 7 } = body;

    // Generate unique invite code
    const code = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await db.execute({
      sql: 'INSERT INTO invite_codes (code, email, created_by, expires_at) VALUES (?, ?, ?, ?)',
      args: [code, email || null, session.user.email, expiresAt.toISOString()],
    });

    return NextResponse.json({ 
      code,
      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/signup?invite=${code}`,
      expiresAt: expiresAt.toISOString()
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating invite:', error);
    return NextResponse.json({ error: 'Failed to create invite code' }, { status: 500 });
  }
}

// Get all invite codes (admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const usersResult = await db.execute('SELECT COUNT(*) as count FROM user');
    const userCount = (usersResult.rows[0] as any).count;
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
    const isAdmin = userCount === 1 || adminEmails.includes(session.user.email);

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only admins can view invite codes' }, { status: 403 });
    }

    const result = await db.execute('SELECT * FROM invite_codes ORDER BY created_at DESC');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching invites:', error);
    return NextResponse.json({ error: 'Failed to fetch invite codes' }, { status: 500 });
  }
}
