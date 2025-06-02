// app/api/telegram/route.js
import { NextResponse } from "next/server";
import { openDb } from "@/lib/db"; //
import { verifyToken } from "@/lib/auth"; //
export const dynamic = "force-dynamic"; //

export async function POST(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1]; //
    const decoded = await verifyToken(token); //
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ); //
    }

    const { telegramSession, phoneNumber, telegramId } = await request.json(); //

    if (!telegramSession || !telegramId) {
      return NextResponse.json(
        {
          success: false,
          error: "اطلاعات ناقص است. شناسه تلگرام و سشن الزامی است.",
        },
        { status: 400 }
      ); //
    }

    const db = await openDb(); //

    // Check if this telegram_id is already used by ANOTHER user
    const existingUserWithTelegramId = await db.get(
      "SELECT id, email FROM users WHERE telegram_id = ? AND id != ?",
      [telegramId, decoded.userId]
    ); //

    if (existingUserWithTelegramId) {
      return NextResponse.json(
        {
          success: false,
          error: `این حساب تلگرام قبلاً توسط کاربر دیگری (${existingUserWithTelegramId.email}) استفاده شده است.`,
        },
        { status: 409 } // 409 Conflict
      ); //
    }

    // Update user's Telegram session, phone number, and telegram_id
    await db.run(
      "UPDATE users SET telegram_session = ?, phone_number = ?, telegram_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [telegramSession, phoneNumber || null, telegramId, decoded.userId]
    ); //

    // Get updated user data
    const updatedUser = await db.get(
      "SELECT id, name, email, telegram_session, phone_number, telegram_id, is_admin FROM users WHERE id = ?",
      [decoded.userId]
    ); //

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد" },
        { status: 404 }
      ); //
    }

    // Update local storage with new user data
    const userData = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      telegramSession: updatedUser.telegram_session,
      phoneNumber: updatedUser.phone_number,
      telegramId: updatedUser.telegram_id, //
      isAdmin: Boolean(updatedUser.is_admin), //
    }; //

    return NextResponse.json({
      success: true,
      user: userData,
    }); //
  } catch (error) {
    console.error("Update Telegram session error:", error); //
    const token = request.headers.get("authorization")?.split(" ")[1]; // For debugging, to get userId if possible
    const decoded = await verifyToken(token);
    const { telegramId } = await request.json();

    if (
      error.message &&
      error.message.includes("UNIQUE constraint failed: users.telegram_id")
    ) {
      //
      if (decoded && decoded.userId && telegramId) {
        // Check if decoded and telegramId are available
        const db = await openDb(); //
        const currentUserTelegram = await db.get(
          "SELECT telegram_id FROM users WHERE id = ?",
          [decoded.userId]
        ); //

        if (
          currentUserTelegram &&
          currentUserTelegram.telegram_id === telegramId
        ) {
          const updatedUser = await db.get(
            "SELECT id, name, email, telegram_session, phone_number, telegram_id, is_admin FROM users WHERE id = ?",
            [decoded.userId]
          ); //
          const userData = {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            telegramSession: updatedUser.telegram_session,
            phoneNumber: updatedUser.phone_number,
            telegramId: updatedUser.telegram_id, //
            isAdmin: Boolean(updatedUser.is_admin), //
          }; //
          return NextResponse.json({
            success: true,
            user: userData,
            message: "این حساب تلگرام از قبل به این کاربر متصل است.",
          }); //
        }
      }
      return NextResponse.json(
        {
          success: false,
          error: "این حساب تلگرام قبلاً توسط کاربر دیگری ثبت شده است.",
        },
        { status: 409 }
      ); //
    }
    return NextResponse.json(
      {
        success: false,
        error: "خطا در بروزرسانی اطلاعات. لطفاً دوباره تلاش کنید.",
      },
      { status: 500 }
    ); //
  }
}

export async function DELETE(request) {
  //
  try {
    const token = request.headers.get("authorization")?.split(" ")[1]; //
    const decoded = await verifyToken(token); //
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ); //
    }

    const db = await openDb(); //

    // Remove user's Telegram session, phone_number and telegram_id
    await db.run(
      "UPDATE users SET telegram_session = NULL, phone_number = NULL, telegram_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [decoded.userId]
    ); //

    // Get updated user data
    const updatedUser = await db.get(
      "SELECT id, name, email, telegram_session, phone_number, telegram_id, is_admin FROM users WHERE id = ?",
      [decoded.userId]
    ); //

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد" },
        { status: 404 }
      ); //
    }

    // Return updated user data
    const userData = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      telegramSession: null, //
      phoneNumber: null, //
      telegramId: null, //
      isAdmin: Boolean(updatedUser.is_admin), //
    }; //

    return NextResponse.json({
      success: true,
      user: userData,
    }); //
  } catch (error) {
    console.error("Disconnect Telegram error:", error); //
    return NextResponse.json(
      { success: false, error: "خطا در قطع اتصال. لطفاً دوباره تلاش کنید." },
      { status: 500 }
    ); //
  }
}
