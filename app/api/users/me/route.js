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
    const user = await db.get(
      `SELECT id, name, email, telegram_session, phone_number, telegram_user_id, is_admin
       FROM users WHERE id = ?`, // telegram_user_id اضافه شده
      [decoded.userId]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        telegramSession: user.telegram_session,
        phoneNumber: user.phone_number,
        telegramUserId: user.telegram_user_id, // نام فیلد در پاسخ به telegramUserId تغییر یافت
        isAdmin: Boolean(user.is_admin),
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
