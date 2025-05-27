import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { openDb } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    const decoded = await verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const db = await openDb();
    const settings = await db.get(
      'SELECT gemini_api_key FROM user_settings WHERE user_id = ?',
      [decoded.userId]
    );

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json(
      { success: false, error: 'خطا در دریافت تنظیمات' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    const decoded = await verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { geminiApiKey } = await request.json();
    const db = await openDb();

    // Validate API key
    try {
      // TODO: Add validation logic for Gemini API key
      // For now, we'll just check if it's not empty
      if (!geminiApiKey) {
        throw new Error('کلید API نامعتبر است');
      }
    } catch (error) {
      return NextResponse.json(
        { success: false, error: 'کلید API نامعتبر است' },
        { status: 400 }
      );
    }

    await db.run(`
      INSERT INTO user_settings (user_id, gemini_api_key, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        gemini_api_key = excluded.gemini_api_key,
        updated_at = CURRENT_TIMESTAMP
    `, [decoded.userId, geminiApiKey]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json(
      { success: false, error: 'خطا در بروزرسانی تنظیمات' },
      { status: 500 }
    );
  }
}