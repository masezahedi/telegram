// app/api/services/route.js
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
    const servicesFromDb = await db.all(
      "SELECT * FROM forwarding_services WHERE user_id = ? ORDER BY created_at DESC",
      [decoded.userId]
    );

    return NextResponse.json({
      success: true,
      services: servicesFromDb.map((service) => ({
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
        service_activated_at: service.service_activated_at,
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
      "SELECT id, is_admin, is_premium, premium_expiry_date, trial_activated_at, telegram_session FROM users WHERE id = ?",
      [decoded.userId]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد" },
        { status: 404 }
      );
    }

    // NEW LOGIC: Check if Telegram is connected before allowing service creation
    if (!user.telegram_session) {
      return NextResponse.json(
        { success: false, error: "لطفاً ابتدا حساب تلگرام خود را متصل کنید." },
        { status: 403 }
      );
    }

    const now = new Date();

    // Fetch tariff settings
    const tariffSettings = await db.get("SELECT * FROM tariff_settings LIMIT 1");
    const normalUserMaxChannelsPerService = tariffSettings?.normal_user_max_channels_per_service ?? 1;
    const premiumUserMaxChannelsPerService = tariffSettings?.premium_user_max_channels_per_service ?? 10;
    const normalUserTrialDays = tariffSettings?.normal_user_trial_days ?? 15;

    // Determine effective expiry date for the user based on premium_expiry_date (which includes trial end)
    let effectiveAccountExpiryDate = null;
    if (user.premium_expiry_date) {
        effectiveAccountExpiryDate = new Date(user.premium_expiry_date);
    }

    // --- Start of Limit Checks for Creating Service ---
    if (!user.is_admin) {
      // Check 1: Overall account/trial expiry for creating new services
      // If user is NOT premium AND their effective expiry date is in the past
      if (effectiveAccountExpiryDate && now >= effectiveAccountExpiryDate) {
        return NextResponse.json(
          {
            success: false,
            error:
              "مهلت استفاده شما از سرویس‌ها به پایان رسیده است و نمی‌توانید سرویس جدیدی ایجاد کنید. لطفاً اشتراک خود را ارتقا دهید.",
          },
          { status: 403 }
        );
      }

      // NEW LOGIC: Prevent service creation if normal user and trial NOT activated yet
      // This is now based on `trial_activated_at` being null AND not premium
      if (!user.is_premium && !user.trial_activated_at) {
        return NextResponse.json(
          {
            success: false,
            error: `لطفاً ابتدا مهلت ${normalUserTrialDays} روزه آزمایشی خود را فعال کنید.`,
          },
          { status: 403 }
        );
      }

      // Tier-based limits on channel count
      if (!user.is_premium) { // Only for normal user
        if (sourceChannels.filter(Boolean).length > normalUserMaxChannelsPerService ||
            targetChannels.filter(Boolean).length > normalUserMaxChannelsPerService) {
          return NextResponse.json(
            {
              success: false,
              error: `کاربران عادی فقط می‌توانند ${normalUserMaxChannelsPerService} کانال مبدأ و ${normalUserMaxChannelsPerService} کانال مقصد تعریف کنند.`,
            },
            { status: 403 }
          );
        }
      } else { // Premium user channel limit
        if (sourceChannels.filter(Boolean).length > premiumUserMaxChannelsPerService ||
            targetChannels.filter(Boolean).length > premiumUserMaxChannelsPerService) {
          return NextResponse.json(
            {
              success: false,
              error: `کاربران پرمیوم حداکثر می‌توانند ${premiumUserMaxChannelsPerService} کانال مبدأ و ${premiumUserMaxChannelsPerService} کانال مقصد تعریف کنند.`,
            },
            { status: 403 }
          );
        }
      }
    }
    // --- End of Limit Checks for Creating Service ---

    const serviceId = Date.now().toString();

    await db.run(
      `
      INSERT INTO forwarding_services (
        id, user_id, name, type, source_channels, target_channels,
        search_replace_rules, prompt_template, copy_history, history_limit,
        history_direction, start_from_id, copy_direction,
        created_at, updated_at, service_activated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
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

    const { id: serviceIdToUpdate, isActive } = await request.json();
    const db = await openDb();
    const user = await db.get(
      "SELECT id, is_admin, is_premium, premium_expiry_date, trial_activated_at, telegram_session FROM users WHERE id = ?",
      [decoded.userId]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد" },
        { status: 404 }
      );
    }

    // NEW LOGIC: Check if Telegram is connected before allowing service activation
    if (!user.telegram_session && isActive) {
      return NextResponse.json(
        { success: false, error: "لطفاً ابتدا حساب تلگرام خود را متصل کنید." },
        { status: 403 }
      );
    }

    const serviceToUpdate = await db.get(
      "SELECT * FROM forwarding_services WHERE id = ? AND user_id = ?",
      [serviceIdToUpdate, decoded.userId]
    );

    if (!serviceToUpdate) {
      return NextResponse.json(
        { success: false, error: "سرویس مورد نظر یافت نشد." },
        { status: 404 }
      );
    }

    const now = new Date();
    let effectiveAccountExpiryDate = null; // This will be the single source of truth for expiry
    let userIsEffectivelyPremium = false;

    // Fetch tariff settings
    const tariffSettings = await db.get("SELECT * FROM tariff_settings LIMIT 1");
    const normalUserTrialDays = tariffSettings?.normal_user_trial_days ?? 15;
    const premiumUserMaxActiveServices = tariffSettings?.premium_user_max_active_services ?? 5;
    const normalUserMaxActiveServices = tariffSettings?.normal_user_max_active_services ?? 1;
    const normalUserMaxChannelsPerService = tariffSettings?.normal_user_max_channels_per_service ?? 1;
    const premiumUserMaxChannelsPerService = tariffSettings?.premium_user_max_channels_per_service ?? 10;


    if (user.is_admin) {
      userIsEffectivelyPremium = true; // Admins have no restrictions
    } else if (user.premium_expiry_date) {
        effectiveAccountExpiryDate = new Date(user.premium_expiry_date);
        userIsEffectivelyPremium = user.is_premium && now < effectiveAccountExpiryDate;
    } else if (user.is_premium) {
        // Premium user without expiry date (e.g., lifetime premium)
        userIsEffectivelyPremium = true;
    }


    if (isActive) {
      // Only apply these checks if trying to ACTIVATE a service
      if (!user.is_admin) {
        // Check 1: Overall account expiry (using effectiveAccountExpiryDate)
        if (effectiveAccountExpiryDate && now >= effectiveAccountExpiryDate) {
          // If expired, ensure user's premium status is updated if applicable and services are stopped
          if (user.is_premium) {
            await db.run(
              "UPDATE users SET is_premium = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
              [decoded.userId]
            );
          }
          // The background job or startUserServices re-evaluation should stop all services.
          return NextResponse.json(
            {
              success: false,
              error:
                "مهلت استفاده شما از سرویس‌ها به پایان رسیده است. امکان فعال‌سازی وجود ندارد. لطفاً اشتراک خود را ارتقا دهید یا با پشتیبانی تماس بگیرید.",
            },
            { status: 403 }
          );
        }

        // Check for normal user, trial not activated
        if (!user.is_premium && !user.trial_activated_at) {
          return NextResponse.json(
            {
              success: false,
              error: `لطفاً ابتدا مهلت ${normalUserTrialDays} روزه آزمایشی خود را فعال کنید.`,
            },
            { status: 403 }
          );
        }

        // Check 2: Tier-based active service limits
        const activeServicesCount = await db.get(
          "SELECT COUNT(*) as count FROM forwarding_services WHERE user_id = ? AND is_active = 1 AND id != ?",
          [decoded.userId, serviceIdToUpdate]
        );

        const maxAllowedActiveServices = user.is_premium ? premiumUserMaxActiveServices : normalUserMaxActiveServices;
        if (activeServicesCount.count >= maxAllowedActiveServices) {
          return NextResponse.json(
            {
              success: false,
              error:
                `شما به حداکثر تعداد سرویس‌های فعال (${maxAllowedActiveServices}) رسیده‌اید. برای فعال‌سازی این سرویس، لطفاً ابتدا یک سرویس دیگر را غیرفعال کنید.`,
            },
            { status: 403 }
          );
        }

        // Check channel limits for current service being activated, if user is NOT admin
        if (!user.is_admin) {
          const serviceSourceChannels = JSON.parse(serviceToUpdate.source_channels || "[]");
          const serviceTargetChannels = JSON.parse(serviceToUpdate.target_channels || "[]");

          const maxChannelsPerService = user.is_premium ? premiumUserMaxChannelsPerService : normalUserMaxChannelsPerService;

          if (serviceSourceChannels.filter(Boolean).length > maxChannelsPerService ||
              serviceTargetChannels.filter(Boolean).length > maxChannelsPerService) {
              return NextResponse.json(
                  {
                      success: false,
                      error: `این سرویس دارای تعداد کانال‌های بیشتر از حد مجاز (${maxChannelsPerService} کانال مبدأ/مقصد) برای وضعیت حساب کاربری شماست. لطفاً آن را ویرایش کنید یا اشتراک خود را ارتقا دهید.`,
                  },
                  { status: 403 }
              );
          }
        }
      }
    }

    let updateServiceSQL = `UPDATE forwarding_services SET is_active = ?, updated_at = CURRENT_TIMESTAMP`;
    const updateServiceParams = [isActive ? 1 : 0];

    if (isActive) {
      updateServiceSQL += `, activated_at = CURRENT_TIMESTAMP`;
    }

    updateServiceSQL += ` WHERE id = ? AND user_id = ?`;
    updateServiceParams.push(serviceIdToUpdate, decoded.userId);
    await db.run(updateServiceSQL, ...updateServiceParams);

    try {
      if (isActive) {
        console.log(
          `🟢 Activating service ${serviceIdToUpdate} for user ${decoded.userId}`
        );
        await startUserServices(decoded.userId);
      } else {
        console.log(
          `🔴 Deactivating service ${serviceIdToUpdate} for user ${decoded.userId}`
        );
        await stopService(decoded.userId, serviceIdToUpdate);
      }
    } catch (serviceError) {
      console.error("Service control error:", serviceError);
      // Even if service control fails, we still return success if DB update was fine
      // Or you might want to revert DB status if service control is critical
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update service status error:", error);
    return NextResponse.json(
      { success: false, error: "خطا در بروزرسانی وضعیت سرویس" },
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