// Fixed service-manager.js - رفع مشکل پردازش تکراری
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
const lastCopyHistoryRunTimestamp = new Map();
const MIN_INTERVAL_BETWEEN_COPY_HISTORY_RUNS = 5 * 60 * 1000; // 5 دقیقه

// 🔥 NEW: Cache برای جلوگیری از پردازش تکراری پیام‌ها
const processedMessages = new Map(); // userId -> Set of messageIds
const PROCESSED_MESSAGE_CACHE_TIME = 10 * 60 * 1000; // 10 دقیقه

// 🔥 NEW: تابع برای پاک کردن cache پیام‌های پردازش شده
function cleanProcessedMessagesCache(userId) {
  const userProcessedMessages = processedMessages.get(userId);
  if (userProcessedMessages) {
    userProcessedMessages.clear();
    console.log(`🧹 Cleared processed messages cache for user ${userId}`);
  }
}

// 🔥 IMPROVED: Event handler با جلوگیری از تکرار
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
        console.log(`📨 New channel message: ${message.id}`);
      } else if (
        update.className === "UpdateEditChannelMessage" &&
        update.message
      ) {
        message = update.message;
        isEdit = true;
        console.log(`✏️ Edit channel message: ${message.id}`);
      } else if (update.className === "UpdateNewMessage" && update.message) {
        message = update.message;
        isEdit = false;
        console.log(`📨 New message: ${message.id}`);
      } else if (update.className === "UpdateEditMessage" && update.message) {
        message = update.message;
        isEdit = true;
        console.log(`✏️ Edit message: ${message.id}`);
      } else {
        return;
      }

      if (!message || !message.id) {
        console.log(`⚠️ No valid message found in update`);
        return;
      }

      // 🔥 NEW: جلوگیری از پردازش تکراری پیام‌ها
      if (!processedMessages.has(userId)) {
        processedMessages.set(userId, new Set());
      }

      const userProcessedSet = processedMessages.get(userId);
      const messageKey = `${message.id}_${isEdit ? "edit" : "new"}`;

      if (userProcessedSet.has(messageKey)) {
        console.log(
          `⚠️ Message ${message.id} (${
            isEdit ? "edit" : "new"
          }) already processed for user ${userId}. Skipping.`
        );
        return;
      }

      // اضافه کردن به cache
      userProcessedSet.add(messageKey);

      // پاک کردن خودکار cache بعد از مدت زمان مشخص
      setTimeout(() => {
        userProcessedSet.delete(messageKey);
      }, PROCESSED_MESSAGE_CACHE_TIME);

      // Extract channel ID
      let channelId = null;
      if (message.peerId?.channelId) {
        channelId = message.peerId.channelId;
      } else if (message.chatId) {
        channelId = message.chatId;
      } else if (message.chat?.id) {
        channelId = message.chat.id;
      }

      if (!channelId) {
        console.log(`⚠️ No channel ID found in message ${message.id}`);
        return;
      }

      console.log(
        `📍 Processing message ${message.id} from channel: ${channelId}, isEdit: ${isEdit}`
      );

      // Process message for each relevant service
      for (const [serviceId, serviceData] of services.entries()) {
        try {
          const service = serviceData.service;
          const sourceChannels = JSON.parse(service.source_channels);

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
                  `✅ Message ${message.id} matches source channel for service ${serviceId}: ${formattedUsername}`
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
            console.log(
              `🔄 Processing message ${message.id} for service ${serviceId}, isEdit: ${isEdit}`
            );

            await processMessage(
              message,
              isEdit,
              matchedSourceChannelIds,
              service,
              client,
              serviceData.genAI
            );
          }
        } catch (err) {
          console.error(
            `❌ Error processing message ${message.id} for service ${serviceId}:`,
            err
          );
        }
      }
    } catch (err) {
      console.error(`❌ User ${userId} event handler error:`, err);
    }
  };
}

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

    // 🔥 IMPROVED: پاک کردن کامل سرویس‌های قبلی
    await stopUserServices(userId);

    // 🔥 NEW: پاک کردن cache پیام‌های پردازش شده
    cleanProcessedMessagesCache(userId);

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

      // کپی تاریخچه در صورت نیاز
      if (service.type === "copy" && service.copy_history) {
        await startCopyHistory(service, client, userId);
      }
    }

    console.log(`✅ All services started successfully for user ${userId}`);
  } catch (err) {
    console.error(`❌ Error starting user services for ${userId}:`, err);
    throw err;
  }
}

