const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
const API_ID = 24554364;
const API_HASH = "5db6997246b3bc3b6a8ac6097b1ef937";

const app = express();

// Update CORS configuration
app.use(
  cors({
    origin: "*", // Be more specific in production
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// Database connection
let db = null;
async function openDb() {
  if (db) return db;

  db = await open({
    filename: "./data.sqlite",
    driver: sqlite3.Database,
  });

  return db;
}

// Verify JWT token
async function verifyToken(token) {
  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error("Token verification error:", error);
    return null;
  }
}

// Active clients and services store
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
      genAI = new GoogleGenerativeAI(geminiApiKey);
      console.log("Initialized Gemini AI");
    }

    // Get source channel entities
    const sourceEntities = await Promise.all(
      sourceChannels.map(async (username) => {
        try {
          const formattedUsername = username.startsWith("@")
            ? username
            : `@${username}`;
          const entity = await client.getEntity(formattedUsername);
          console.log(
            `Successfully connected to source channel: ${formattedUsername}`,
            {
              id: entity.id,
              username: entity.username,
              type: entity.className,
            }
          );
          return entity;
        } catch (err) {
          console.error(`Error getting source entity for ${username}:`, err);
          return null;
        }
      })
    );

    const validSourceEntities = sourceEntities.filter(
      (entity) => entity !== null
    );
    console.log(
      `Valid source channels: ${validSourceEntities.length}`,
      validSourceEntities.map((e) => ({ id: e.id, username: e.username }))
    );

    // Get target channel entities
    const targetEntities = await Promise.all(
      targetChannels.map(async (username) => {
        try {
          const formattedUsername = username.startsWith("@")
            ? username
            : `@${username}`;
          const entity = await client.getEntity(formattedUsername);
          console.log(
            `Successfully connected to target channel: ${formattedUsername}`,
            {
              id: entity.id,
              username: entity.username,
              type: entity.className,
            }
          );
          return entity;
        } catch (err) {
          console.error(`Error getting target entity for ${username}:`, err);
          return null;
        }
      })
    );

    const validTargetEntities = targetEntities.filter(
      (entity) => entity !== null
    );
    console.log(
      `Valid target channels: ${validTargetEntities.length}`,
      validTargetEntities.map((e) => ({ id: e.id, username: e.username }))
    );

    if (validTargetEntities.length === 0) {
      throw new Error("No valid target channels found");
    }

    // Send activation message to user
    const activationTime = new Date().toLocaleString("fa-IR", {
      timeZone: "Asia/Tehran",
    });
    const activationMessage = `🟢 سرویس "${service.name}" فعال شد\n⏰ ${activationTime}`;
    await sendNotificationToUser(client, activationMessage);

    // Create event handler for new messages
    const eventHandler = async (event) => {
      try {
        console.log("Received new message event", {
          messageId: event.message?.id,
          fromId: event.message?.fromId,
          peerId: event.message?.peerId,
        });

        const message = event.message;
        if (!message) {
          console.log("No message in event");
          return;
        }

        const channelId = message.peerId?.channelId;
        console.log("Message channel ID:", channelId);

        if (!channelId) {
          console.log("Not a channel message");
          return;
        }

        const sourceEntity = validSourceEntities.find((entity) => {
          const sourceId = entity.id.value;
          const msgChannelId = channelId.value;
          const match = sourceId === msgChannelId;
          console.log("Comparing channel IDs:", {
            sourceId,
            messageChannelId: msgChannelId,
            matches: match,
          });
          return match;
        });

        if (!sourceEntity) {
          console.log(
            "Message not from source channel. Source channels:",
            validSourceEntities.map((e) => ({ id: e.id, username: e.username }))
          );
          return;
        }

        console.log(
          `Processing message from channel: ${sourceEntity.username}`
        );

        let text = message.message || "";
        let media = message.media;

        if (media && media.caption) {
          text = media.caption;
        }

        if (useAI && genAI && text) {
          try {
            console.log("Processing text with AI");
            const model = genAI.getGenerativeModel({
              model: "gemini-2.0-flash",
            });
            const prompt = createPromptTemplate(text, promptTemplate);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            text = response.text().trim();
            console.log("AI processing successful");
          } catch (err) {
            console.error("AI processing error:", err);
            console.log("Using original text due to AI error");
          }
        }

        if (text && searchReplaceRules.length > 0) {
          console.log("Applying search/replace rules");
          for (const rule of searchReplaceRules) {
            if (rule.search && rule.replace) {
              text = text.replace(new RegExp(rule.search, "g"), rule.replace);
            }
          }
        }

        for (const targetEntity of validTargetEntities) {
          try {
            console.log(`Forwarding to channel: ${targetEntity.username}`);
            if (media) {
              await client.sendFile(targetEntity, {
                file: media,
                caption: text || undefined,
                forceDocument: false,
                parseMode: "html",
              });
              console.log("Media message forwarded successfully");
            } else if (text) {
              await client.sendMessage(targetEntity, {
                message: text,
                parseMode: "html",
              });
              console.log("Text message forwarded successfully");
            }
          } catch (err) {
            console.error(`Error forwarding to ${targetEntity.username}:`, err);
          }
        }
      } catch (err) {
        console.error("Message handling error:", err);
      }
    };

    const sourceIds = validSourceEntities.map((entity) => entity.id);
    console.log("Setting up event handler for source channels:", sourceIds);

    client.addEventHandler(
      eventHandler,
      new NewMessage({
        chats: sourceIds,
        incoming: true,
      })
    );

    console.log(`Service ${serviceId} started successfully`);

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

// Start all active services for a user
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
      `
      SELECT *
      FROM forwarding_services
      WHERE user_id = ? AND is_active = 1
    `,
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

    console.log(`Started ${services.length} services for user:`, userId);
  } catch (err) {
    console.error("Error starting user services:", err);
    throw err;
  }
}

