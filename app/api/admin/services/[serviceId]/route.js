// File: app/api/admin/services/[serviceId]/route.js
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { openDb } from "@/lib/db";

export const dynamic = "force-dynamic";

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

    const { serviceId } = params;
    const { service_activated_at } = await request.json();

    if (service_activated_at === undefined) {
      // Allows setting to null explicitly
      return NextResponse.json(
        { success: false, error: "فیلد service_activated_at الزامی است." },
        { status: 400 }
      );
    }

    const newActivationDate = service_activated_at
      ? new Date(service_activated_at).toISOString()
      : null;

    const result = await db.run(
      "UPDATE forwarding_services SET service_activated_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [newActivationDate, serviceId]
    );

    if (result.changes === 0) {
      return NextResponse.json(
        { success: false, error: "سرویس یافت نشد یا تغییری اعمال نشد." },
        { status: 404 }
      );
    }

    // مهم: پس از تغییر تاریخ فعال‌سازی توسط ادمین، ممکن است لازم باشد وضعیت سرویس کاربر مجدداً ارزیابی شود
    // یا سرویس‌ها مجدداً بارگذاری شوند (مثلاً با restart کردن سرویس‌های آن کاربر خاص)
    // این بخش بسته به پیاده‌سازی background job شما دارد.
    // فعلا فقط تاریخ را آپدیت می‌کنیم.
    const service = await db.get(
      "SELECT user_id FROM forwarding_services WHERE id = ?",
      [serviceId]
    );
    if (service && service.user_id) {
      console.log(
        `Service ${serviceId} activation date changed by admin. Re-evaluating services for user ${service.user_id}`
      );
      // Potentially trigger a re-evaluation for this user's services if the background job isn't frequent enough
      // await startUserServices(service.user_id); // This might be too aggressive, depends on needs
    }

    return NextResponse.json({
      success: true,
      message: "تاریخ فعال‌سازی سرویس با موفقیت به‌روزرسانی شد.",
    });
  } catch (error) {
    console.error("Admin update service_activated_at error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "خطا در سرور هنگام به‌روزرسانی تاریخ فعال‌سازی سرویس.",
      },
      { status: 500 }
    );
  }
}
