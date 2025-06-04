import { NextResponse } from  "next/server";
import { openDb } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Changed telegramSession to telegram_session to match frontend
    const { telegram_session, phoneNumber } = await request.json();

    if (!telegram_session) { // Check for telegram_session instead of telegramSession
      return NextResponse.json(
        { success: false, error: "اطلاعات ناقص است" },
        { status: 400 }
      );
    }

    const db = await openDb();

    // Update user's Telegram session
    await db.run(
      "UPDATE users SET telegram_session = ?, phone_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [telegram_session, phoneNumber || null, decoded.userId]
    );

    // Get updated user data
    const updatedUser = await db.get("SELECT * FROM users WHERE id = ?", [
      decoded.userId,
    ]);

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد" },
        { status: 404 }
      );
    }

    // Return updated user data (ensure consistent casing for frontend usage)
    const userData = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      telegram_session: updatedUser.telegram_session, // Keep consistent snake_case
      phoneNumber: updatedUser.phone_number,
    };

    return NextResponse.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error("Update Telegram session error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "خطا در بروزرسانی اطلاعات. لطفاً دوباره تلاش کنید.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
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

    // Remove user's Telegram session
    await db.run(
      "UPDATE users SET telegram_session = NULL, phone_number = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [decoded.userId]
    );

    // Get updated user data
    const updatedUser = await db.get("SELECT * FROM users WHERE id = ?", [
      decoded.userId,
    ]);

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد" },
        { status: 404 }
      );
    }

    // Return updated user data
    const userData = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      telegram_session: null, // Keep consistent snake_case
      phoneNumber: null,
    };

    return NextResponse.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error("Disconnect Telegram error:", error);
    return NextResponse.json(
      { success: false, error: "خطا در قطع اتصال. لطفاً دوباره تلاش کنید." },
      { status: 500 }
    );
  }
}