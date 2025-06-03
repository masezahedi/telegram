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
      `SELECT id, name, email, telegram_session, phone_number, is_admin, 
              is_premium, premium_expiry_date, trial_activated_at, service_creation_count
       FROM users WHERE id = ?`,
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
        isAdmin: Boolean(user.is_admin),
        isPremium: Boolean(user.is_premium),
        premiumExpiryDate: user.premium_expiry_date, // Represents overall account expiry
        trialActivatedAt: user.trial_activated_at, // New
        serviceCreationCount: user.service_creation_count,
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
