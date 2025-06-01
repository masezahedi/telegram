import { Raw, NewMessage } from "telegram/events";
import { getOrCreateClient } from "./client";
import { processMessage, sendNotificationToUser } from "./message-handler";
import {
  messageMaps,
  loadMessageMap,
  saveMessageMap,
  cleanExpiredMessages,
} from "./message-maps";
import { openDb } from "../../utils/db";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Store active services
const activeServices = new Map();
// Store user event handlers (one per user)
const userEventHandlers = new Map();
// Store copy history tasks
const copyHistoryTasks = new Map();

// Event handler that handles both new messages and edits
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
        // Ignore other update types
        return;
      }

      if (!message) {
        console.log(`⚠️ No message found in update`);
        return;
      }

      // Extract channel ID more accurately
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
        `📍 Processing message from channel: ${channelId}, isEdit: ${isEdit}`
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
            console.log(
              `🔄 Processing message for service ${serviceId}, isEdit: ${isEdit}`
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

    await stopUserServices(userId);

    for (const service of services) {
      await startForwardingService(service, client, user.gemini_api_key);
    }

    await setupUserEventHandlers(userId);

    for (const service of services) {
      const activationTime = new Date().toLocaleString("fa-IR", {
        timeZone: "Asia/Tehran",
      });
      await sendNotificationToUser(
        client,
        `🟢 سرویس "${service.name}" فعال شد\n⏰ ${activationTime}`
      );

      if (service.type === "copy" && service.copy_history) {
        console.log(`📚 Service ${service.id}: Starting history copy`);
        try {
          const sourceChannels = JSON.parse(service.source_channels);
          const sourceChannel = await client.getEntity(
            sourceChannels[0].startsWith("@")
              ? sourceChannels[0]
              : `@${sourceChannels[0]}`
          );

          const taskId = `${userId}_${service.id}`;
          const task = {
            active: true,
            cancel: () => {
              task.active = false;
            },
          };
          copyHistoryTasks.set(taskId, task);

          const historyDirection = service.history_direction || "newest";
          const startFromId = service.start_from_id;
          const copyDirection = service.copy_direction || "before";
          const limit = service.history_limit || 100;

          let messages;
          if (startFromId) {
            const offsetId = parseInt(startFromId);
            messages = await client.getMessages(sourceChannel, {
              limit: limit,
              offsetId: offsetId,
              reverse: copyDirection === "before",
              addOffset: copyDirection === "after" ? 1 : 0,
            });
          } else {
            messages = await client.getMessages(sourceChannel, {
              limit: limit,
              reverse: historyDirection === "oldest",
            });
          }

          const userServices = activeServices.get(userId);
          const serviceData = userServices.get(service.id);

          for (const message of messages) {
            if (!copyHistoryTasks.get(taskId)?.active) {
              console.log(
                `🛑 Service ${service.id}: Copy history task cancelled`
              );
              break;
            }

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

          copyHistoryTasks.delete(taskId);
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

async function setupUserEventHandlers(userId) {
  try {
    const userServices = activeServices.get(userId);
    if (!userServices || userServices.size === 0) {
      console.log(`⚠️ No services found for user ${userId}`);
      return;
    }

    const client = await getOrCreateClient(userId);

    const existingHandlers = userEventHandlers.get(userId) || [];
    for (const handler of existingHandlers) {
      client.removeEventHandler(handler);
    }

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

    const taskId = `${userId}_${serviceId}`;
    const copyTask = copyHistoryTasks.get(taskId);
    if (copyTask) {
      copyTask.cancel();
      copyHistoryTasks.delete(taskId);
      console.log(`🛑 Copy history task cancelled for service ${serviceId}`);
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
        client.removeEventHandler(handler);
        console.log(`🔌 Event handler removed for user ${userId}`);
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

export {
  activeServices,
  userEventHandlers,
  startForwardingService,
  startUserServices,
  stopService,
  stopUserServices,
  initializeAllServices,
};
