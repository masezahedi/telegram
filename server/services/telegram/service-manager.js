// Fixed service-manager.js - حل مشکل ارسال دوباره
const { Raw, NewMessage } = require("telegram/events");
const { getOrCreateClient } = require("./client");
const { processMessage, sendNotificationToUser } = require("./message-handler");
const {
  messageMaps,
  loadMessageMap,
  saveMessageMap,
  cleanExpiredMessages,
} = require("./message-maps");

const { openDb } = require("../../utils/db");

// Store active services
const activeServices = new Map();
// Store user event handlers (one per user)
const userEventHandlers = new Map();
// Store copy history tasks
const copyHistoryTasks = new Map();
// اضافه کردن: ذخیره پیام‌های در حال پردازش برای جلوگیری از تکرار
const processingMessages = new Map(); // key: `${serviceId}_${messageId}`, value: timestamp

// بهتر شده: Event handler با بررسی تکرار
async function createUserEventHandler(userId, services, client) {
  return async (update) => {
    try {
      let message = null;
      let isEdit = false;

      console.log(`📡 Update received for user ${userId}: ${update.className}`);

      // Extract message from update
      if (update.className === "UpdateNewChannelMessage" && update.message) {
        message = update.message;
        isEdit = false;
      } else if (
        update.className === "UpdateEditChannelMessage" &&
        update.message
      ) {
        message = update.message;
        isEdit = true;
      } else if (update.className === "UpdateNewMessage" && update.message) {
        message = update.message;
        isEdit = false;
      } else if (update.className === "UpdateEditMessage" && update.message) {
        message = update.message;
        isEdit = true;
      } else {
        return;
      }

      if (!message) {
        console.log(`⚠️ No message found in update`);
        return;
      }

      // استخراج channel ID
      let channelId = null;
      if (message.peerId?.channelId) {
        channelId = message.peerId.channelId;
      } else if (message.chatId) {
        channelId = message.chatId;
      } else if (message.chat?.id) {
        channelId = message.chat.id;
      }

      if (!channelId) {
        console.log(`⚠️ No channel ID found in message`);
        return;
      }

      console.log(
        `📍 Processing message from channel: ${channelId}, messageId: ${message.id}, isEdit: ${isEdit}`
      );

      // Process message for each relevant service
      for (const [serviceId, serviceData] of services.entries()) {
        try {
          const service = serviceData.service;

          // فقط پیام‌های جدید را برای سرویس‌های کپی تاریخچه پردازش نکن
          // چون کپی تاریخچه خودش این کار را انجام می‌دهد
          if (service.type === "copy" && service.copy_history && !isEdit) {
            // بررسی اینکه آیا کپی تاریخچه در حال اجرا است
            const taskId = `${userId}_${serviceId}`;
            const copyTask = copyHistoryTasks.get(taskId);
            if (copyTask && copyTask.processing) {
              console.log(
                `⏭️ Skipping live message ${message.id} for service ${serviceId} - copy history is processing`
              );
              continue;
            }
          }

          const sourceChannels = JSON.parse(service.source_channels);

          // بررسی اینکه پیام از source channel این سرویس است
          let isFromThisServiceSource = false;
          const matchedSourceChannelIds = [];

          for (const sourceChannel of sourceChannels) {
            try {
              const formattedUsername = sourceChannel.startsWith("@")
                ? sourceChannel
                : `@${sourceChannel}`;
              const entity = await client.getEntity(formattedUsername);

              const entityIdStr = entity.id?.toString() || String(entity.id);
              const channelIdStr = channelId?.toString() || String(channelId);

              const isMatch =
                entityIdStr === channelIdStr ||
                entity.id?.value?.toString() === channelId?.value?.toString() ||
                Math.abs(entity.id) === Math.abs(channelId);

              if (isMatch) {
                isFromThisServiceSource = true;
                matchedSourceChannelIds.push(entity.id);
                console.log(
                  `✅ Message matches source channel for service ${serviceId}: ${formattedUsername}`
                );
                break;
              }
            } catch (err) {
              console.error(
                `❌ Error getting entity for ${sourceChannel}:`,
                err
              );
              continue;
            }
          }

          if (isFromThisServiceSource && matchedSourceChannelIds.length > 0) {
            // بررسی تکرار پیام
            const messageKey = `${serviceId}_${message.id}`;
            const now = Date.now();

            // بررسی اینکه آیا این پیام در حال پردازش است
            if (processingMessages.has(messageKey)) {
              const processingTime = processingMessages.get(messageKey);
              // اگر کمتر از 30 ثانیه پیش شروع شده، رد کن
              if (now - processingTime < 30000) {
                console.log(
                  `🔄 Message ${message.id} is already being processed for service ${serviceId}, skipping`
                );
                continue;
              } else {
                // اگر بیش از 30 ثانیه پیش بوده، احتمالاً مشکلی پیش آمده، پاک کن
                processingMessages.delete(messageKey);
              }
            }

            // علامت‌گذاری پیام به عنوان در حال پردازش
            processingMessages.set(messageKey, now);

            console.log(
              `🔄 Processing message for service ${serviceId}, isEdit: ${isEdit}`
            );

            try {
              await processMessage(
                message,
                isEdit,
                matchedSourceChannelIds,
                service,
                client,
                serviceData.genAI
              );
            } finally {
              // حذف پیام از فهرست پردازش
              processingMessages.delete(messageKey);
            }
          }
        } catch (err) {
          console.error(
            `❌ Error processing message for service ${serviceId}:`,
            err
          );
          // در صورت خطا هم پیام را از فهرست پردازش حذف کن
          const messageKey = `${serviceId}_${message.id}`;
          processingMessages.delete(messageKey);
        }
      }
    } catch (err) {
      console.error(`❌ User ${userId} event handler error:`, err);
    }
  };
}

