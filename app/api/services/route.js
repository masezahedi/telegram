import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { openDb } from "@/lib/db";
import {
  stopService,
  startUserServices,
} from "@/server/services/telegram/service-manager";

export const dynamic = "force-dynamic";

// GET function remains the same as in Phase 3 (New)
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
    const servicesFromDb = await db.all(
      // Renamed to avoid conflict
      "SELECT * FROM forwarding_services WHERE user_id = ? ORDER BY created_at DESC",
      [decoded.userId]
    );

    return NextResponse.json({
      success: true,
      services: servicesFromDb.map((service) => ({
        // Use servicesFromDb
        ...service,
        source_channels: JSON.parse(service.source_channels || "[]"),
        target_channels: JSON.parse(service.target_channels || "[]"),
        search_replace_rules: JSON.parse(service.search_replace_rules || "[]"),
        is_active: Boolean(service.is_active),
        useAI: Boolean(service.prompt_template),
        type: service.type || "forward",
        copy_history: Boolean(service.copy_history),
        history_limit: service.history_limit ?? 100,
        history_direction: service.history_direction ?? "newest",
        start_from_id: service.start_from_id,
        copy_direction: service.copy_direction ?? "before",
        // service_activated_at will be included here automatically if present in DB
      })),
    });
  } catch (error) {
    console.error("Get services error:", error);
    return NextResponse.json(
      { success: false, error: "خطا در دریافت سرویس‌ها" },
      { status: 500 }
    );
  }
}

