const { Raw, NewMessage } = require("telegram/events");
const { getOrCreateClient } = require("./client");
const { processMessage, sendNotificationToUser } = require("./message-handler");
const {
  loadMessageMap,
  messageMaps,
  cleanExpiredMessages,
} = require("./message-maps");
const { openDb } = require("../../utils/db");

// Store active services
const activeServices = new Map();
// Store user event handlers (one per user)
const userEventHandlers = new Map();

async function startForwardingService(service, client, geminiApiKey) {
  try {
    const serviceId = service.id;
    console.log(`🚀 Starting service ${serviceId}`);

    // Load message mapping
    const messageMap = loadMessageMap(serviceId);
    messageMaps.set(serviceId, messageMap);

    // Initialize Gemini if needed
    let genAI = null;
    if (service.prompt_template && geminiApiKey) {
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      genAI = new GoogleGenerativeAI(geminiApiKey);
      console.log(`🤖 Service ${serviceId}: Initialized Gemini AI`);
    }

    // Set up cleanup interval
    const cleanupInterval = setInterval(() => {
      cleanExpiredMessages(serviceId);
    }, 30 * 60 * 1000);

    // Store service data
    if (!activeServices.has(service.user_id)) {
      activeServices.set(service.user_id, new Map());
    }
    activeServices.get(service.user_id).set(serviceId, {
      service,
      genAI,
      cleanupInterval,
    });

    console.log(`✅ Service ${serviceId} started for user ${service.user_id}`);
  } catch (err) {
    console.error(`❌ Error starting service ${service.id}:`, err);
    throw err;
  }
}

async function createUserEventHandler(userId, services, client) {
  return async (update) => {
    try {
      let message = null;
      let isEdit = false;

      // Extract message from update
      if (update.className === "UpdateNewChannelMessage" && update.message) {
        message = update.message;
      } else if (
        update.className === "UpdateEditChannelMessage" &&
        update.message
      ) {
        message = update.message;
        isEdit = true;
      } else if (update.className === "UpdateNewMessage" && update.message) {
        message = update.message;
      } else if (update.className === "UpdateEditMessage" && update.message) {
        message = update.message;
        isEdit = true;
      }

      if (!message) return;

      const channelId = message.peerId?.channelId || message.chatId;
      if (!channelId) return;

      // Create a set to track which services have already processed this message
      const processedServices = new Set();

      // Process message for each relevant service
      for (const [serviceId, serviceData] of services.entries()) {
        try {
          // Skip if this service was already processed for this message
          if (processedServices.has(serviceId)) {
            continue;
          }

          const service = serviceData.service;
          const sourceChannels = JSON.parse(service.source_channels);

          // Check if this message is from a source channel for this service
          let isFromSourceChannel = false;
          let matchedSourceChannelId = null;

          for (const sourceChannel of sourceChannels) {
            try {
              const formattedUsername = sourceChannel.startsWith("@")
                ? sourceChannel
                : `@${sourceChannel}`;
              const entity = await client.getEntity(formattedUsername);

              if (entity.id.toString() === channelId.toString()) {
                isFromSourceChannel = true;
                matchedSourceChannelId = entity.id;
                break;
              }
            } catch (err) {
              // Skip invalid channels
              continue;
            }
          }

          if (isFromSourceChannel) {
            console.log(
              `📨 Processing message for service ${serviceId} from channel ${matchedSourceChannelId}`
            );

            // Mark this service as processed
            processedServices.add(serviceId);

            await processMessage(
              message,
              isEdit,
              [channelId],
              service,
              client,
              serviceData.genAI
            );
          }
        } catch (err) {
          console.error(
            `❌ Error processing message for service ${serviceId}:`,
            err
          );
        }
      }
    } catch (err) {
      console.error(`❌ User ${userId} event handler error:`, err);
    }
  };
}

