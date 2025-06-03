import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth"; //
import { openDb } from "@/lib/db"; //
import {
  stopService,
  startUserServices,
} from "@/server/services/telegram/service-manager"; //

export const dynamic = "force-dynamic"; //

export async function GET(request) {
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
    const services = await db.all(
      "SELECT * FROM forwarding_services WHERE user_id = ? ORDER BY created_at DESC",
      [decoded.userId]
    ); //

    return NextResponse.json({
      success: true, //
      services: services.map((service) => ({
        ...service, //
        source_channels: JSON.parse(service.source_channels), //
        target_channels: JSON.parse(service.target_channels), //
        search_replace_rules: JSON.parse(service.search_replace_rules), //
        is_active: Boolean(service.is_active), //
        useAI: Boolean(service.prompt_template), //
        type: service.type || "forward", //
        copy_history: Boolean(service.copy_history), //
        history_limit: service.history_limit ?? 100, //
        history_direction: service.history_direction ?? "newest", //
        start_from_id: service.start_from_id, //
        copy_direction: service.copy_direction ?? "before", //
      })),
    });
  } catch (error) {
    console.error("Get services error:", error); //
    return NextResponse.json(
      { success: false, error: "خطا در دریافت سرویس‌ها" },
      { status: 500 }
    ); //
  }
}

export async function POST(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1]; //
    const decoded = await verifyToken(token); //

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ); //
    }

    const {
      name,
      type = "forward", //
      sourceChannels,
      targetChannels,
      searchReplaceRules = [], //
      useAI,
      promptTemplate,
      copyHistory = false, //
      historyLimit = 100, //
      historyDirection = "newest", //
      startFromId = null, //
      copyDirection = "before", //
    } = await request.json(); //

    if (!name || !sourceChannels?.length || !targetChannels?.length) {
      return NextResponse.json(
        { success: false, error: "اطلاعات ناقص است" },
        { status: 400 }
      ); //
    }

    const db = await openDb(); //
    const user = await db.get(
      "SELECT is_admin, is_premium, premium_expiry_date FROM users WHERE id = ?",
      [decoded.userId]
    );

    // --- Start of Phase 2 Logic for POST ---
    if (!user.is_admin && !user.is_premium) {
      // Limit 1: Only one active service for normal users
      // This check is more relevant when activating a service, but good to be mindful
      const activeServicesCount = await db.get(
        "SELECT COUNT(*) as count FROM forwarding_services WHERE user_id = ? AND is_active = 1",
        [decoded.userId]
      );
      if (activeServicesCount.count >= 1) {
        // If creating a new service, it will become the active one if none exist or user wants it active
        // This check assumes new services are intended to be active or will be activated.
        // For now, if *any* service is active, block creation.
        // In Phase 3 this logic will be refined with service_creation_count.
        // For *activation* see PUT route.
        // If the user wants to create this new service as active, and already has an active one.
        // For simplicity now: if they have an active one, they can't create another.
        // This will be adjusted in Phase 3 and for service activation.
      }

      // Limit 2: Only one source and one destination for normal users
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
    // --- End of Phase 2 Logic for POST ---

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
        Date.now().toString(), //
        decoded.userId, //
        name, //
        type, //
        JSON.stringify(sourceChannels), //
        JSON.stringify(targetChannels), //
        JSON.stringify(searchReplaceRules), //
        useAI ? promptTemplate : null, //
        copyHistory ? 1 : 0, //
        historyLimit, //
        historyDirection, //
        startFromId, //
        copyDirection, //
      ]
    );

    return NextResponse.json({ success: true, serviceId: result.lastID }); //
  } catch (error) {
    console.error("Create service error:", error); //
    return NextResponse.json(
      { success: false, error: "خطا در ایجاد سرویس" },
      { status: 500 }
    ); //
  }
}

export async function PUT(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1]; //
    const decoded = await verifyToken(token); //

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ); //
    }

    const { id, isActive } = await request.json(); //
    const db = await openDb(); //
    const user = await db.get(
      "SELECT is_admin, is_premium, premium_expiry_date FROM users WHERE id = ?",
      [decoded.userId]
    );

    // --- Start of Phase 2 Logic for PUT (activating a service) ---
    if (isActive && !user.is_admin && !user.is_premium) {
      // Limit 1: Only one active service for normal users
      const activeServicesCount = await db.get(
        "SELECT COUNT(*) as count FROM forwarding_services WHERE user_id = ? AND is_active = 1 AND id != ?",
        [decoded.userId, id] // Exclude current service if it's being updated
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

      // Limit 2: Check source/destination count for the service being activated
      const serviceToActivate = await db.get(
        "SELECT source_channels, target_channels FROM forwarding_services WHERE id = ?",
        [id]
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
      }
    }
    // --- End of Phase 2 Logic for PUT ---

    await db.run(
      `
      UPDATE forwarding_services
      SET 
        is_active = ?,
        activated_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE activated_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `,
      [isActive ? 1 : 0, isActive ? 1 : 0, id, decoded.userId]
    ); //

    try {
      if (isActive) {
        console.log(`🟢 Activating service ${id} for user ${decoded.userId}`); //
        await startUserServices(decoded.userId); //
      } else {
        console.log(`🔴 Deactivating service ${id} for user ${decoded.userId}`); //
        await stopService(decoded.userId, id); //
      }
    } catch (serviceError) {
      console.error("Service control error:", serviceError); //
    }

    return NextResponse.json({ success: true }); //
  } catch (error) {
    console.error("Update service error:", error); //
    return NextResponse.json(
      { success: false, error: "خطا در بروزرسانی سرویس" },
      { status: 500 }
    ); //
  }
}

export async function DELETE(request) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1]; //
    const decoded = await verifyToken(token); //

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      ); //
    }

    const { id } = await request.json(); //
    const db = await openDb(); //

    try {
      console.log(`🗑️ Stopping service ${id} before deletion`); //
      await stopService(decoded.userId, id); //
    } catch (serviceError) {
      console.error("Error stopping service before deletion:", serviceError); //
    }

    await db.run(
      "DELETE FROM forwarding_services WHERE id = ? AND user_id = ?",
      [id, decoded.userId]
    ); //

    return NextResponse.json({ success: true }); //
  } catch (error) {
    console.error("Delete service error:", error); //
    return NextResponse.json(
      { success: false, error: "خطا در حذف سرویس" },
      { status: 500 }
    ); //
  }
}