// 🔥 IMPROVED: کپی تاریخچه با جلوگیری از تکرار
async function startCopyHistory(service, client, userId) {
  const taskId = `${userId}_${service.id}`;
  const serviceId = service.id;

  // بررسی اجرای قبلی
  const now = Date.now();
  const lastRun = lastCopyHistoryRunTimestamp.get(serviceId);
  if (lastRun && now - lastRun < MIN_INTERVAL_BETWEEN_COPY_HISTORY_RUNS) {
    console.log(
      `📚 Service ${serviceId}: History copy was run recently. Skipping to prevent duplication.`
    );
    return;
  }

  if (copyHistoryTasks.has(taskId)) {
    const existingTask = copyHistoryTasks.get(taskId);
    if (existingTask.processing) {
      console.log(
        `📚 Service ${serviceId}: History copy task is already processing. Skipping.`
      );
      return;
    }
  }

  console.log(`📚 Service ${serviceId}: Starting history copy processing.`);

  const task = {
    active: true,
    processing: true,
    cancel: () => {
      console.log(`🛑 Cancelling copy history task for service ${serviceId}`);
      task.active = false;
    },
  };
  copyHistoryTasks.set(taskId, task);

  let historyCopySuccessful = false;

  try {
    const sourceChannels = JSON.parse(service.source_channels);
    if (sourceChannels.length === 0) {
      throw new Error(`No source channel defined for copy history.`);
    }

    const sourceChannelUsername = sourceChannels[0];
    const sourceChannelEntity = await client.getEntity(
      sourceChannelUsername.startsWith("@")
        ? sourceChannelUsername
        : `@${sourceChannelUsername}`
    );

    const userServices = activeServices.get(userId);
    const serviceData = userServices?.get(serviceId);

    if (!serviceData) {
      console.log(`⚠️ Service ${serviceId} not found in active services.`);
      task.active = false;
      return;
    }

    if (!messageMaps.has(serviceId)) {
      messageMaps.set(serviceId, loadMessageMap(serviceId));
    }

    let messages = [];
    const limit = Math.min(parseInt(service.history_limit) || 100, 10000);
    const startFromIdStr = service.start_from_id
      ? service.start_from_id.toString().trim()
      : null;
    const copyDirection = service.copy_direction || "before";
    const historyDirection = service.history_direction || "newest";

    console.log(
      `📊 Service ${serviceId} History Copy Settings: limit=${limit}, startFromId=${startFromIdStr}, copyDirection=${copyDirection}, historyDirection=${historyDirection}`
    );

    // 🔥 IMPROVED: دریافت پیام‌ها با جلوگیری از تکرار
    if (startFromIdStr && !isNaN(parseInt(startFromIdStr))) {
      const offsetId = parseInt(startFromIdStr);
      console.log(`📍 Getting messages from specific ID: ${offsetId}`);

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
        if (messages.length > 0) messages.reverse();
      }
    } else {
      console.log(
        `📍 Getting messages by history direction: ${historyDirection}`
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
        if (messages.length > 0) messages.reverse();
      }
    }

    // 🔥 IMPROVED: حذف پیام‌های تکراری
    const uniqueMessages = [];
    const seenMessageIds = new Set();
    const messageMap = messageMaps.get(serviceId);

    for (const message of messages) {
      if (message && message.id && !seenMessageIds.has(message.id)) {
        // بررسی اینکه پیام قبلاً پردازش نشده باشد
        if (!messageMap || !messageMap[message.id]) {
          seenMessageIds.add(message.id);
          uniqueMessages.push(message);
        } else {
          console.log(
            `⚠️ Message ${message.id} already exists in message map. Skipping.`
          );
        }
      }
    }

    console.log(
      `📨 Service ${serviceId}: Found ${messages.length} messages, ${uniqueMessages.length} unique for history copy.`
    );

    let copiedCount = 0;
    let skippedCount = 0;

    // 🔥 IMPROVED: پردازش پیام‌ها با delay بیشتر
    for (let i = 0; i < uniqueMessages.length; i++) {
      if (!task.active) {
        console.log(`🛑 Service ${serviceId}: Copy history task cancelled.`);
        break;
      }

      const message = uniqueMessages[i];
      try {
        console.log(
          `📝 Processing historical message ${message.id} (${i + 1}/${
            uniqueMessages.length
          })`
        );

        const forwardedDetails = await processMessage(
          message,
          false, // isEdit = false for history
          [sourceChannelEntity.id],
          service,
          client,
          serviceData.genAI
        );

        if (forwardedDetails && Object.keys(forwardedDetails).length > 0) {
          copiedCount++;
          console.log(`✅ Message ${message.id} copied successfully`);
        } else {
          skippedCount++;
          console.log(`⚠️ Message ${message.id} was skipped`);
        }

        // 🔥 IMPROVED: delay بیشتر برای جلوگیری از rate limit
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 ثانیه delay
      } catch (err) {
        console.error(
          `❌ Error processing historical message ${message.id}:`,
          err
        );
        skippedCount++;
      }
    }

    console.log(
      `✅ Service ${serviceId}: History copy finished. Copied: ${copiedCount}, Skipped: ${skippedCount}`
    );

    if (task.active) {
      await sendNotificationToUser(
        client,
        `✅ کپی تاریخچه سرویس "${service.name}" تکمیل شد\n📊 کپی شده: ${copiedCount}, رد شده: ${skippedCount}`
      );
      historyCopySuccessful = true;
    }
  } catch (err) {
    console.error(`❌ Service ${serviceId}: Error during history copy:`, err);
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
    console.log(`🏁 Service ${serviceId}: History copy task finished.`);

    if (historyCopySuccessful) {
      lastCopyHistoryRunTimestamp.set(serviceId, Date.now());
      console.log(`⏱️ Service ${serviceId}: Updated last run timestamp.`);
    }
  }
}

