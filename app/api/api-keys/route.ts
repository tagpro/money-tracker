import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apikey } from '@/lib/db/schema/auth';
import { desc, eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth/auth';

// GET all API keys for the current user (hides the actual key)
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await db
      .select({
        id: apikey.id,
        name: apikey.name,
        prefix: apikey.prefix,
        createdAt: apikey.createdAt,
        expiresAt: apikey.expiresAt,
        enabled: apikey.enabled,
      })
      .from(apikey)
      .where(eq(apikey.referenceId, session.user.id))
      .orderBy(desc(apikey.createdAt));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

// Create a new API key
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { name?: string } = {};
    try {
      body = await request.json();
    } catch (e) {
      // Empty body is fine, we use default values
    }
    const { name } = body;

    // Use better-auth to generate the key correctly
    const key = await auth.api.createApiKey({
      headers: request.headers,
      body: {
        name: name || "Generated API Key",
        userId: session.user.id
      }
    });

    // The key.key contains the plain text token, send it ONCE
    return NextResponse.json({ 
      id: key.id,
      name: key.name,
      key: key.key,
      createdAt: key.createdAt,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}

// Delete an API key
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing API Key ID' }, { status: 400 });
    }

    await db.delete(apikey).where(
      and(
        eq(apikey.id, id),
        eq(apikey.referenceId, session.user.id)
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}