// تمیز کردن پیام‌های قدیمی از فهرست پردازش
function cleanupProcessingMessages() {
  const now = Date.now();
  const expiredKeys = [];

  for (const [key, timestamp] of processingMessages.entries()) {
    // حذف پیام‌هایی که بیش از 5 دقیقه در فهرست پردازش هستند
    if (now - timestamp > 300000) {
      expiredKeys.push(key);
    }
  }

  expiredKeys.forEach((key) => processingMessages.delete(key));

  if (expiredKeys.length > 0) {
    console.log(
      `🧹 Cleaned up ${expiredKeys.length} expired processing messages`
    );
  }
}

// اجرای تمیزکاری هر 5 دقیقه
setInterval(cleanupProcessingMessages, 5 * 60 * 1000);

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

    // متوقف کردن سرویس‌های قبلی
    await stopUserServices(userId);

    // شروع همه سرویس‌ها
    for (const service of services) {
      await startForwardingService(service, client, user.gemini_api_key);
    }

    // تنظیم event handler برای همه سرویس‌ها
    await setupUserEventHandlers(userId);

    // ارسال پیام‌های فعال‌سازی و شروع کپی تاریخچه
    for (const service of services) {
      const activationTime = new Date().toLocaleString("fa-IR", {
        timeZone: "Asia/Tehran",
      });
      await sendNotificationToUser(
        client,
        `🟢 سرویس "${service.name}" فعال شد\n⏰ ${activationTime}`
      );

      // کپی تاریخچه فقط برای سرویس‌های کپی - با تاخیر کوتاه
      if (service.type === "copy" && service.copy_history) {
        // تاخیر 2 ثانیه‌ای برای اطمینان از تنظیم کامل event handler
        setTimeout(() => {
          startCopyHistory(service, client, userId);
        }, 2000);
      }
    }

    console.log(`✅ All services started successfully for user ${userId}`);
  } catch (err) {
    console.error(`❌ Error starting user services for ${userId}:`, err);
    throw err;
  }
}

