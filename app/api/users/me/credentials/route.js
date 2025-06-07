import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verifyToken } from "@/lib/auth";
import { openDb } from "@/lib/db";

export async function PUT(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { email, newPassword } = await request.json();
    const db = await openDb();

    const currentUser = await db.get("SELECT * FROM users WHERE id = ?", [
      decoded.userId,
    ]);
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    // Update email if provided and not already set
    if (email && !currentUser.email) {
      const existingUser = await db.get(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [email, decoded.userId]
      );
      if (existingUser) {
        return NextResponse.json(
          { success: false, error: "این ایمیل قبلاً ثبت شده است" },
          { status: 400 }
        );
      }
      await db.run(
        "UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [email, decoded.userId]
      );
    }

    // Set password if provided and not already set
    if (newPassword && !currentUser.password) {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await db.run(
        "UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [hashedPassword, decoded.userId]
      );
    }

    return NextResponse.json({
      success: true,
      message: "اطلاعات با موفقیت ذخیره شد.",
    });
  } catch (error) {
    console.error("Update credentials error:", error);
    return NextResponse.json(
      { success: false, error: "خطا در سرور" },
      { status: 500 }
    );
  }
}
