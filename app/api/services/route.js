import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { openDb } from "@/lib/db";
import {
  stopService,
  startUserServices,
} from "@/server/services/telegram/service-manager";

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
    const services = await db.all(
      "SELECT * FROM forwarding_services WHERE user_id = ? ORDER BY created_at DESC",
      [decoded.userId]
    );

    return NextResponse.json({
      success: true,
      services: services.map((service) => ({
        ...service,
        source_channels: JSON.parse(service.source_channels),
        target_channels: JSON.parse(service.target_channels),
        search_replace_rules: JSON.parse(service.search_replace_rules),
        is_active: Boolean(service.is_active),
        useAI: Boolean(service.prompt_template),
        type: service.type || "forward",
        copy_history: Boolean(service.copy_history),
        history_limit: service.history_limit ?? 100,
        history_direction: service.history_direction ?? "newest",
        start_from_id: service.start_from_id,
        copy_direction: service.copy_direction ?? "before",
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

    // --- Start of Limit Checks ---
    if (!user.is_admin) {
      if (
        user.is_premium &&
        user.premium_expiry_date &&
        new Date(user.premium_expiry_date) > now
      ) {
        // Premium User Logic (Phase 3 - New)
        // Assuming new services are intended to be active or will be activated shortly.
        // We check if creating *and activating* this would exceed the limit.
        // A more precise check could be if the form has an "activate_on_create" flag.
        // For now, if they are at their limit of active services, they can still create an inactive one.
        // The activation (PUT) will strictly enforce the active limit.
        const activeServicesCount = await db.get(
          "SELECT COUNT(*) as count FROM forwarding_services WHERE user_id = ? AND is_active = 1",
          [decoded.userId]
        );
        // If they want to create this service and immediately activate it (hypothetically)
        // and they already have 5 active, then block.
        // This check is more relevant for activation, but we can prevent creation if they are already at max
        // and the intention is likely to activate this new one.
        // For now, let's allow creation even if at 5 active, activation will be blocked.
        // Premium users do not have restrictions on source/destination channel counts.
      } else {
        // Normal User Logic (Phase 2)
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
        // service_creation_count logic was removed as per user request
      }
    }
    // --- End of Limit Checks ---

    const serviceId = Date.now().toString();

    const result = await db.run(
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
    updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`,
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

    // service_creation_count increment logic was removed.

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

    const { id, isActive } = await request.json();
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

    // --- Start of Limit Checks for Activation ---
    if (isActive && !user.is_admin) {
      // Checks for both normal and premium users if they are not admin
      if (
        user.is_premium &&
        user.premium_expiry_date &&
        new Date(user.premium_expiry_date) > now
      ) {
        // Premium User Activation Logic (Phase 3 - New)
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
        // Premium users do not have source/destination count restrictions for activation
      } else {
        // Normal User Activation Logic (Phase 2)
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

        const serviceToActivate = await db.get(
          "SELECT source_channels, target_channels FROM forwarding_services WHERE id = ? AND user_id = ?",
          [id, decoded.userId]
        );
        if (serviceToActivate) {
          const sourceChannels = JSON.parse(serviceToActivate.source_channels);
          const targetChannels = JSON.parse(serviceToActivate.target_channels);
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
        } else {
          return NextResponse.json(
            {
              success: false,
              error: "سرویس مورد نظر برای فعال سازی یافت نشد.",
            },
            { status: 404 }
          );
        }
      }
    }
    // --- End of Limit Checks for Activation ---

    await db.run(
      `
      UPDATE forwarding_services
      SET 
        is_active = ?,
        activated_at = CASE WHEN ? = 1 AND activated_at IS NULL THEN CURRENT_TIMESTAMP ELSE activated_at END, -- Only set on first activation
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `, // Changed activated_at logic
      [isActive ? 1 : 0, isActive ? 1 : 0, id, decoded.userId]
    );

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
    console.error("Update service error:", error);
    return NextResponse.json(
      { success: false, error: "خطا در بروزرسانی سرویس" },
      { status: 500 }
    );
  }
}

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
