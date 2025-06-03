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
        service_activated_at: service.service_activated_at, // اطمینان از ارسال این فیلد
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
      "SELECT id, is_admin, is_premium, premium_expiry_date, trial_activated_at FROM users WHERE id = ?",
      [decoded.userId]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد" },
        { status: 404 }
      );
    }

    const now = new Date();
    let effectiveAccountExpiryDate = null;

    if (
      user.is_premium &&
      user.premium_expiry_date &&
      new Date(user.premium_expiry_date) > now
    ) {
      effectiveAccountExpiryDate = new Date(user.premium_expiry_date);
    } else if (
      !user.is_admin &&
      !user.is_premium &&
      user.trial_activated_at &&
      user.premium_expiry_date
    ) {
      // For normal users, premium_expiry_date is their trial end date
      effectiveAccountExpiryDate = new Date(user.premium_expiry_date);
    }

    // --- Start of Limit Checks for Creating Service ---
    if (!user.is_admin) {
      // Check 1: Overall account/trial expiry for creating new services
      // If user is not premium, and their trial has started AND expired
      if (
        !user.is_premium &&
        user.trial_activated_at &&
        effectiveAccountExpiryDate &&
        now >= effectiveAccountExpiryDate
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "مهلت استفاده شما از سرویس‌ها به پایان رسیده است و نمی‌توانید سرویس جدیدی ایجاد کنید. لطفاً اشتراک خود را ارتقا دهید.",
          },
          { status: 403 }
        );
      }

      // Tier-based limits
      if (
        user.is_premium &&
        effectiveAccountExpiryDate &&
        now < effectiveAccountExpiryDate
      ) {
        // Premium User: No specific limits on source/destination count at creation
        // Active service count limit is checked during activation (PUT)
      } else {
        // Normal User (or expired premium)
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
        // service_creation_count logic was removed previously.
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
      "SELECT id, is_admin, is_premium, premium_expiry_date, trial_activated_at FROM users WHERE id = ?",
      [decoded.userId]
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "کاربر یافت نشد" },
        { status: 404 }
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
    let effectiveAccountExpiryDate = null;
    let userIsEffectivelyPremium = false;

    if (user.is_admin) {
      userIsEffectivelyPremium = true; // Admins have no restrictions
    } else if (
      user.is_premium &&
      user.premium_expiry_date &&
      new Date(user.premium_expiry_date) > now
    ) {
      effectiveAccountExpiryDate = new Date(user.premium_expiry_date);
      userIsEffectivelyPremium = true;
    } else if (
      !user.is_premium &&
      user.trial_activated_at &&
      user.premium_expiry_date
    ) {
      // Normal user whose trial has started, premium_expiry_date is their trial end.
      effectiveAccountExpiryDate = new Date(user.premium_expiry_date);
      userIsEffectivelyPremium = false;
    } else if (!user.is_premium && !user.trial_activated_at) {
      // Normal user, trial not yet started. They can activate one service to start trial.
      userIsEffectivelyPremium = false;
    }

    if (isActive) {
      // Only apply these checks if trying to ACTIVATE a service
      if (!user.is_admin) {
        // Check 1: Overall account/trial expiry
        if (effectiveAccountExpiryDate && now >= effectiveAccountExpiryDate) {
          // This case means their premium or trial has definitely expired.
          // The background job should handle deactivating services, but this is a safeguard.
          await db.run(
            "UPDATE forwarding_services SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_active = 1",
            [decoded.userId]
          );
          if (user.is_premium) {
            // If they were premium and expired, mark as not premium
            await db.run(
              "UPDATE users SET is_premium = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
              [decoded.userId]
            );
          }
          for (const svc of await db.all(
            "SELECT id FROM forwarding_services WHERE user_id = ? AND is_active = 1",
            [decoded.userId]
          )) {
            await stopService(decoded.userId, svc.id);
          }
          return NextResponse.json(
            {
              success: false,
              error:
                "مهلت استفاده شما از سرویس‌ها به پایان رسیده است. امکان فعال‌سازی وجود ندارد. لطفاً اشتراک خود را ارتقا دهید یا با پشتیبانی تماس بگیرید.",
            },
            { status: 403 }
          );
        }

        // Check 2: Tier-based active service limits
        if (userIsEffectivelyPremium && !user.is_admin) {
          // Premium (non-admin) user
          const activeServicesCount = await db.get(
            "SELECT COUNT(*) as count FROM forwarding_services WHERE user_id = ? AND is_active = 1 AND id != ?",
            [decoded.userId, serviceIdToUpdate]
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
        } else if (!userIsEffectivelyPremium && !user.is_admin) {
          // Normal User (or expired premium behaving as normal)
          const activeServicesCount = await db.get(
            "SELECT COUNT(*) as count FROM forwarding_services WHERE user_id = ? AND is_active = 1 AND id != ?",
            [decoded.userId, serviceIdToUpdate]
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

          const sourceChannels = JSON.parse(
            serviceToUpdate.source_channels || "[]"
          );
          const targetChannels = JSON.parse(
            serviceToUpdate.target_channels || "[]"
          );
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
    }

    let updateServiceSQL = `UPDATE forwarding_services SET is_active = ?, updated_at = CURRENT_TIMESTAMP`;
    const updateServiceParams = [isActive ? 1 : 0];

    if (isActive && !serviceToUpdate.service_activated_at) {
      // Set on first activation of THIS service
      updateServiceSQL += `, service_activated_at = CURRENT_TIMESTAMP`;
    }
    if (isActive) {
      // Always update last general activation time
      updateServiceSQL += `, activated_at = CURRENT_TIMESTAMP`;
    }

    updateServiceSQL += ` WHERE id = ? AND user_id = ?`;
    updateServiceParams.push(serviceIdToUpdate, decoded.userId);
    await db.run(updateServiceSQL, ...updateServiceParams);

    // Set user's trial_activated_at and calculate premium_expiry_date (for normal user's 15-day trial)
    // This happens when a normal user activates *any* service for the *very first time*
    if (
      isActive &&
      !user.is_admin &&
      !user.is_premium &&
      !user.trial_activated_at
    ) {
      const trialStart = new Date();
      const trialEnd = new Date(trialStart);
      trialEnd.setDate(trialStart.getDate() + 15);

      await db.run(
        "UPDATE users SET trial_activated_at = ?, premium_expiry_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [trialStart.toISOString(), trialEnd.toISOString(), decoded.userId]
      );
      console.log(
        `Normal user ${
          decoded.userId
        } trial started. Expires: ${trialEnd.toISOString()}. Trial activated at: ${trialStart.toISOString()}`
      );
    }

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

    // Note: Deleting a service does not reset trial_activated_at or premium_expiry_date for normal users.
    // The 15-day window is for the user, not per service.

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
