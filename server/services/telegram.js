const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { API_ID, API_HASH } = require("../config");
const { openDb } = require("../utils/db");

// Store active clients and services
const activeClients = new Map();
const activeServices = new Map();

// Create prompt template for Gemini
const createPromptTemplate = (originalText, customTemplate) => {
  if (!customTemplate) {
    return originalText;
  }

  try {
    return `${customTemplate}: ${originalText}`;
  } catch (err) {
    console.error("Error applying prompt template:", err);
    return originalText;
  }
};

// Send notification to user
async function sendNotificationToUser(client, message) {
  try {
    const me = await client.getMe();
    await client.sendMessage(me, { message });
    console.log("Notification sent to user");
  } catch (err) {
    console.error("Error sending notification to user:", err);
  }
}

// Start forwarding service
async function startForwardingService(service, client, geminiApiKey) {
  try {
    const serviceId = service.id;
    const sourceChannels = JSON.parse(service.source_channels);
    const targetChannels = JSON.parse(service.target_channels);
    const searchReplaceRules = JSON.parse(service.search_replace_rules);
    const useAI = Boolean(service.prompt_template);
    const promptTemplate = service.prompt_template;

    console.log("Starting service with configuration:", {
      serviceId,
      sourceChannels,
      targetChannels,
      useAI,
      hasPromptTemplate: Boolean(promptTemplate),
    });

    // Initialize Gemini if API key is provided and AI is enabled
    let genAI = null;
    if (useAI && geminiApiKey) {
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      genAI = new GoogleGenerativeAI(geminiApiKey);
      console.log("Initialized Gemini AI");
    }

    // Get source and target entities
    const sourceEntities = await Promise.all(
      sourceChannels.map((username) => getChannelEntity(client, username))
    );
    const targetEntities = await Promise.all(
      targetChannels.map((username) => getChannelEntity(client, username))
    );

    const validSourceEntities = sourceEntities.filter((e) => e !== null);
    const validTargetEntities = targetEntities.filter((e) => e !== null);

    if (validTargetEntities.length === 0) {
      throw new Error("No valid target channels found");
    }

    // Send activation message
    const activationTime = new Date().toLocaleString("fa-IR", {
      timeZone: "Asia/Tehran",
    });
    await sendNotificationToUser(
      client,
      `🟢 سرویس "${service.name}" فعال شد\n⏰ ${activationTime}`
    );

    // Create message handler
    const eventHandler = createMessageHandler(
      validSourceEntities,
      validTargetEntities,
      genAI,
      searchReplaceRules,
      promptTemplate,
      client
    );

    // Set up event handler
    const sourceIds = validSourceEntities.map((entity) => entity.id);
    client.addEventHandler(eventHandler, new NewMessage({ chats: sourceIds }));

    // Store active service
    if (!activeServices.has(service.user_id)) {
      activeServices.set(service.user_id, new Map());
    }
    activeServices.get(service.user_id).set(serviceId, eventHandler);

    console.log(`Service ${serviceId} started for user ${service.user_id}`);
  } catch (err) {
    console.error("Error starting forwarding service:", err);
    throw err;
  }
}

// Get channel entity
async function getChannelEntity(client, username) {
  try {
    const formattedUsername = username.startsWith("@") ? username : `@${username}`;
    const entity = await client.getEntity(formattedUsername);
    console.log(`Successfully connected to channel: ${formattedUsername}`, {
      id: entity.id,
      username: entity.username,
      type: entity.className,
    });
    return entity;
  } catch (err) {
    console.error(`Error getting entity for ${username}:`, err);
    return null;
  }
}

