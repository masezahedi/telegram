const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage, Raw } = require("telegram/events");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
const API_ID = 24554364;
const API_HASH = "5db6997246b3bc3b6a8ac6097b1ef937";

const app = express();

// Environment configuration
const isProduction = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 3332;
const HOST = isProduction ? "0.0.0.0" : "localhost";

// CORS configuration
const corsOptions = {
  origin: isProduction
    ? [
        "https://sna.freebotmoon.ir",
        "http://sna.freebotmoon.ir",
        "https://sna.freebotmoon.ir:1332",
        "http://sna.freebotmoon.ir:1332",
      ]
    : [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3332",
        "http://localhost:1332",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:1332",
        "http://127.0.0.1:3332",
      ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
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
const messageMaps = new Map(); // برای نگهداری message mapping هر سرویس

// مدت زمان نگهداری پیام‌ها (2 ساعت)
const MESSAGE_EXPIRY_TIME = 2 * 60 * 60 * 1000;

// تابع‌های مدیریت message mapping
function getMessageMapFile(serviceId) {
  return path.join(__dirname, `service_${serviceId}_message_mapping.json`);
}

function loadMessageMap(serviceId) {
  try {
    const filePath = getMessageMapFile(serviceId);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(data);

      const currentTime = Date.now();
      const loadedMap = new Map();

      for (const [key, value] of Object.entries(parsed)) {
        if (currentTime - value.timestamp < MESSAGE_EXPIRY_TIME) {
          loadedMap.set(key, value);
        }
      }

      console.log(
        `📁 Service ${serviceId}: ${loadedMap.size} پیام فعال از فایل بارگذاری شد`
      );
      return loadedMap;
    }
  } catch (err) {
    console.error(`❌ خطا در خواندن فایل mapping سرویس ${serviceId}:`, err);
  }
  return new Map();
}

function saveMessageMap(serviceId, messageMap) {
  try {
    const filePath = getMessageMapFile(serviceId);
    const obj = Object.fromEntries(messageMap);
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error(`❌ خطا در ذخیره فایل mapping سرویس ${serviceId}:`, err);
  }
}

function cleanExpiredMessages(serviceId) {
  const messageMap = messageMaps.get(serviceId);
  if (!messageMap) return;

  const currentTime = Date.now();
  let removedCount = 0;

  for (const [key, value] of messageMap.entries()) {
    if (currentTime - value.timestamp >= MESSAGE_EXPIRY_TIME) {
      messageMap.delete(key);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(
      `🗑️ Service ${serviceId}: ${removedCount} پیام منقضی شده حذف شد`
    );
    saveMessageMap(serviceId, messageMap);
  }
}

// Create prompt template for Gemini with improved logic
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

// تابع پردازش پیام با منطق بهبود یافته
async function processMessage(
  message,
  isEdit,
  sourceChannelIds,
  service,
  client,
  genAI
) {
  try {
    const serviceId = service.id;
    const targetChannels = JSON.parse(service.target_channels);
    const searchReplaceRules = JSON.parse(service.search_replace_rules);
    const useAI = Boolean(service.prompt_template);
    const promptTemplate = service.prompt_template;

    console.log(
      `📨 Service ${serviceId}: ${
        isEdit ? "پیام ادیت شده" : "پیام جدید"
      } (ID: ${message.id})`
    );

    if (!message) {
      console.log(`⛔ Service ${serviceId}: پیام خالی`);
      return;
    }

    // بررسی اینکه پیام از کانال مبدا باشد
    const channelId = message.peerId?.channelId || message.chatId;
    let isFromSourceChannel = false;

    for (const sourceId of sourceChannelIds) {
      if (channelId && channelId.toString() === sourceId.toString()) {
        isFromSourceChannel = true;
        break;
      }
    }

    if (!isFromSourceChannel) {
      console.log(
        `⛔ Service ${serviceId}: پیام از کانال غیرمبدا نادیده گرفته شد`
      );
      return;
    }

    const originalText = message.message || message.caption;

    // بررسی رسانه
    const hasMedia =
      message.media &&
      message.media.className !== "MessageMediaEmpty" &&
      message.media.className !== "MessageMediaWebPage";

    if (!originalText && !hasMedia) {
      console.log(
        `⛔ Service ${serviceId}: پیام بدون متن و رسانه نادیده گرفته شد`
      );
      return;
    }

    // مدیریت message mapping
    const messageMap = messageMaps.get(serviceId) || new Map();
    if (!messageMaps.has(serviceId)) {
      messageMaps.set(serviceId, messageMap);
    }

    const messageKey = `${channelId}_${message.id}`;
    const currentTime = Date.now();

    if (originalText) {
      console.log(
        `📝 Service ${serviceId}: متن: ${originalText.substring(0, 100)}${
          originalText.length > 100 ? "..." : ""
        }`
      );
    }

    if (hasMedia) {
      console.log(`📷 Service ${serviceId}: رسانه: ${message.media.className}`);
    }

    // بررسی انقضا برای ادیت
    if (isEdit) {
      const existingMessage = messageMap.get(messageKey);

      if (
        !existingMessage ||
        currentTime - existingMessage.timestamp >= MESSAGE_EXPIRY_TIME
      ) {
        console.log(
          `⏰ Service ${serviceId}: پیام ادیت شده ولی بیش از 2 ساعت گذشته`
        );
        if (existingMessage) {
          messageMap.delete(messageKey);
          saveMessageMap(serviceId, messageMap);
        }
        return;
      }
    }

    let processedText = "";

    // پردازش با AI
    if (originalText) {
      if (useAI && genAI) {
        try {
          console.log(`🤖 Service ${serviceId}: پردازش با AI`);
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          const prompt = createPromptTemplate(originalText, promptTemplate);
          const result = await model.generateContent(prompt);
          const response = await result.response;
          processedText = response.text().trim();
          console.log(`✅ Service ${serviceId}: AI پردازش موفق`);
        } catch (err) {
          console.error(`❌ Service ${serviceId}: خطا در AI:`, err);
          processedText = originalText;
        }
      } else {
        processedText = originalText;
      }

      // اعمال قوانین جستجو و جایگزینی
      if (searchReplaceRules && searchReplaceRules.length > 0) {
        console.log(`🔄 Service ${serviceId}: اعمال قوانین جستجو و جایگزینی`);
        for (const rule of searchReplaceRules) {
          if (rule.search && rule.replace) {
            processedText = processedText.replace(
              new RegExp(rule.search, "g"),
              rule.replace
            );
          }
        }
      }
    }

    // ارسال به کانال‌های مقصد
    for (const targetUsername of targetChannels) {
      try {
        const formattedUsername = targetUsername.startsWith("@")
          ? targetUsername
          : `@${targetUsername}`;
        const targetEntity = await client.getEntity(formattedUsername);

        if (isEdit && messageMap.has(messageKey)) {
          // ادیت پیام موجود
          const existingMessage = messageMap.get(messageKey);
          const targetMessageId =
            existingMessage.targetMessageIds?.[targetUsername];

          if (targetMessageId) {
            try {
              await client.editMessage(targetEntity, {
                message: parseInt(targetMessageId),
                text: processedText,
              });
              console.log(
                `✅ Service ${serviceId}: پیام ادیت شد در ${targetUsername}`
              );

              // به‌روزرسانی timestamp
              messageMap.set(messageKey, {
                ...existingMessage,
                timestamp: currentTime,
              });
            } catch (editError) {
              console.error(
                `❌ Service ${serviceId}: خطا در ادیت پیام در ${targetUsername}:`,
                editError.message
              );

              // ارسال پیام جدید در صورت عدم موفقیت ادیت
              const sentMessage = await sendNewMessage(
                message,
                processedText,
                targetEntity,
                hasMedia,
                client
              );
              if (sentMessage) {
                if (!existingMessage.targetMessageIds) {
                  existingMessage.targetMessageIds = {};
                }
                existingMessage.targetMessageIds[targetUsername] =
                  sentMessage.id.toString();
                existingMessage.timestamp = currentTime;
                messageMap.set(messageKey, existingMessage);
              }
            }
          }
        } else {
          // ارسال پیام جدید
          const sentMessage = await sendNewMessage(
            message,
            processedText,
            targetEntity,
            hasMedia,
            client
          );
          if (sentMessage) {
            const messageData = messageMap.get(messageKey) || {
              targetMessageIds: {},
              timestamp: currentTime,
            };
            messageData.targetMessageIds[targetUsername] =
              sentMessage.id.toString();
            messageData.timestamp = currentTime;
            messageMap.set(messageKey, messageData);
            console.log(
              `💾 Service ${serviceId}: پیام mapping ذخیره شد: ${messageKey} -> ${sentMessage.id}`
            );
          }
        }
      } catch (err) {
        console.error(
          `❌ Service ${serviceId}: خطا در ارسال به ${targetUsername}:`,
          err
        );
      }
    }

    // ذخیره mapping
    saveMessageMap(serviceId, messageMap);
  } catch (err) {
    console.error(`❌ Service ${service.id}: خطا در پردازش پیام:`, err);
  }
}

// تابع ارسال پیام جدید
async function sendNewMessage(
  message,
  finalText,
  targetChannel,
  hasValidMedia,
  client
) {
  try {
    let sentMessage;

    if (hasValidMedia) {
      console.log(`📤 ارسال رسانه نوع: ${message.media.className}`);
      sentMessage = await client.sendFile(targetChannel, {
        file: message.media,
        caption: finalText,
        forceDocument: false,
        parseMode: "html",
      });
    } else {
      console.log("📤 ارسال پیام متنی");
      sentMessage = await client.sendMessage(targetChannel, {
        message: finalText,
        parseMode: "html",
      });
    }

    console.log("✅ پیام جدید ارسال شد");
    return sentMessage;
  } catch (err) {
    console.error("❌ خطا در ارسال پیام:", err);
    return null;
  }
}

// Start forwarding service with improved logic
async function startForwardingService(service, client, geminiApiKey) {
  try {
    const serviceId = service.id;
    const sourceChannels = JSON.parse(service.source_channels);
    const useAI = Boolean(service.prompt_template);

    console.log(`🚀 Starting service ${serviceId} with configuration:`, {
      serviceId,
      sourceChannels,
      useAI,
      hasPromptTemplate: Boolean(service.prompt_template),
    });

    // بارگذاری message mapping
    const messageMap = loadMessageMap(serviceId);
    messageMaps.set(serviceId, messageMap);

    // Initialize Gemini if needed
    let genAI = null;
    if (useAI && geminiApiKey) {
      genAI = new GoogleGenerativeAI(geminiApiKey);
      console.log(`🤖 Service ${serviceId}: Initialized Gemini AI`);
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
            `✅ Service ${serviceId}: Connected to source channel: ${formattedUsername}`,
            {
              id: entity.id,
              username: entity.username,
              type: entity.className,
            }
          );
          return entity;
        } catch (err) {
          console.error(
            `❌ Service ${serviceId}: Error getting source entity for ${username}:`,
            err
          );
          return null;
        }
      })
    );

    const validSourceEntities = sourceEntities.filter(
      (entity) => entity !== null
    );
    const sourceChannelIds = validSourceEntities.map((entity) => entity.id);

    console.log(
      `📊 Service ${serviceId}: Valid source channels: ${validSourceEntities.length}`
    );

    if (validSourceEntities.length === 0) {
      throw new Error(`Service ${serviceId}: No valid source channels found`);
    }

    // Send activation message
    const activationTime = new Date().toLocaleString("fa-IR", {
      timeZone: "Asia/Tehran",
    });
    const activationMessage = `🟢 سرویس "${service.name}" فعال شد\n⏰ ${activationTime}`;
    await sendNotificationToUser(client, activationMessage);

    // Create enhanced event handler using Raw events
    const eventHandler = async (update) => {
      try {
        let message = null;
        let isEdit = false;

        // تشخیص نوع update
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
        }

        if (message) {
          console.log(`📥 Service ${serviceId}: Received ${update.className}`);
          await processMessage(
            message,
            isEdit,
            sourceChannelIds,
            service,
            client,
            genAI
          );
        }
      } catch (err) {
        console.error(`❌ Service ${serviceId}: Event handler error:`, err);
      }
    };

    // استفاده از Raw event handler برای دریافت همه انواع update ها

    // اگر یکی از sourceChannel ها از نوع User باشد، رویدادهای incoming را نیز گوش بده
    const hasUserSource = validSourceEntities.some(
      (entity) => entity.className === "User"
    );

    if (hasUserSource) {
      client.addEventHandler(async (event) => {
        try {
          const message = event.message;
          if (!message || !message.peerId) return;

          // فقط پیام‌های دریافتی از کاربران
          const sender = await message.getSender();
          if (!sender || sender.className !== "User") return;

          const senderId = sender.id?.toString();
          const sourceUserIds = sourceChannelIds.map((id) => id.toString());

          if (!sourceUserIds.includes(senderId)) {
            console.log(
              `⛔ پیام از کاربری دریافت شد (${senderId}) که جزو منابع نیست`
            );
            return;
          }

          console.log(
            `📥 Service ${serviceId}: پیام جدید از user ${
              sender.username || senderId
            }`
          );

          await processMessage(
            message,
            false, // isEdit = false
            sourceChannelIds,
            service,
            client,
            genAI
          );
        } catch (err) {
          console.error(
            `❌ Service ${serviceId}: خطا در دریافت پیام کاربر:`,
            err
          );
        }
      }, new NewMessage({ incoming: true }));

      console.log(
        `✅ Service ${serviceId}: Event handler مخصوص پیام‌های کاربران ثبت شد`
      );
    } else {
      client.addEventHandler(
        eventHandler,
        new Raw({
          chats: sourceChannelIds,
        })
      );
    }

    console.log(
      `✅ Service ${serviceId}: Event handler registered for ${validSourceEntities.length} source channels`
    );

    // تنظیم تایمر پاک‌سازی
    const cleanupInterval = setInterval(() => {
      cleanExpiredMessages(serviceId);
    }, 30 * 60 * 1000); // هر 30 دقیقه

    // ذخیره event handler و cleanup interval
    if (!activeServices.has(service.user_id)) {
      activeServices.set(service.user_id, new Map());
    }
    activeServices.get(service.user_id).set(serviceId, {
      eventHandler,
      cleanupInterval,
    });

    console.log(
      `🎉 Service ${serviceId} started successfully for user ${service.user_id}`
    );
  } catch (err) {
    console.error(`❌ Error starting service ${service.id}:`, err);
    throw err;
  }
}

