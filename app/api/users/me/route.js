// app/api/users/me/route.js
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

    // Fetch tariff settings for the user's dashboard logic
    const tariffSettings = await db.get("SELECT * FROM tariff_settings LIMIT 1");


    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        telegram_session: user.telegram_session, // Consistent casing
        phoneNumber: user.phone_number,
        isAdmin: Boolean(user.is_admin),
        isPremium: Boolean(user.is_premium),
        premiumExpiryDate: user.premium_expiry_date,
        trialActivatedAt: user.trial_activated_at,
        serviceCreationCount: user.service_creation_count,
        isTelegramConnected: Boolean(user.telegram_session),
        tariffSettings: {
          normalUserTrialDays: tariffSettings?.normal_user_trial_days ?? 15,
          premiumUserDefaultDays: tariffSettings?.premium_user_default_days ?? 30,
          normalUserMaxActiveServices: tariffSettings?.normal_user_max_active_services ?? 1,
          premiumUserMaxActiveServices: tariffSettings?.premium_user_max_active_services ?? 5,
          normalUserMaxChannelsPerService: tariffSettings?.normal_user_max_channels_per_service ?? 1,
          premiumUserMaxChannelsPerService: tariffSettings?.premium_user_max_channels_per_service ?? 10,
        },
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