// POST function remains the same as in Phase 3 (New)
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

    const {
      name,
      type = "forward",
      sourceChannels,
      targetChannels,
      searchReplaceRules = [],
      useAI,
      promptTemplate,
      copyHistory = false,
      historyLimit = 100,
      historyDirection = "newest",
      startFromId = null,
      copyDirection = "before",
    } = await request.json();

    if (!name || !sourceChannels?.length || !targetChannels?.length) {
      return NextResponse.json(
        { success: false, error: "اطلاعات ناقص است" },
        { status: 400 }
      );
    }

    const db = await openDb();
    const user = await db.get(
      "SELECT id, is_admin, is_premium, premium_expiry_date, service_creation_count FROM users WHERE id = ?",
      [decoded.userId]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد" },
        { status: 404 }
      );
    }

    const now = new Date();

    if (!user.is_admin) {
      if (
        user.is_premium &&
        user.premium_expiry_date &&
        new Date(user.premium_expiry_date) > now
      ) {
        // Premium User Logic: No specific creation limits other than active count (handled in PUT)
      } else {
        // Normal User Logic
        if (
          sourceChannels.filter(Boolean).length > 1 ||
          targetChannels.filter(Boolean).length > 1
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "کاربران عادی فقط می‌توانند یک کانال مبدأ و یک کانال مقصد تعریف کنند.",
            },
            { status: 403 }
          );
        }
      }
    }

    const serviceId = Date.now().toString();

    await db.run(
      `
  INSERT INTO forwarding_services (
    id,
    user_id,
    name,
    type,
    source_channels,
    target_channels,
    search_replace_rules,
    prompt_template,
    copy_history,
    history_limit,
    history_direction,
    start_from_id,
    copy_direction,
    created_at,
    updated_at,
    service_activated_at 
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL) 
`, // service_activated_at is NULL on creation
      [
        serviceId,
        decoded.userId,
        name,
        type,
        JSON.stringify(sourceChannels.filter(Boolean)),
        JSON.stringify(targetChannels.filter(Boolean)),
        JSON.stringify(searchReplaceRules),
        useAI ? promptTemplate : null,
        copyHistory ? 1 : 0,
        historyLimit,
        historyDirection,
        startFromId,
        copyDirection,
      ]
    );

    return NextResponse.json({ success: true, serviceId: serviceId });
  } catch (error) {
    console.error("Create service error:", error);
    return NextResponse.json(
      { success: false, error: "خطا در ایجاد سرویس" },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id, isActive } = await request.json(); // Service ID and new active state
    const db = await openDb();
    const user = await db.get(
      "SELECT id, is_admin, is_premium, premium_expiry_date FROM users WHERE id = ?",
      [decoded.userId]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد" },
        { status: 404 }
      );
    }

    const now = new Date();
    let serviceToUpdate = await db.get(
      "SELECT * FROM forwarding_services WHERE id = ? AND user_id = ?",
      [id, decoded.userId]
    );

    if (!serviceToUpdate) {
      return NextResponse.json(
        { success: false, error: "سرویس مورد نظر یافت نشد." },
        { status: 404 }
      );
    }

    // --- Start of Limit Checks for Activation ---
    if (isActive && !user.is_admin) {
      if (
        user.is_premium &&
        user.premium_expiry_date &&
        new Date(user.premium_expiry_date) > now
      ) {
        // Premium User Activation Logic
        const activeServicesCount = await db.get(
          "SELECT COUNT(*) as count FROM forwarding_services WHERE user_id = ? AND is_active = 1 AND id != ?",
          [decoded.userId, id]
        );
        if (activeServicesCount.count >= 5) {
          return NextResponse.json(
            {
              success: false,
              error:
                "کاربران پرمیوم حداکثر می‌توانند ۵ سرویس فعال داشته باشند.",
            },
            { status: 403 }
          );
        }
      } else {
        // Normal User Activation Logic
        const activeServicesCount = await db.get(
          "SELECT COUNT(*) as count FROM forwarding_services WHERE user_id = ? AND is_active = 1 AND id != ?",
          [decoded.userId, id]
        );
        if (activeServicesCount.count >= 1) {
          return NextResponse.json(
            {
              success: false,
              error: "کاربران عادی فقط می‌توانند یک سرویس فعال داشته باشند.",
            },
            { status: 403 }
          );
        }

        const sourceChannels = JSON.parse(serviceToUpdate.source_channels);
        const targetChannels = JSON.parse(serviceToUpdate.target_channels);
        if (
          sourceChannels.filter(Boolean).length > 1 ||
          targetChannels.filter(Boolean).length > 1
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "سرویس کاربران عادی فقط می‌تواند یک کانال مبدأ و یک کانال مقصد داشته باشد.",
            },
            { status: 403 }
          );
        }
      }
    }
    // --- End of Limit Checks for Activation ---

    let updateQuery = `
      UPDATE forwarding_services
      SET 
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP`;

    const queryParams = [isActive ? 1 : 0];

    // Set service_activated_at only on the first activation for a normal user
    if (
      isActive &&
      !user.is_admin &&
      !user.is_premium &&
      !serviceToUpdate.service_activated_at
    ) {
      updateQuery += `, service_activated_at = CURRENT_TIMESTAMP`;
    }

    // The old `activated_at` might still be useful for tracking last activation,
    // but for 15-day expiry, `service_activated_at` is key.
    // If you want `activated_at` to track the most recent activation:
    if (isActive) {
      updateQuery += `, activated_at = CURRENT_TIMESTAMP`;
    }

    updateQuery += ` WHERE id = ? AND user_id = ?`;
    queryParams.push(id, decoded.userId);

    await db.run(updateQuery, ...queryParams);

    try {
      if (isActive) {
        console.log(`🟢 Activating service ${id} for user ${decoded.userId}`);
        await startUserServices(decoded.userId);
      } else {
        console.log(`🔴 Deactivating service ${id} for user ${decoded.userId}`);
        await stopService(decoded.userId, id);
      }
    } catch (serviceError) {
      console.error("Service control error:", serviceError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update service status error:", error); // Changed error message for clarity
    return NextResponse.json(
      { success: false, error: "خطا در بروزرسانی وضعیت سرویس" },
      { status: 500 }
    );
  }
}

// DELETE function remains the same as in Phase 3 (New)
export async function DELETE(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await request.json();
    const db = await openDb();

    try {
      console.log(`🗑️ Stopping service ${id} before deletion`);
      await stopService(decoded.userId, id);
    } catch (serviceError) {
      console.error("Error stopping service before deletion:", serviceError);
    }

    await db.run(
      "DELETE FROM forwarding_services WHERE id = ? AND user_id = ?",
      [id, decoded.userId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete service error:", error);
    return NextResponse.json(
      { success: false, error: "خطا در حذف سرویس" },
      { status: 500 }
    );
  }
}