// بهتر شده: کپی تاریخچه با جلوگیری از تداخل
async function startCopyHistory(service, client, userId) {
  const taskId = `${userId}_${service.id}`;

  if (copyHistoryTasks.has(taskId)) {
    const existingTask = copyHistoryTasks.get(taskId);
    if (existingTask.processing) {
      console.log(
        `📚 Service ${service.id}: History copy task is already processing. Skipping.`
      );
      return;
    } else {
      console.warn(
        `⚠️ Service ${service.id}: Found a non-processing task, overwriting.`
      );
    }
  }

  console.log(`📚 Service ${service.id}: Starting history copy processing.`);

  const task = {
    active: true,
    processing: true,
    cancel: () => {
      console.log(`🛑 Cancelling copy history task for service ${service.id}`);
      task.active = false;
    },
  };
  copyHistoryTasks.set(taskId, task);

  try {
    const sourceChannels = JSON.parse(service.source_channels);
    if (sourceChannels.length === 0) {
      console.error(
        `Service ${service.id} has no source channels for history copy.`
      );
      throw new Error(
        `Service ${service.id}: No source channel defined for copy history.`
      );
    }

    const sourceChannelUsername = sourceChannels[0];
    const sourceChannelEntity = await client.getEntity(
      sourceChannelUsername.startsWith("@")
        ? sourceChannelUsername
        : `@${sourceChannelUsername}`
    );

    const userServices = activeServices.get(userId);
    const serviceData = userServices?.get(service.id);

    if (!serviceData) {
      console.log(
        `⚠️ Service ${service.id} not found in active services during history copy.`
      );
      task.active = false;
      return;
    }

    if (!messageMaps.has(service.id)) {
      console.warn(
        `⚠️ Message map for service ${service.id} not found, initializing new one.`
      );
      messageMaps.set(service.id, loadMessageMap(service.id));
    }

    let messages = [];
    const limit = Math.min(parseInt(service.history_limit) || 100, 10000);
    const startFromId = service.start_from_id
      ? service.start_from_id.toString().trim()
      : null;
    const copyDirection = service.copy_direction || "before";
    const historyDirection = service.history_direction || "newest";

    console.log(
      `📊 Service ${service.id} History Copy Settings: limit=${limit}, startFromId=${startFromId}, copyDirection=${copyDirection}, historyDirection=${historyDirection}`
    );

    // دریافت پیام‌ها بر اساس تنظیمات
    if (startFromId && !isNaN(parseInt(startFromId))) {
      const offsetId = parseInt(startFromId);
      console.log(
        `📍 Service ${service.id}: Getting messages from specific ID: ${offsetId}, direction: ${copyDirection}`
      );
      if (copyDirection === "after") {
        messages = await client.getMessages(sourceChannelEntity, {
          limit: limit,
          offsetId: offsetId,
          addOffset: 1,
          reverse: true,
        });
      } else {
        messages = await client.getMessages(sourceChannelEntity, {
          limit: limit,
          offsetId: offsetId,
          addOffset: 0,
          reverse: false,
        });
        messages.reverse();
      }
    } else {
      console.log(
        `📍 Service ${service.id}: Getting messages by history direction: ${historyDirection}`
      );
      if (historyDirection === "oldest") {
        messages = await client.getMessages(sourceChannelEntity, {
          limit: limit,
          reverse: true,
        });
      } else {
        messages = await client.getMessages(sourceChannelEntity, {
          limit: limit,
          reverse: false,
        });
        messages.reverse();
      }
    }

    // حذف پیام‌های تکراری
    const uniqueMessages = [];
    const seenMessageIds = new Set();
    for (const message of messages) {
      if (message && message.id && !seenMessageIds.has(message.id)) {
        seenMessageIds.add(message.id);
        uniqueMessages.push(message);
      }
    }
    console.log(
      `📨 Service ${service.id}: Found ${messages.length} messages, ${uniqueMessages.length} unique for history copy.`
    );

    let copiedCount = 0;
    let skippedInLoopCount = 0;

    for (let i = 0; i < uniqueMessages.length; i++) {
      if (!task.active) {
        console.log(
          `🛑 Service ${service.id}: Copy history task cancelled during message loop.`
        );
        break;
      }

      const message = uniqueMessages[i];

      try {
        // بررسی تکرار برای کپی تاریخچه
        const messageKey = `${service.id}_${message.id}`;

        // اگر پیام در حال پردازش است، رد کن
        if (processingMessages.has(messageKey)) {
          console.log(
            `⏭️ History message ${message.id} is already being processed, skipping`
          );
          skippedInLoopCount++;
          continue;
        }

        // علامت‌گذاری به عنوان در حال پردازش
        processingMessages.set(messageKey, Date.now());

        try {
          const forwardedDetails = await processMessage(
            message,
            false, // isEdit
            [sourceChannelEntity.id],
            service,
            client,
            serviceData.genAI
          );

          if (forwardedDetails && Object.keys(forwardedDetails).length > 0) {
            copiedCount++;
          } else {
            skippedInLoopCount++;
          }
        } finally {
          // حذف از فهرست پردازش
          processingMessages.delete(messageKey);
        }

        // تاخیر بین پیام‌ها
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (err) {
        console.error(
          `❌ Error processing historical message ${message.id} for service ${service.id}:`,
          err
        );
        skippedInLoopCount++;
        // حذف از فهرست پردازش در صورت خطا
        const messageKey = `${service.id}_${message.id}`;
        processingMessages.delete(messageKey);
      }
    }

    console.log(
      `✅ Service ${service.id}: History copy finished. Copied: ${copiedCount}, Skipped: ${skippedInLoopCount}.`
    );

    if (task.active) {
      await sendNotificationToUser(
        client,
        `✅ کپی تاریخچه سرویس "${service.name}" تکمیل شد\n📊 کپی شده: ${copiedCount}, رد شده: ${skippedInLoopCount}`
      );
    }
  } catch (err) {
    console.error(
      `❌ Service ${service.id}: Critical error during history copy:`,
      err
    );
    if (client && service) {
      await sendNotificationToUser(
        client,
        `❌ خطا در کپی تاریخچه سرویس "${service.name}": ${err.message}`
      );
    }
  } finally {
    task.processing = false;
    if (copyHistoryTasks.get(taskId) === task) {
      copyHistoryTasks.delete(taskId);
    }
    console.log(
      `🏁 Service ${service.id}: Finished history copy task execution.`
    );
  }
}

async function setupUserEventHandlers(userId) {
  try {
    const userServices = activeServices.get(userId);
    if (!userServices || userServices.size === 0) {
      console.log(`⚠️ No services found for user ${userId}`);
      return;
    }

    const client = await getOrCreateClient(userId);

    // بهتر شده: حذف کامل event handler های قبلی
    await cleanupUserEventHandlers(userId);

    // جمع‌آوری همه source channel ها برای سرویس‌های فعال
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
          console.log(
            `📡 Added source channel ${formattedUsername} (${entity.id}) for service ${serviceId}`
          );
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
      console.log(
        `🔄 Event handlers setup for user ${userId} with ${allSourceChannelIds.size} channels`
      );
    } else {
      console.log(`⚠️ No valid source channels found for user ${userId}`);
    }
  } catch (err) {
    console.error(
      `❌ Error setting up event handlers for user ${userId}:`,
      err
    );
  }
}

