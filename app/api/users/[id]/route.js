import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { openDb } from '@/lib/db';
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
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
    
    // Check if user is admin
    const adminCheck = await db.get(
      'SELECT is_admin FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!adminCheck?.is_admin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user details
    const user = await db.get(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.telegram_session,
        u.is_admin,
        u.created_at,
        us.gemini_api_key
      FROM users u
      LEFT JOIN user_settings us ON u.id = us.user_id
      WHERE u.id = ?
    `, [params.id]);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Get user's services
    const services = await db.all(`
      SELECT *
      FROM forwarding_services
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, [params.id]);

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        services
      }
    });
  } catch (error) {
    console.error('Get user details error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}