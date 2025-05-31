const { Raw, NewMessage } = require("telegram/events");
const { getOrCreateClient } = require("./client");
const { processMessage, sendNotificationToUser } = require("./message-handler");
const { loadMessageMap, messageMaps, cleanExpiredMessages } = require("./message-maps");
const { openDb } = require("../../utils/db");

// Store active services
const activeServices = new Map();

async function startForwardingService(service, client, geminiApiKey) {
  try {
    const serviceId = service.id;
    const sourceChannels = JSON.parse(service.source_channels);
    const useAI = Boolean(service.prompt_template);

    console.log(`🚀 Starting service ${serviceId}`);

    // Load message mapping
    const messageMap = loadMessageMap(serviceId);
    messageMaps.set(serviceId, messageMap);

    // Initialize Gemini if needed
    let genAI = null;
    if (useAI && geminiApiKey) {
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      genAI = new GoogleGenerativeAI(geminiApiKey);
      console.log(`🤖 Service ${serviceId}: Initialized Gemini AI`);
    }

    // Get source channel entities
    const sourceEntities = await Promise.all(
      sourceChannels.map(async (username) => {
        try {
          const formattedUsername = username.startsWith("@") ? username : `@${username}`;
          const entity = await client.getEntity(formattedUsername);
          return entity;
        } catch (err) {
          console.error(`❌ Error getting source entity for ${username}:`, err);
          return null;
        }
      })
    );

    const validSourceEntities = sourceEntities.filter(entity => entity !== null);
    const sourceChannelIds = validSourceEntities.map(entity => entity.id);

    if (validSourceEntities.length === 0) {
      throw new Error(`Service ${serviceId}: No valid source channels found`);
    }

    // Send activation message
    const activationTime = new Date().toLocaleString("fa-IR", { timeZone: "Asia/Tehran" });
    await sendNotificationToUser(client, `🟢 سرویس "${service.name}" فعال شد\n⏰ ${activationTime}`);

    // Create event handler
    const eventHandler = async (update) => {
      try {
        let message = null;
        let isEdit = false;

        if (update.className === "UpdateNewChannelMessage" && update.message) {
          message = update.message;
        } else if (update.className === "UpdateEditChannelMessage" && update.message) {
          message = update.message;
          isEdit = true;
        } else if (update.className === "UpdateNewMessage" && update.message) {
          message = update.message;
        } else if (update.className === "UpdateEditMessage" && update.message) {
          message = update.message;
          isEdit = true;
        }

        if (message) {
          await processMessage(message, isEdit, sourceChannelIds, service, client, genAI);
        }
      } catch (err) {
        console.error(`❌ Service ${serviceId}: Event handler error:`, err);
      }
    };

    // Set up event handlers
    const hasUserSource = validSourceEntities.some(entity => entity.className === "User");

    if (hasUserSource) {
      client.addEventHandler(async (event) => {
        try {
          const message = event.message;
          if (!message || !message.peerId) return;

          const sender = await message.getSender();
          if (!sender || sender.className !== "User") return;

          const senderId = sender.id?.toString();
          const sourceUserIds = sourceChannelIds.map(id => id.toString());

          if (!sourceUserIds.includes(senderId)) return;

          await processMessage(message, false, sourceChannelIds, service, client, genAI);
        } catch (err) {
          console.error(`❌ Service ${serviceId}: User message handler error:`, err);
        }
      }, new NewMessage({ incoming: true }));
    } else {
      client.addEventHandler(eventHandler, new Raw({ chats: sourceChannelIds }));
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
      eventHandler,
      cleanupInterval
    });

    console.log(`✅ Service ${serviceId} started for user ${service.user_id}`);
  } catch (err) {
    console.error(`❌ Error starting service ${service.id}:`, err);
    throw err;
  }
}

async function startUserServices(userId) {
  try {
    const db = await openDb();
    
    const user = await db.get(`
      SELECT u.telegram_session, us.gemini_api_key
      FROM users u
      LEFT JOIN user_settings us ON u.id = us.user_id
      WHERE u.id = ?
    `, [userId]);

    if (!user?.telegram_session) {
      console.log("No Telegram session found for user:", userId);
      return;
    }

    const services = await db.all(
      "SELECT * FROM forwarding_services WHERE user_id = ? AND is_active = 1",
      [userId]
    );

    if (services.length === 0) {
      console.log("No active services found for user:", userId);
      return;
    }

    const client = await getOrCreateClient(userId, user.telegram_session);

    for (const service of services) {
      await startForwardingService(service, client, user.gemini_api_key);
    }
  } catch (err) {
    console.error("Error starting user services:", err);
    throw err;
  }
}

async function stopService(userId, serviceId) {
  try {
    const userServices = activeServices.get(userId);
    if (userServices) {
      const serviceData = userServices.get(serviceId);
      if (serviceData) {
        const client = await getOrCreateClient(userId);
        if (client) {
          client.removeEventHandler(serviceData.eventHandler);
        }

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
      }
    }
  } catch (err) {
    console.error("Error stopping service:", err);
  }
}

async function stopUserServices(userId) {
  try {
    const userServices = activeServices.get(userId);
    if (userServices) {
      for (const [serviceId, serviceData] of userServices.entries()) {
        await stopService(userId, serviceId);
      }
      activeServices.delete(userId);
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
  startForwardingService,
  startUserServices,
  stopService,
  stopUserServices,
  initializeAllServices
};