// Alternative solution: Create separate event handlers for each service
async function createServiceSpecificEventHandler(
  userId,
  serviceId,
  serviceData,
  client
) {
  const service = serviceData.service;
  const sourceChannels = JSON.parse(service.source_channels);

  // Get source channel entities
  const sourceChannelIds = [];
  for (const sourceChannel of sourceChannels) {
    try {
      const formattedUsername = sourceChannel.startsWith("@")
        ? sourceChannel
        : `@${sourceChannel}`;
      const entity = await client.getEntity(formattedUsername);
      sourceChannelIds.push(entity.id);
    } catch (err) {
      console.error(`❌ Error getting entity for ${sourceChannel}:`, err);
    }
  }

  return async (update) => {
    try {
      let message = null;
      let isEdit = false;

      // Extract message from update
      if (update.className === "UpdateNewChannelMessage" && update.message) {
        message = update.message;
      } else if (
        update.className === "UpdateEditChannelMessage" &&
        update.message
      ) {
        message = update.message;
        isEdit = true;
      } else if (update.className === "UpdateNewMessage" && update.message) {
        message = update.message;
      } else if (update.className === "UpdateEditMessage" && update.message) {
        message = update.message;
        isEdit = true;
      }

      if (!message) return;

      const channelId = message.peerId?.channelId || message.chatId;
      if (!channelId) return;

      // Check if message is from this service's source channels
      const isFromThisServiceSource = sourceChannelIds.some(
        (id) => id.toString() === channelId.toString()
      );

      if (isFromThisServiceSource) {
        console.log(
          `📨 Processing message for service ${serviceId} (dedicated handler)`
        );

        await processMessage(
          message,
          isEdit,
          [channelId],
          service,
          client,
          serviceData.genAI
        );
      }
    } catch (err) {
      console.error(`❌ Service ${serviceId} event handler error:`, err);
    }
  };
}

async function startUserServices(userId) {
  try {
    console.log(`🚀 Starting services for user ${userId}`);

    const db = await openDb();

    const user = await db.get(
      `
      SELECT u.telegram_session, us.gemini_api_key
      FROM users u
      LEFT JOIN user_settings us ON u.id = us.user_id
      WHERE u.id = ?
    `,
      [userId]
    );

    if (!user?.telegram_session) {
      console.log(`⚠️ No Telegram session found for user: ${userId}`);
      return;
    }

    const services = await db.all(
      "SELECT * FROM forwarding_services WHERE user_id = ? AND is_active = 1",
      [userId]
    );

    if (services.length === 0) {
      console.log(`⚠️ No active services found for user: ${userId}`);
      return;
    }

    console.log(
      `📋 Found ${services.length} active services for user ${userId}`
    );

    const client = await getOrCreateClient(userId, user.telegram_session);

    // متوقف کردن سرویس‌های قبلی برای جلوگیری از تداخل
    await stopUserServices(userId);

    // شروع همه سرویس‌ها
    for (const service of services) {
      await startForwardingService(service, client, user.gemini_api_key);
    }

    // تنظیم event handler های جدید
    await restartUserEventHandlers(userId);

    // ارسال پیام‌های فعال‌سازی
    for (const service of services) {
      const activationTime = new Date().toLocaleString("fa-IR", {
        timeZone: "Asia/Tehran",
      });
      await sendNotificationToUser(
        client,
        `🟢 سرویس "${service.name}" فعال شد\n⏰ ${activationTime}`
      );

      // کپی تاریخچه در صورت نیاز
      if (service.type === "copy" && service.copy_history) {
        console.log(`📚 Service ${service.id}: Starting history copy`);
        try {
          const sourceChannels = JSON.parse(service.source_channels);
          const sourceChannel = await client.getEntity(
            sourceChannels[0].startsWith("@")
              ? sourceChannels[0]
              : `@${sourceChannels[0]}`
          );

          const messages = await client.getMessages(sourceChannel, {
            limit: service.history_limit || 100,
            reverse: true,
          });

          const userServices = activeServices.get(userId);
          const serviceData = userServices.get(service.id);

          for (const message of messages) {
            await processMessage(
              message,
              false,
              [sourceChannel.id],
              service,
              client,
              serviceData.genAI
            );
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }

          console.log(`✅ Service ${service.id}: History copy completed`);
        } catch (err) {
          console.error(`❌ Service ${service.id}: History copy error:`, err);
        }
      }
    }

    console.log(`✅ All services started successfully for user ${userId}`);
  } catch (err) {
    console.error(`❌ Error starting user services for ${userId}:`, err);
    throw err;
  }
}

