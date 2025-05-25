import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    const decoded = await verifyToken(token);
    
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
  }
}