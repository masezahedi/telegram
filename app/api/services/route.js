import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { openDb } from "@/lib/db";
// اضافه کردن import برای کنترل سرویس‌ها
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
        history_limit: service.history_limit ?? 100, // استفاده از ?? به جای ||
        history_direction: service.history_direction ?? "newest", // استفاده از ?? به جای ||
        start_from_id: service.start_from_id, // بدون مقدار پیش‌فرض
        copy_direction: service.copy_direction ?? "before", // استفاده از ?? به جای ||
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
        Date.now().toString(),
        decoded.userId,
        name,
        type,
        JSON.stringify(sourceChannels),
        JSON.stringify(targetChannels),
        JSON.stringify(searchReplaceRules),
        useAI ? promptTemplate : null,
        copyHistory ? 1 : 0,
        historyLimit,
        historyDirection, // اضافه شده
        startFromId, // اضافه شده
        copyDirection, // اضافه شده
      ]
    );

    return NextResponse.json({ success: true, serviceId: result.lastID });
  } catch (error) {
    console.error("Create service error:", error);
    return NextResponse.json(
      { success: false, error: "خطا در ایجاد سرویس" },
      { status: 500 }
    );
  }
}

// اصلاح شده - با کنترل سرویس در سرور
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

    // بروزرسانی دیتابیس
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
    );

    // کنترل سرویس در سرور
    try {
      if (isActive) {
        // اگر فعال شده، همه سرویس‌های کاربر رو دوباره راه‌اندازی کن
        console.log(`🟢 Activating service ${id} for user ${decoded.userId}`);
        await startUserServices(decoded.userId);
      } else {
        // اگر غیرفعال شده، این سرویس رو متوقف کن
        console.log(`🔴 Deactivating service ${id} for user ${decoded.userId}`);
        await stopService(decoded.userId, id);
      }
    } catch (serviceError) {
      console.error("Service control error:", serviceError);
      // حتی اگر کنترل سرویس با خطا مواجه شه، پاسخ موفق برگردون
      // چون دیتابیس بروزرسانی شده
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

    // ابتدا سرویس رو متوقف کن
    try {
      console.log(`🗑️ Stopping service ${id} before deletion`);
      await stopService(decoded.userId, id);
    } catch (serviceError) {
      console.error("Error stopping service before deletion:", serviceError);
    }

    // سپس از دیتابیس حذفش کن
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
