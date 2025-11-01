import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const result = await db.execute('SELECT * FROM interest_rates ORDER BY effective_date DESC');
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching interest rates:', error);
    return NextResponse.json({ error: 'Failed to fetch interest rates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rate, effective_date } = body;

    if (rate === undefined || !effective_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await db.execute({
      sql: 'INSERT INTO interest_rates (rate, effective_date) VALUES (?, ?)',
      args: [rate, effective_date],
    });

    return NextResponse.json({ id: Number(result.lastInsertRowid), ...body }, { status: 201 });
  } catch (error) {
    console.error('Error creating interest rate:', error);
    return NextResponse.json({ error: 'Failed to create interest rate' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing interest rate ID' }, { status: 400 });
    }

    await db.execute({
      sql: 'DELETE FROM interest_rates WHERE id = ?',
      args: [id],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting interest rate:', error);
    return NextResponse.json({ error: 'Failed to delete interest rate' }, { status: 500 });
  }
}