// 🔥 IMPROVED: تنظیم Event Handler با جلوگیری از تکرار
async function setupUserEventHandlers(userId) {
  try {
    const userServices = activeServices.get(userId);
    if (!userServices || userServices.size === 0) {
      console.log(`⚠️ No services found for user ${userId}`);
      return;
    }

    const client = await getOrCreateClient(userId);

    // 🔥 IMPROVED: حذف کامل event handler های قبلی
    await cleanupUserEventHandlers(userId);

    // جمع‌آوری همه source channel ها
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

      // 🔥 IMPROVED: استفاده از Raw event با تنظیمات بهتر
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

    // Cancel copy history task
    const taskId = `${userId}_${serviceId}`;
    const copyTask = copyHistoryTasks.get(taskId);
    if (copyTask) {
      copyTask.cancel();
      copyHistoryTasks.delete(taskId);
    }

    const userServices = activeServices.get(userId);
    if (userServices && userServices.has(serviceId)) {
      const serviceData = userServices.get(serviceId);

      if (serviceData.cleanupInterval) {
        clearInterval(serviceData.cleanupInterval);
      }

      const messageMap = messageMaps.get(serviceId);
      if (messageMap) {
        cleanExpiredMessages(serviceId);
        saveMessageMap(serviceId, messageMap);
        messageMaps.delete(serviceId);
      }

      userServices.delete(serviceId);
      lastCopyHistoryRunTimestamp.delete(serviceId);

      if (userServices.size === 0) {
        activeServices.delete(userId);
        await cleanupUserEventHandlers(userId);
        // 🔥 NEW: پاک کردن cache پیام‌های پردازش شده
        cleanProcessedMessagesCache(userId);
      } else {
        await setupUserEventHandlers(userId);
      }

      console.log(`✅ Service ${serviceId} successfully stopped`);
    }
  } catch (err) {
    console.error(`❌ Error stopping service ${serviceId}:`, err);
    throw err;
  }
}

// 🔥 IMPROVED: پاک کردن کامل event handler ها
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
    // Cancel copy history tasks
    const tasksToCancel = [];
    for (const [taskId, task] of copyHistoryTasks.entries()) {
      if (taskId.startsWith(`${userId}_`)) {
        tasksToCancel.push(taskId);
        task.cancel();
      }
    }

    tasksToCancel.forEach((taskId) => {
      copyHistoryTasks.delete(taskId);
    });

    const userServicesMap = activeServices.get(userId);
    if (userServicesMap) {
      for (const serviceId of userServicesMap.keys()) {
        lastCopyHistoryRunTimestamp.delete(serviceId);
      }
    }

    const userServices = activeServices.get(userId);
    if (userServices) {
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

    await cleanupUserEventHandlers(userId);

    // 🔥 NEW: پاک کردن cache پیام‌های پردازش شده
    cleanProcessedMessagesCache(userId);

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