async function stopService(userId, serviceId) {
  try {
    console.log(`🛑 Stopping service ${serviceId} for user ${userId}`);

    // Cancel any ongoing copy history task
    const taskId = `${userId}_${serviceId}`;
    const copyTask = copyHistoryTasks.get(taskId);
    if (copyTask) {
      copyTask.cancel();
      copyHistoryTasks.delete(taskId);
      console.log(`🛑 Copy history task cancelled for service ${serviceId}`);
    }

    // پاک کردن پیام‌های در حال پردازش این سرویس
    const keysToDelete = [];
    for (const [key] of processingMessages.entries()) {
      if (key.startsWith(`${serviceId}_`)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach((key) => processingMessages.delete(key));

    if (keysToDelete.length > 0) {
      console.log(
        `🧹 Cleaned up ${keysToDelete.length} processing messages for service ${serviceId}`
      );
    }

    const userServices = activeServices.get(userId);
    if (userServices && userServices.has(serviceId)) {
      const serviceData = userServices.get(serviceId);

      if (serviceData.cleanupInterval) {
        clearInterval(serviceData.cleanupInterval);
        console.log(`⏹️ Cleanup interval stopped for service ${serviceId}`);
      }

      const messageMap = messageMaps.get(serviceId);
      if (messageMap) {
        cleanExpiredMessages(serviceId);
        saveMessageMap(serviceId, messageMap);
        messageMaps.delete(serviceId);
        console.log(
          `🗃️ Message map saved and cleared for service ${serviceId}`
        );
      }

      userServices.delete(serviceId);
      console.log(`✅ Service ${serviceId} removed from active services`);

      if (userServices.size === 0) {
        console.log(
          `🧹 No more services for user ${userId}, cleaning up event handlers`
        );
        activeServices.delete(userId);
        await cleanupUserEventHandlers(userId);
      } else {
        console.log(`🔄 Restarting remaining services for user ${userId}`);
        await setupUserEventHandlers(userId);
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

async function cleanupUserEventHandlers(userId) {
  try {
    const eventHandlers = userEventHandlers.get(userId) || [];
    if (eventHandlers.length > 0) {
      const client = await getOrCreateClient(userId);
      for (const handler of eventHandlers) {
        try {
          client.removeEventHandler(handler);
          console.log(`🔌 Event handler removed for user ${userId}`);
        } catch (err) {
          console.error(
            `❌ Error removing event handler for user ${userId}:`,
            err
          );
        }
      }
      userEventHandlers.delete(userId);
    }
  } catch (err) {
    console.error(
      `❌ Error cleaning up event handlers for user ${userId}:`,
      err
    );
  }
}

async function stopUserServices(userId) {
  try {
    // متوقف کردن همه task های کپی تاریخچه
    const tasksToCancel = [];
    for (const [taskId, task] of copyHistoryTasks.entries()) {
      if (taskId.startsWith(`${userId}_`)) {
        tasksToCancel.push(taskId);
        task.cancel();
      }
    }

    tasksToCancel.forEach((taskId) => {
      copyHistoryTasks.delete(taskId);
      console.log(`🛑 Copy history task ${taskId} cancelled`);
    });

    // پاک کردن پیام‌های در حال پردازش این کاربر
    const userServices = activeServices.get(userId);
    if (userServices) {
      const keysToDelete = [];
      for (const serviceId of userServices.keys()) {
        for (const [key] of processingMessages.entries()) {
          if (key.startsWith(`${serviceId}_`)) {
            keysToDelete.push(key);
          }
        }
      }
      keysToDelete.forEach((key) => processingMessages.delete(key));

      if (keysToDelete.length > 0) {
        console.log(
          `🧹 Cleaned up ${keysToDelete.length} processing messages for user ${userId}`
        );
      }

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
    await cleanupUserEventHandlers(userId);

    console.log(`✅ All services stopped for user ${userId}`);
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
  copyHistoryTasks,
  startForwardingService,
  startUserServices,
  stopService,
  stopUserServices,
  initializeAllServices,
};
