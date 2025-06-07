import { NextResponse } from "next/server";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { openDb } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
const BOT_TOKEN = process.env.BOT_TOKEN;

async function verifyTelegramAuth(initData) {
  if (!BOT_TOKEN) {
    console.error("BOT_TOKEN is not defined in environment variables.");
    throw new Error("Bot token is not configured on the server.");
  }
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  urlParams.delete("hash");
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(BOT_TOKEN)
    .digest();
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return computedHash === hash;
}

export async function POST(request) {
  try {
    const { initData } = await request.json();

    if (!initData) {
      return NextResponse.json(
        { error: "initData is required" },
        { status: 400 }
      );
    }

    const isValid = await verifyTelegramAuth(initData);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid data from Telegram" },
        { status: 403 }
      );
    }

    const urlParams = new URLSearchParams(initData);
    const userObject = JSON.parse(urlParams.get("user"));

    if (!userObject || !userObject.id) {
      return NextResponse.json({ error: "Invalid user data" }, { status: 400 });
    }

    const db = await openDb();

    let user = await db.get("SELECT * FROM users WHERE telegram_id = ?", [
      userObject.id,
    ]);

    if (!user) {
      const newUserId = Date.now().toString();
      const name = `${userObject.first_name || ""} ${
        userObject.last_name || ""
      }`.trim();

      await db.run(
        "INSERT INTO users (id, name, telegram_id, email, password) VALUES (?, ?, ?, ?, ?)",
        [
          newUserId,
          name || userObject.username || "کاربر تلگرام",
          userObject.id,
          null,
          null,
        ]
      );
      user = await db.get("SELECT * FROM users WHERE id = ?", [newUserId]);
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    const tariffSettings = await db.get(
      "SELECT * FROM tariff_settings LIMIT 1"
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        telegram_id: user.telegram_id,
        has_password: !!user.password,
        telegram_session: user.telegram_session,
        is_admin: Boolean(user.is_admin),
        is_premium: Boolean(user.is_premium),
        premium_expiry_date: user.premium_expiry_date,
        trial_activated_at: user.trial_activated_at,
        tariffSettings: tariffSettings,
      },
    });
  } catch (error) {
    console.error("Telegram auth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
