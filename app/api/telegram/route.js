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

    const { telegramSession, phoneNumber } = await request.json();

    if (!telegramSession) {
      return NextResponse.json(
        { success: false, error: "اطلاعات ناقص است" },
        { status: 400 }
      );
    }

    const db = await openDb();

    // Update user's Telegram session
    await db.run(
      "UPDATE users SET telegram_session = ?, phone_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [telegramSession, phoneNumber || null, decoded.userId]
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

    // Update local storage with new user data
    const userData = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      telegramSession: updatedUser.telegram_session,
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
      telegramSession: null,
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