// Start all active services for a user
async function startUserServices(userId) {
  try {
    const existingClient = activeClients.get(userId);
    const userActiveServices = activeServices.get(userId);

    if (existingClient && userActiveServices && userActiveServices.size > 0) {
      console.log(
        `Stopping ${userActiveServices.size} existing services for user ${userId} before restarting.`
      );
      for (const [serviceId, serviceData] of userActiveServices.entries()) {
        if (serviceData.eventHandler) {
          existingClient.removeEventHandler(serviceData.eventHandler);
        }
        if (serviceData.cleanupInterval) {
          clearInterval(serviceData.cleanupInterval);
        }
        // پاک کردن message map مربوط به این سرویس از حافظه اصلی اگر لازم است
        // messageMaps.delete(serviceId); // اگر می‌خواهید message map هم با هر بار ریستارت پاک شود
      }
      userActiveServices.clear(); // یا activeServices.delete(userId) اگر ساختار Map بیرونی را هم پاک می‌کنید
    }

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
          connectionRetries: 10,
          retryDelay: 3000,
          useWSS: true,
          timeout: 30000,
          requestRetries: 5,
          floodSleepThreshold: 60,
          autoReconnect: true,
          systemVersion: "1.0.0",
          appVersion: "1.0.0",
          langCode: "en",
          systemLangCode: "en",
        }
      );

      await client.connect();
      if (!(await client.isUserAuthorized())) {
        throw new Error("Telegram session is invalid");
      }

      activeClients.set(userId, client);
      console.log(`🔗 Client connected for user ${userId}`);
    }

    for (const service of services) {
      await startForwardingService(service, client, user.gemini_api_key);
    }

    console.log(`🎊 Started ${services.length} services for user: ${userId}`);
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
      const serviceData = userServices.get(serviceId);
      if (serviceData) {
        const client = activeClients.get(userId);
        if (client) {
          client.removeEventHandler(serviceData.eventHandler);
        }

        // پاک کردن cleanup interval
        if (serviceData.cleanupInterval) {
          clearInterval(serviceData.cleanupInterval);
        }

        // ذخیره نهایی message mapping
        const messageMap = messageMaps.get(serviceId);
        if (messageMap) {
          cleanExpiredMessages(serviceId);
          saveMessageMap(serviceId, messageMap);
          messageMaps.delete(serviceId);
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
        for (const [serviceId, serviceData] of userServices.entries()) {
          client.removeEventHandler(serviceData.eventHandler);

          if (serviceData.cleanupInterval) {
            clearInterval(serviceData.cleanupInterval);
          }

          // ذخیره message mapping
          const messageMap = messageMaps.get(serviceId);
          if (messageMap) {
            cleanExpiredMessages(serviceId);
            saveMessageMap(serviceId, messageMap);
            messageMaps.delete(serviceId);
          }
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

    console.log("🎉 All active services initialization completed");
  } catch (err) {
    console.error("❌ Error initializing services:", err);
  }
}

// API Routes (unchanged)
app.post("/sendCode", async (req, res) => {
  try {
    console.log("sendCode request received:", req.body);
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const client = new TelegramClient(new StringSession(""), API_ID, API_HASH, {
      connectionRetries: 10,
      retryDelay: 3000,
      useWSS: true,
      timeout: 30000,
      requestRetries: 5,
      floodSleepThreshold: 60,
      autoReconnect: true,
      systemVersion: "1.0.0",
      appVersion: "1.0.0",
      langCode: "en",
      systemLangCode: "en",
    });

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

    console.log("sendCode successful for:", phoneNumber);
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

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    activeClients: activeClients.size,
    activeServices: Array.from(activeServices.values()).reduce(
      (total, userServices) => total + userServices.size,
      0
    ),
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n💾 در حال ذخیره داده‌ها و بستن اتصالات...");

  // ذخیره همه message mappings
  for (const [serviceId, messageMap] of messageMaps.entries()) {
    cleanExpiredMessages(serviceId);
    saveMessageMap(serviceId, messageMap);
  }

  // بستن همه اتصالات
  for (const client of activeClients.values()) {
    try {
      await client.disconnect();
    } catch (err) {
      console.error("Error disconnecting client:", err);
    }
  }

  console.log("✅ داده‌ها ذخیره شد. خروج...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n💾 در حال ذخیره داده‌ها و بستن اتصالات...");

  for (const [serviceId, messageMap] of messageMaps.entries()) {
    cleanExpiredMessages(serviceId);
    saveMessageMap(serviceId, messageMap);
  }

  for (const client of activeClients.values()) {
    try {
      await client.disconnect();
    } catch (err) {
      console.error("Error disconnecting client:", err);
    }
  }

  console.log("✅ داده‌ها ذخیره شد. خروج...");
  process.exit(0);
});

// Initialize all services on server start
initializeAllServices();

// Start server
app.listen(PORT, HOST, () => {
  const displayHost = isProduction ? "sna.freebotmoon.ir" : HOST;
  console.log(`Server running on http://${displayHost}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Listening on: ${HOST}:${PORT}`);
  console.log("CORS origins:", corsOptions.origin);
});