// Stop specific service for a user
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

// Initialize all active services on server start
async function initializeAllServices() {
  try {
    const db = await openDb();

    // Get all users with active services
    const users = await db.all(`
      SELECT DISTINCT u.id
      FROM users u
      INNER JOIN forwarding_services fs ON u.id = fs.user_id
      WHERE fs.is_active = 1
    `);

    console.log(`Found ${users.length} users with active services`);

    // Start services for each user
    for (const user of users) {
      await startUserServices(user.id);
    }

    console.log("All active services initialized successfully");
  } catch (err) {
    console.error("Error initializing services:", err);
  }
}

// API Routes
app.post("/sendCode", async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const client = new TelegramClient(new StringSession(""), API_ID, API_HASH);

    await client.connect();

    const result = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId: API_ID,
        apiHash: API_HASH,
        settings: new Api.CodeSettings({}),
      })
    );

    activeClients.set(phoneNumber, {
      client,
      phoneCodeHash: result.phoneCodeHash,
    });

    res.json({
      success: true,
      phoneCodeHash: result.phoneCodeHash,
    });
  } catch (err) {
    console.error("Error in sendCode:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/signIn", async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    const data = activeClients.get(phoneNumber);

    if (!data) {
      return res.status(400).json({
        error: "No active session found for this phone number",
      });
    }

    const { client, phoneCodeHash } = data;

    if (!client.connected) {
      await client.connect();
    }

    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode: code,
      })
    );

    const stringSession = client.session.save();
    activeClients.delete(phoneNumber);

    res.json({ success: true, stringSession });
  } catch (err) {
    console.error("Error in signIn:", err);
    if (err.message.includes("SESSION_PASSWORD_NEEDED")) {
      res.json({ requires2FA: true });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

app.post("/checkPassword", async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    const data = activeClients.get(phoneNumber);

    if (!data) {
      return res.status(400).json({
        error: "Session expired or invalid",
      });
    }

    const { client } = data;

    if (!client.connected) {
      await client.connect();
    }

    const passwordSrp = await client.invoke(new Api.account.GetPassword());
    const { computeCheck } = require("telegram/Password");
    const passwordHash = await computeCheck(passwordSrp, password);

    await client.invoke(
      new Api.auth.CheckPassword({
        password: passwordHash,
      })
    );

    const stringSession = client.session.save();
    activeClients.delete(phoneNumber);

    res.json({
      success: true,
      stringSession,
    });
  } catch (err) {
    console.error("Error in checkPassword:", err);
    res.status(500).json({ error: err.message });
  }
});

// Service management routes
app.post("/services/start", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await startUserServices(decoded.userId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error starting services:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/services/stop", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await stopUserServices(decoded.userId);
    res.json({ success: true });
  } catch (err) {
    console.error("Error stopping services:", err);
    res.status(500).json({ error: err.message });
  }
});

// Initialize all services on server start
initializeAllServices();

// Update server listening configuration
const PORT = process.env.PORT || 1332;
const HOST = "0.0.0.0"; // Listen on all network interfaces

app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
