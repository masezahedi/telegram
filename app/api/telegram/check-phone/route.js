import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth"; //
import { openDb } from "@/lib/db"; //
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyToken(token); //

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const phoneNumber = searchParams.get("phoneNumber");
    const currentUserId = decoded.userId; // User ID from verified token

    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    const db = await openDb(); //
    // Check if the phone number is used by *another* user
    const existingUser = await db.get(
      "SELECT id FROM users WHERE phone_number = ? AND id != ?",
      [phoneNumber, currentUserId]
    );

    if (existingUser) {
      return NextResponse.json({
        success: true,
        inUse: true,
        message: "این شماره تلفن قبلاً توسط کاربر دیگری ثبت شده است.",
      });
    }

    return NextResponse.json({ success: true, inUse: false });
  } catch (error) {
    console.error("Check phone number error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
