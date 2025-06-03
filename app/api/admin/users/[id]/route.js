// File: app/api/admin/users/[id]/route.js
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { openDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET function remains the same as provided in the uploaded files for user details
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
        { success: false, error: "Forbidden" }, // Changed from Unauthorized to Forbidden for clarity
        { status: 403 }
      );
    }

    const user = await db.get(
      `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone_number,
        u.telegram_session,
        u.is_admin,
        u.is_premium,
        u.premium_expiry_date,
        u.service_creation_count,
        u.created_at,
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
      SELECT *
      FROM forwarding_services
      WHERE user_id = ?
      ORDER BY created_at DESC
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

// New PUT function for admin to update premium status
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

    const { userIdToUpdate } = params; // This should be `params.id` based on folder structure `[id]`
    const { is_premium, premium_expiry_date } = await request.json();

    if (typeof is_premium !== "boolean" && premium_expiry_date === undefined) {
      return NextResponse.json(
        {
          success: false,
          error:
            "حداقل یکی از فیلدهای is_premium یا premium_expiry_date باید ارسال شود",
        },
        { status: 400 }
      );
    }

    let sql = "UPDATE users SET updated_at = CURRENT_TIMESTAMP";
    const queryParams = [];

    if (typeof is_premium === "boolean") {
      sql += ", is_premium = ?";
      queryParams.push(is_premium ? 1 : 0);
    }

    if (premium_expiry_date !== undefined) {
      // Allow setting to null
      sql += ", premium_expiry_date = ?";
      queryParams.push(
        premium_expiry_date ? new Date(premium_expiry_date).toISOString() : null
      );
    }

    sql += " WHERE id = ?";
    queryParams.push(params.id); // Use params.id which corresponds to [id]

    const result = await db.run(sql, ...queryParams);

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد یا تغییری اعمال نشد" },
        { status: 404 }
      );
    }

    // Optionally, fetch and return the updated user
    const updatedUser = await db.get(
      "SELECT id, name, email, is_admin, is_premium, premium_expiry_date FROM users WHERE id = ?",
      [params.id]
    );

    return NextResponse.json({
      success: true,
      message: "وضعیت پرمیوم کاربر با موفقیت به‌روزرسانی شد.",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Admin update user premium error:", error);
    return NextResponse.json(
      { success: false, error: "خطا در سرور هنگام به‌روزرسانی کاربر" },
      { status: 500 }
    );
  }
}
