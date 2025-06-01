import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { openDb } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function PUT(request, { params }) {
  try {
    const token = request.headers.get("authorization")?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = params;
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

    // Verify service ownership
    const service = await db.get(
      "SELECT id FROM forwarding_services WHERE id = ? AND user_id = ?",
      [id, decoded.userId]
    );

    if (!service) {
      return NextResponse.json(
        { success: false, error: "سرویس یافت نشد" },
        { status: 404 }
      );
    }

    // Update service
    await db.run(
      `
      UPDATE forwarding_services
      SET
        name = ?,
        type = ?,
        source_channels = ?,
        target_channels = ?,
        search_replace_rules = ?,
        prompt_template = ?,
        copy_history = ?,
        history_limit = ?,
        history_direction = ?,
        start_from_id = ?,
        copy_direction = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `,
      [
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
        id,
        decoded.userId,
      ]
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
