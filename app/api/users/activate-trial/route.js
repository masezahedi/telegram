// app/api/users/activate-trial/route.js
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { openDb } from "@/lib/db";

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

    const db = await openDb();
    const user = await db.get(
      "SELECT id, is_admin, is_premium, trial_activated_at FROM users WHERE id = ?",
      [decoded.userId]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد." },
        { status: 404 }
      );
    }

    // Admins and premium users don't need to activate trial
    if (user.is_admin || user.is_premium) {
      return NextResponse.json(
        { success: false, error: "این قابلیت برای حساب کاربری شما قابل استفاده نیست." },
        { status: 400 }
      );
    }

    // Check if trial is already activated
    if (user.trial_activated_at) {
      return NextResponse.json(
        { success: false, error: "دوره آزمایشی قبلاً برای حساب شما فعال شده است." },
        { status: 400 }
      );
    }

    // Fetch tariff settings to get trial duration
    const tariffSettings = await db.get("SELECT * FROM tariff_settings LIMIT 1");
    const normalUserTrialDays = tariffSettings?.normal_user_trial_days ?? 15;

    const trialStart = new Date();
    const trialEnd = new Date(trialStart);
    trialEnd.setDate(trialStart.getDate() + normalUserTrialDays);

    await db.run(
      "UPDATE users SET trial_activated_at = ?, premium_expiry_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [trialStart.toISOString(), trialEnd.toISOString(), decoded.userId]
    );

    console.log(
      `Normal user ${decoded.userId} trial activated via button. Expires: ${trialEnd.toISOString()}`
    );

    // Re-fetch user data to send updated status to client
    const updatedUser = await db.get(
      `SELECT id, name, email, telegram_session, phone_number, is_admin, 
              is_premium, premium_expiry_date, trial_activated_at, service_creation_count
       FROM users WHERE id = ?`,
      [decoded.userId]
    );
    const updatedTariffSettings = await db.get("SELECT * FROM tariff_settings LIMIT 1");


    return NextResponse.json({
      success: true,
      message: `مهلت ${normalUserTrialDays} روزه آزمایشی شما فعال شد!`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        telegramSession: updatedUser.telegram_session,
        phoneNumber: updatedUser.phone_number,
        isAdmin: Boolean(updatedUser.is_admin),
        isPremium: Boolean(updatedUser.is_premium),
        premiumExpiryDate: updatedUser.premium_expiry_date,
        trialActivatedAt: updatedUser.trial_activated_at,
        serviceCreationCount: updatedUser.service_creation_count,
        isTelegramConnected: Boolean(updatedUser.telegram_session),
        tariffSettings: {
          normalUserTrialDays: updatedTariffSettings?.normal_user_trial_days ?? 15,
          premiumUserDefaultDays: updatedTariffSettings?.premium_user_default_days ?? 30,
          normalUserMaxActiveServices: updatedTariffSettings?.normal_user_max_active_services ?? 1,
          premiumUserMaxActiveServices: updatedTariffSettings?.premium_user_max_active_services ?? 5,
          normalUserMaxChannelsPerService: updatedTariffSettings?.normal_user_max_channels_per_service ?? 1,
          premiumUserMaxChannelsPerService: updatedTariffSettings?.premium_user_max_channels_per_channels ?? 10,
        },
      },
    });
  } catch (error) {
    console.error("Activate trial API error:", error);
    return NextResponse.json(
      { success: false, error: "خطا در فعال‌سازی دوره آزمایشی. لطفاً دوباره تلاش کنید." },
      { status: 500 }
    );
  }
}