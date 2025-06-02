import { NextResponse } from "next/server";
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

    const { telegramSession, phoneNumber, telegramUserId } =
      await request.json();

    if (!telegramSession || !telegramUserId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "اطلاعات ناقص است. سشن تلگرام و شناسه کاربری تلگرام الزامی است.",
        },
        { status: 400 }
      );
    }

    const db = await openDb();

    // بررسی اینکه آیا شناسه تلگرام قبلاً به کاربر دیگری متصل شده است
    const existingUserWithTelegramId = await db.get(
      "SELECT id FROM users WHERE telegram_user_id = ? AND id != ?",
      [telegramUserId, decoded.userId]
    );

    if (existingUserWithTelegramId) {
      return NextResponse.json(
        {
          success: false,
          error: "این حساب تلگرام قبلاً به حساب دیگری در سایت متصل شده است.",
        },
        { status: 409 } // Conflict
      );
    }

    // Update user's Telegram session
    await db.run(
      "UPDATE users SET telegram_session = ?, phone_number = ?, telegram_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [telegramSession, phoneNumber || null, telegramUserId, decoded.userId]
    );

    // Get updated user data
    const updatedUser = await db.get(
      "SELECT id, name, email, telegram_session, phone_number, telegram_user_id, is_admin FROM users WHERE id = ?",
      [decoded.userId]
    );

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد" },
        { status: 404 }
      );
    }

    // Update local storage with new user data
    const userData = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      telegramSession: updatedUser.telegram_session,
      phoneNumber: updatedUser.phone_number,
      telegram_user_id: updatedUser.telegram_user_id, // ارسال شناسه تلگرام در پاسخ
      is_admin: Boolean(updatedUser.is_admin),
    };

    return NextResponse.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error("Update Telegram session error:", error);
    if (
      error.message &&
      error.message.includes("UNIQUE constraint failed: users.telegram_user_id")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "این حساب تلگرام قبلاً به حساب دیگری در سایت متصل شده است یا خطای یکتایی رخ داده است.",
        },
        { status: 409 }
      );
    }
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
      "UPDATE users SET telegram_session = NULL, phone_number = NULL, telegram_user_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?", // telegram_user_id نیز NULL می‌شود
      [decoded.userId]
    );

    // Get updated user data
    const updatedUser = await db.get(
      "SELECT id, name, email, telegram_session, phone_number, telegram_user_id, is_admin FROM users WHERE id = ?",
      [decoded.userId]
    );

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
      telegramSession: null,
      phoneNumber: null,
      telegram_user_id: null,
      is_admin: Boolean(updatedUser.is_admin),
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