async function stopService(userId, serviceId) {
  try {
    console.log(`🛑 Stopping service ${serviceId} for user ${userId}`);

    const userServices = activeServices.get(userId);
    if (userServices && userServices.has(serviceId)) {
      const serviceData = userServices.get(serviceId);

      // متوقف کردن cleanup interval
      if (serviceData.cleanupInterval) {
        clearInterval(serviceData.cleanupInterval);
        console.log(`⏹️ Cleanup interval stopped for service ${serviceId}`);
      }

      // ذخیره و پاک کردن message map
      const messageMap = messageMaps.get(serviceId);
      if (messageMap) {
        cleanExpiredMessages(serviceId);
        saveMessageMap(serviceId, messageMap);
        messageMaps.delete(serviceId);
        console.log(
          `🗃️ Message map saved and cleared for service ${serviceId}`
        );
      }

      // حذف سرویس از فهرست فعال
      userServices.delete(serviceId);
      console.log(`✅ Service ${serviceId} removed from active services`);

      // اگر هیچ سرویسی برای این کاربر نمونده، event handler رو هم پاک کن
      if (userServices.size === 0) {
        console.log(
          `🧹 No more services for user ${userId}, cleaning up event handlers`
        );

        activeServices.delete(userId);

        const eventHandlers = userEventHandlers.get(userId) || [];
        if (eventHandlers.length > 0) {
          try {
            const client = await getOrCreateClient(userId);
            for (const handler of eventHandlers) {
              client.removeEventHandler(handler);
              console.log(`🔌 Event handler removed for user ${userId}`);
            }
          } catch (err) {
            console.error(
              `❌ Error removing event handlers for user ${userId}:`,
              err
            );
          }
          userEventHandlers.delete(userId);
        }
      } else {
        // اگر هنوز سرویس‌های دیگه‌ای برای این کاربر هست، event handler رو دوباره تنظیم کن
        console.log(`🔄 Restarting remaining services for user ${userId}`);
        await restartUserEventHandlers(userId);
      }

      console.log(`✅ Service ${serviceId} successfully stopped`);
    } else {
      console.log(`⚠️ Service ${serviceId} was not active for user ${userId}`);
    }
  } catch (err) {
    console.error(`❌ Error stopping service ${serviceId}:`, err);
    throw err;
  }
}

async function restartUserEventHandlers(userId) {
  try {
    const userServices = activeServices.get(userId);
    if (!userServices || userServices.size === 0) {
      return;
    }

    const client = await getOrCreateClient(userId);

    // حذف event handler های قبلی
    const existingHandlers = userEventHandlers.get(userId) || [];
    for (const handler of existingHandlers) {
      client.removeEventHandler(handler);
    }

    // جمع‌آوری همه source channel ها برای سرویس‌های باقی‌مانده
    const allSourceChannelIds = new Set();
    for (const [serviceId, serviceData] of userServices.entries()) {
      const sourceChannels = JSON.parse(serviceData.service.source_channels);
      for (const sourceChannel of sourceChannels) {
        try {
          const formattedUsername = sourceChannel.startsWith("@")
            ? sourceChannel
            : `@${sourceChannel}`;
          const entity = await client.getEntity(formattedUsername);
          allSourceChannelIds.add(entity.id);
        } catch (err) {
          console.error(`❌ Error getting entity for ${sourceChannel}:`, err);
        }
      }
    }

    // ایجاد event handler جدید
    if (allSourceChannelIds.size > 0) {
      const eventHandler = await createUserEventHandler(
        userId,
        userServices,
        client
      );

      client.addEventHandler(
        eventHandler,
        new Raw({
          chats: Array.from(allSourceChannelIds),
        })
      );

      userEventHandlers.set(userId, [eventHandler]);
      console.log(`🔄 Event handlers restarted for user ${userId}`);
    }
  } catch (err) {
    console.error(
      `❌ Error restarting event handlers for user ${userId}:`,
      err
    );
  }
}

async function stopUserServices(userId) {
  try {
    const userServices = activeServices.get(userId);
    if (userServices) {
      // Stop all services
      for (const [serviceId, serviceData] of userServices.entries()) {
        if (serviceData.cleanupInterval) {
          clearInterval(serviceData.cleanupInterval);
        }

        const messageMap = messageMaps.get(serviceId);
        if (messageMap) {
          cleanExpiredMessages(serviceId);
          saveMessageMap(serviceId, messageMap);
          messageMaps.delete(serviceId);
        }
      }

      activeServices.delete(userId);
    }

    // Remove event handlers
    const eventHandlers = userEventHandlers.get(userId) || [];
    if (eventHandlers.length > 0) {
      try {
        const client = await getOrCreateClient(userId);
        for (const handler of eventHandlers) {
          client.removeEventHandler(handler);
        }
      } catch (err) {
        console.error("Error removing event handlers:", err);
      }
      userEventHandlers.delete(userId);
    }
  } catch (err) {
    console.error("Error stopping user services:", err);
  }
}

async function initializeAllServices() {
  try {
    const db = await openDb();

    const users = await db.all(`
      SELECT DISTINCT u.id
      FROM users u
      INNER JOIN forwarding_services fs ON u.id = fs.user_id
      WHERE fs.is_active = 1
    `);

    console.log(`🔍 Found ${users.length} users with active services`);

    for (const user of users) {
      try {
        await startUserServices(user.id);
      } catch (err) {
        console.error(`❌ Failed to start services for user ${user.id}:`, err);
      }
    }

    console.log("🎉 All active services initialized");
  } catch (err) {
    console.error("❌ Error initializing services:", err);
  }
}

module.exports = {
  activeServices,
  userEventHandlers,
  startForwardingService,
  startUserServices,
  stopService,
  stopUserServices,
  initializeAllServices,
};
