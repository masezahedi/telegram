import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { openDb } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "لطفاً ایمیل و رمز عبور را وارد کنید" },
        { status: 400 }
      );
    }

    const db = await openDb().catch((err) => {
      console.error("Database connection error:", err);
      throw new Error("Database connection failed");
    });

    const user = await db
      .get("SELECT * FROM users WHERE email = ?", [email])
      .catch((err) => {
        console.error("Database query error:", err);
        throw new Error("Database query failed");
      });

    if (!user) {
      return NextResponse.json(
        { error: "ایمیل یا رمز عبور اشتباه است" },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "ایمیل یا رمز عبور اشتباه است" },
        { status: 401 }
      );
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    // Fetch tariff settings here as well, to include in the user object
    const tariffSettings = await db.get("SELECT * FROM tariff_settings LIMIT 1");

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        telegram_session: user.telegram_session, // Consistent casing
        phoneNumber: user.phone_number,
        is_admin: Boolean(user.is_admin),
        is_premium: Boolean(user.is_premium),
        premium_expiry_date: user.premium_expiry_date,
        trial_activated_at: user.trial_activated_at,
        service_creation_count: user.service_creation_count,
        // Include tariff settings
        tariffSettings: {
          normalUserTrialDays: tariffSettings?.normal_user_trial_days ?? 15,
          premiumUserDefaultDays: tariffSettings?.premium_user_default_days ?? 30,
          normalUserMaxActiveServices: tariffSettings?.normal_user_max_active_services ?? 1,
          premiumUserMaxActiveServices: tariffSettings?.premium_user_max_active_services ?? 5,
          normalUserMaxChannelsPerService: tariffSettings?.normal_user_max_channels_per_service ?? 1,
          premiumUserMaxChannelsPerService: tariffSettings?.premium_user_max_channels_per_channel ?? 10, // Corrected typo
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "خطا در ورود. لطفاً دوباره تلاش کنید." },
      { status: 500 }
    );
  }
}