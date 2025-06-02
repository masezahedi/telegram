import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { openDb } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const db = await openDb();

    // Check if user is admin
    const adminCheck = await db.get("SELECT is_admin FROM users WHERE id = ?", [
      decoded.userId,
    ]);

    if (!adminCheck?.is_admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all users
    const users = await db.all(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.telegram_session IS NOT NULL as has_telegram,
        u.is_admin,
        u.created_at
      FROM users u
      ORDER BY u.created_at DESC
    `);

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
