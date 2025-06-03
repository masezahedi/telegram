// File: app/api/admin/users/[id]/route.js
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { openDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET function remains the same
export async function GET(request, { params }) {
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

    const adminCheck = await db.get("SELECT is_admin FROM users WHERE id = ?", [
      decoded.userId,
    ]);

    if (!adminCheck?.is_admin) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const user = await db.get(
      `
      SELECT 
        u.id, u.name, u.email, u.phone_number, u.telegram_session,
        u.is_admin, u.is_premium, u.premium_expiry_date, 
        u.trial_activated_at, u.service_creation_count, u.created_at,
        us.gemini_api_key
      FROM users u
      LEFT JOIN user_settings us ON u.id = us.user_id
      WHERE u.id = ?
    `,
      [params.id]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const services = await db.all(
      `
      SELECT * FROM forwarding_services WHERE user_id = ? ORDER BY created_at DESC
    `,
      [params.id]
    );

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        is_admin: Boolean(user.is_admin),
        is_premium: Boolean(user.is_premium),
        services: services.map((s) => ({
          ...s,
          source_channels: JSON.parse(s.source_channels || "[]"),
          target_channels: JSON.parse(s.target_channels || "[]"),
          search_replace_rules: JSON.parse(s.search_replace_rules || "[]"),
        })),
      },
    });
  } catch (error) {
    console.error("Get user details error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    const decodedAdmin = await verifyToken(token);

    if (!decodedAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const db = await openDb();
    const adminCheck = await db.get("SELECT is_admin FROM users WHERE id = ?", [
      decodedAdmin.userId,
    ]);

    if (!adminCheck?.is_admin) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    const { id: userIdToUpdate } = params; // Correctly get userIdToUpdate from params
    const payload = await request.json();

    // Check if at least one valid field is provided for update
    const validFields = [
      "is_premium",
      "premium_expiry_date",
      "trial_activated_at",
    ];
    const providedFields = Object.keys(payload).filter((key) =>
      validFields.includes(key)
    );

    if (providedFields.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "هیچ فیلد معتبری برای به‌روزرسانی ارسال نشده است.",
        },
        { status: 400 }
      );
    }

    let sql = "UPDATE users SET updated_at = CURRENT_TIMESTAMP";
    const queryParams = [];

    if (
      payload.hasOwnProperty("is_premium") &&
      typeof payload.is_premium === "boolean"
    ) {
      sql += ", is_premium = ?";
      queryParams.push(payload.is_premium ? 1 : 0);
    }

    if (payload.hasOwnProperty("premium_expiry_date")) {
      // Allows setting to null
      sql += ", premium_expiry_date = ?";
      queryParams.push(
        payload.premium_expiry_date
          ? new Date(payload.premium_expiry_date).toISOString()
          : null
      );
    }

    if (payload.hasOwnProperty("trial_activated_at")) {
      // Allows setting to null
      sql += ", trial_activated_at = ?";
      queryParams.push(
        payload.trial_activated_at
          ? new Date(payload.trial_activated_at).toISOString()
          : null
      );
    }

    sql += " WHERE id = ?";
    queryParams.push(userIdToUpdate);

    if (queryParams.length === 1) {
      // Only userId was added, means no valid fields to update
      return NextResponse.json(
        {
          success: false,
          error: "فیلدهای ارسالی برای به‌روزرسانی معتبر نیستند.",
        },
        { status: 400 }
      );
    }

    const result = await db.run(sql, ...queryParams);

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد یا تغییری اعمال نشد" },
        { status: 404 }
      );
    }

    const updatedUser = await db.get(
      "SELECT id, name, email, is_admin, is_premium, premium_expiry_date, trial_activated_at FROM users WHERE id = ?",
      [userIdToUpdate]
    );

    return NextResponse.json({
      success: true,
      message: "اطلاعات کاربر با موفقیت به‌روزرسانی شد.",
      user: {
        ...updatedUser,
        is_admin: Boolean(updatedUser.is_admin),
        is_premium: Boolean(updatedUser.is_premium),
      },
    });
  } catch (error) {
    console.error("Admin update user error:", error); // Changed error message
    return NextResponse.json(
      { success: false, error: "خطا در سرور هنگام به‌روزرسانی اطلاعات کاربر." }, // Changed error message
      { status: 500 }
    );
  }
}