// Create message handler
function createMessageHandler(
  sourceEntities,
  targetEntities,
  genAI,
  searchReplaceRules,
  promptTemplate,
  client
) {
  return async (event) => {
    try {
      const message = event.message;
      if (!message?.peerId?.channelId) return;

      const channelId = message.peerId.channelId;
      const sourceEntity = sourceEntities.find(
        (entity) => entity.id.value === channelId.value
      );

      if (!sourceEntity) return;

      let text = message.message || "";
      let media = message.media;

      if (media?.caption) {
        text = media.caption;
      }

      // Process with AI if enabled
      if (genAI && text) {
        try {
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          const prompt = createPromptTemplate(text, promptTemplate);
          const result = await model.generateContent(prompt);
          const response = await result.response;
          text = response.text().trim();
        } catch (err) {
          console.error("AI processing error:", err);
        }
      }

      // Apply search/replace rules
      if (text && searchReplaceRules.length > 0) {
        for (const rule of searchReplaceRules) {
          if (rule.search && rule.replace) {
            text = text.replace(new RegExp(rule.search, "g"), rule.replace);
          }
        }
      }

      // Forward to target channels
      for (const targetEntity of targetEntities) {
        try {
          if (media) {
            await client.sendFile(targetEntity, {
              file: media,
              caption: text || undefined,
              forceDocument: false,
              parseMode: "html",
            });
          } else if (text) {
            await client.sendMessage(targetEntity, {
              message: text,
              parseMode: "html",
            });
          }
        } catch (err) {
          console.error(`Error forwarding to ${targetEntity.username}:`, err);
        }
      }
    } catch (err) {
      console.error("Message handling error:", err);
    }
  };
}

// Start all services for a user
async function startUserServices(userId) {
  try {
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
      console.log("No Telegram session found for user:", userId);
      return;
    }

    const services = await db.all(
      `SELECT * FROM forwarding_services WHERE user_id = ? AND is_active = 1`,
      [userId]
    );

    if (services.length === 0) {
      console.log("No active services found for user:", userId);
      return;
    }

    let client = activeClients.get(userId);
    if (!client) {
      client = new TelegramClient(
        new StringSession(user.telegram_session),
        API_ID,
        API_HASH,
        {
          connectionRetries: 5,
          useWSS: true,
        }
      );

      await client.connect();
      if (!(await client.isUserAuthorized())) {
        throw new Error("Telegram session is invalid");
      }

      activeClients.set(userId, client);
    }

    for (const service of services) {
      await startForwardingService(service, client, user.gemini_api_key);
    }
  } catch (err) {
    console.error("Error starting user services:", err);
    throw err;
  }
}

// Stop specific service
async function stopService(userId, serviceId) {
  try {
    const userServices = activeServices.get(userId);
    if (userServices) {
      const eventHandler = userServices.get(serviceId);
      if (eventHandler) {
        const client = activeClients.get(userId);
        if (client) {
          client.removeEventHandler(eventHandler);
        }
        userServices.delete(serviceId);

        if (userServices.size === 0) {
          if (client) {
            await client.disconnect();
          }
          activeClients.delete(userId);
          activeServices.delete(userId);
        }
      }
    }
  } catch (err) {
    console.error("Error stopping service:", err);
  }
}

// Stop all services for a user
async function stopUserServices(userId) {
  try {
    const userServices = activeServices.get(userId);
    if (userServices) {
      const client = activeClients.get(userId);
      if (client) {
        for (const eventHandler of userServices.values()) {
          client.removeEventHandler(eventHandler);
        }
        await client.disconnect();
      }
      activeServices.delete(userId);
      activeClients.delete(userId);
    }
  } catch (err) {
    console.error("Error stopping user services:", err);
  }
}

// Initialize all services
async function initializeAllServices() {
  try {
    const db = await openDb();
    const users = await db.all(`
      SELECT DISTINCT u.id
      FROM users u
      INNER JOIN forwarding_services fs ON u.id = fs.user_id
      WHERE fs.is_active = 1
    `);

    console.log(`Found ${users.length} users with active services`);

    for (const user of users) {
      await startUserServices(user.id);
    }

    console.log('All active services initialized successfully');
  } catch (err) {
    console.error('Error initializing services:', err);
  }
}

module.exports = {
  activeClients,
  startForwardingService,
  startUserServices,
  stopService,
  stopUserServices,
  initializeAllServices,
};