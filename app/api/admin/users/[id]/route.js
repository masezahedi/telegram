// File: app/api/admin/users/[id]/route.js
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth"; //
import { openDb } from "@/lib/db"; //
import { startUserServices } from "@/server/services/telegram/service-manager"; // Import to restart services

export const dynamic = "force-dynamic";

// GET function remains the same
export async function GET(request, { params }) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1]; //
    const decoded = await verifyToken(token); //

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const db = await openDb(); //

    const adminCheck = await db.get("SELECT is_admin FROM users WHERE id = ?", [ //
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
    `, //
      [params.id]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد" },
        { status: 404 }
      );
    }

    const services = await db.all(
      `
      SELECT * FROM forwarding_services WHERE user_id = ? ORDER BY created_at DESC
    `, //
      [params.id]
    );

    return NextResponse.json({
      success: true, //
      user: {
        ...user, //
        is_admin: Boolean(user.is_admin), //
        is_premium: Boolean(user.is_premium), //
        services: services.map((s) => ({ //
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
    const token = request.headers.get("authorization")?.split(" ")[1]; //
    const decodedAdmin = await verifyToken(token); //

    if (!decodedAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const db = await openDb(); //
    const adminCheck = await db.get("SELECT is_admin FROM users WHERE id = ?", [ //
      decodedAdmin.userId,
    ]);

    if (!adminCheck?.is_admin) {
      return NextResponse.json(
        { success: false, error: "Forbidden. Admin access required." },
        { status: 403 }
      );
    }

    const { id: userIdToUpdate } = params;
    const payload = await request.json();

    const validFieldsToUpdate = [];
    const queryParams = [];

    // Allow changing is_premium
    if (
      payload.hasOwnProperty("is_premium") &&
      typeof payload.is_premium === "boolean"
    ) {
      validFieldsToUpdate.push("is_premium = ?");
      queryParams.push(payload.is_premium ? 1 : 0);
    }

    // Allow changing premium_expiry_date (main expiry date for both premium and trial)
    if (payload.hasOwnProperty("premium_expiry_date")) {
      validFieldsToUpdate.push("premium_expiry_date = ?");
      queryParams.push(
        payload.premium_expiry_date
          ? new Date(payload.premium_expiry_date).toISOString()
          : null
      );
    }

    // NEW LOGIC: If is_premium is set to false AND trial_activated_at exists,
    // ensure premium_expiry_date is set based on trial if not explicitly set.
    // However, for admin panel, we assume premium_expiry_date directly controls expiry.
    // If setting is_premium to false, trial_activated_at should probably be cleared too.
    if (payload.hasOwnProperty("is_premium") && payload.is_premium === false) {
      validFieldsToUpdate.push("trial_activated_at = ?");
      queryParams.push(null); // Clear trial_activated_at if user is no longer premium
    }


    if (validFieldsToUpdate.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "هیچ فیلد معتبری برای به‌روزرسانی ارسال نشده است یا مقادیر نامعتبر هستند.",
        },
        { status: 400 }
      );
    }

    const sqlSetStatements = validFieldsToUpdate.join(", ");
    const sql = `UPDATE users SET updated_at = CURRENT_TIMESTAMP, ${sqlSetStatements} WHERE id = ?`;
    queryParams.push(userIdToUpdate);

    const result = await db.run(sql, ...queryParams); //

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد یا تغییری اعمال نشد" },
        { status: 404 }
      );
    }

    // NEW LOGIC: After update, re-evaluate user services.
    // If the expiry date is now in the past, services should be stopped.
    // This is crucial for immediate effect of admin changes.
    const updatedUser = await db.get(
      "SELECT id, is_admin, is_premium, premium_expiry_date, trial_activated_at FROM users WHERE id = ?", //
      [userIdToUpdate]
    );

    const now = new Date();
    let shouldStopServices = false;
    if (!updatedUser.is_admin) {
        if (updatedUser.is_premium && updatedUser.premium_expiry_date && new Date(updatedUser.premium_expiry_date) < now) {
            shouldStopServices = true; // Premium expired
        } else if (!updatedUser.is_premium && updatedUser.trial_activated_at) {
            const tariffSettings = await db.get("SELECT normal_user_trial_days FROM tariff_settings LIMIT 1"); //
            const normalUserTrialDays = tariffSettings?.normal_user_trial_days ?? 15; //
            const trialExpiryDate = new Date(updatedUser.trial_activated_at);
            trialExpiryDate.setDate(trialExpiryDate.getDate() + normalUserTrialDays);
            if (now >= trialExpiryDate) {
                shouldStopServices = true; // Trial expired
            }
        } else if (!updatedUser.is_premium && !updatedUser.trial_activated_at) {
            shouldStopServices = true; // Neither premium nor trial active (e.g., admin removed premium and trial_activated_at)
        }
    }

    if (shouldStopServices) {
        console.log(`User ${userIdToUpdate} account now expired due to admin action. Stopping services.`);
        await startUserServices(userIdToUpdate); // This will handle stopping services if expired
    } else {
        console.log(`User ${userIdToUpdate} account status updated. Re-evaluating services.`);
        await startUserServices(userIdToUpdate); // Re-evaluate to potentially start services if activated
    }


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
    console.error("Admin update user error:", error); //
    return NextResponse.json(
      { success: false, error: "خطا در سرور هنگام به‌روزرسانی اطلاعات کاربر." },
      { status: 500 }
    );
  }
}