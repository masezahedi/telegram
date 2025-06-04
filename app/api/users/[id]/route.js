// File: app/api/users/[id]/route.js
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth"; //
import { openDb } from "@/lib/db"; //
export const dynamic = "force-dynamic"; //

export async function GET(request, { params }) {
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

    // Check if user is admin
    const adminCheck = await db.get("SELECT is_admin FROM users WHERE id = ?", [ //
      decoded.userId,
    ]);

    if (!adminCheck?.is_admin) {
      //
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 }
      ); //
    }

    // Get user details
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
    `, //
      [params.id]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      ); //
    }

    // Get user's services
    const services = await db.all(
      `
      SELECT *
      FROM forwarding_services
      WHERE user_id = ?
      ORDER BY created_at DESC
    `, //
      [params.id]
    );

    return NextResponse.json({
      success: true, //
      user: {
        //
        ...user, //
        is_admin: Boolean(user.is_admin), // Ensure boolean
        is_premium: Boolean(user.is_premium), // Ensure boolean
        services: services.map((s) => ({ //
          ...s,
          source_channels: JSON.parse(s.source_channels || "[]"),
          target_channels: JSON.parse(s.target_channels || "[]"),
          search_replace_rules: JSON.parse(s.search_replace_rules || "[]"),
          is_active: Boolean(s.is_active), // Ensure boolean
          copy_history: Boolean(s.copy_history), // Ensure boolean
        })),
      },
    });
  } catch (error) {
    console.error("Get user details error:", error); //
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    ); //
  }
}