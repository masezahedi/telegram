export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { openDb } from '@/lib/db';

export async function POST(request) {
  try {
    const { name, email, password } = await request.json();
    
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'لطفاً تمام فیلدها را پر کنید' },
        { status: 400 }
      );
    }
    
    const db = await openDb();
    
    // Check if user exists
    const existingUser = await db.get('SELECT email FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return NextResponse.json(
        { error: 'این ایمیل قبلاً ثبت شده است' },
        { status: 400 }
      );
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const result = await db.run(
      'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
      [Date.now().toString(), name, email, hashedPassword]
    );
    
    return NextResponse.json(
      { success: true, userId: result.lastID },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'خطا در ثبت نام. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    );
  }
}