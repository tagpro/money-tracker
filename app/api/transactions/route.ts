import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { transactions } from '@/lib/db/schema/app';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  try {
    const result = await db.select().from(transactions).orderBy(desc(transactions.date), desc(transactions.id));
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, amount, date, description } = body;

    if (!type || !amount || !date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await db.insert(transactions).values({
      type,
      amount,
      date,
      description: description || null,
    });

    return NextResponse.json({ id: Number(result.lastInsertRowid), ...body }, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing transaction ID' }, { status: 400 });
    }

    await db.delete(transactions).where(eq(transactions.id, Number(id)));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}

