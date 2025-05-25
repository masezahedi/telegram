import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { openDb } from "@/lib/db";

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
      sourceChannels,
      targetChannels,
      searchReplaceRules = [],
      useAI,
      promptTemplate,
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
        source_channels,
        target_channels,
        search_replace_rules,
        prompt_template,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
      [
        Date.now().toString(),
        decoded.userId,
        name,
        JSON.stringify(sourceChannels),
        JSON.stringify(targetChannels),
        JSON.stringify(searchReplaceRules),
        useAI ? promptTemplate : null,
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
