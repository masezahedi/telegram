const express = require("express");
const cors = require("cors");
const { Api } = require("telegram");
const { verifyToken } = require("./utils/auth");
const { createClient, activeClients } = require("./services/telegram/client");
const {
  stopService,
  startUserServices,
  stopUserServices,
  initializeAllServices,
} = require("./services/telegram/service-manager");
const {
  messageMaps,
  saveMessageMap,
  cleanExpiredMessages,
} = require("./services/telegram/message-maps");
const { API_ID, API_HASH } = require("./config");
const { openDb } = require("./utils/db");
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

// Auth Routes
app.post("/sendCode", async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    const client = await createClient();
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

// Service Routes
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
  console.log("\n💾 Saving data and closing connections...");

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

  console.log("✅ Data saved. Exiting...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n💾 Saving data and closing connections...");

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

  console.log("✅ Data saved. Exiting...");
  process.exit(0);
});

async function checkAndExpireNormalUserServices() {
  console.log("🕒 Checking for expired normal user services...");
  try {
    const db = await openDb();
    const now = new Date().toISOString();

    // پیدا کردن کاربرانی که ادمین یا پرمیوم نیستند (یا پرمیومشان منقضی شده)
    const normalUsers = await db.all(
      `
      SELECT id FROM users 
      WHERE is_admin = 0 AND (is_premium = 0 OR premium_expiry_date IS NULL OR premium_expiry_date < ?)
    `,
      [now]
    );

    if (!normalUsers.length) {
      console.log("✅ No normal users found to check for service expiry.");
      return;
    }

    const normalUserIds = normalUsers.map((u) => u.id);

    // پیدا کردن سرویس‌های فعال کاربران عادی که service_activated_at دارند و 15 روز از آن گذشته است
    const servicesToExpire = await db.all(
      `
      SELECT id, user_id, name FROM forwarding_services
      WHERE user_id IN (${normalUserIds.map(() => "?").join(",")})
        AND is_active = 1
        AND service_activated_at IS NOT NULL
        AND DATETIME(service_activated_at, '+15 days') < ?
    `,
      [...normalUserIds, now]
    );

    if (servicesToExpire.length > 0) {
      console.log(`Found ${servicesToExpire.length} services to expire.`);
      for (const service of servicesToExpire) {
        console.log(
          `⏳ Expiring service ID: ${service.id} for user ID: ${service.user_id}, Name: ${service.name}`
        );
        await db.run(
          "UPDATE forwarding_services SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [service.id]
        );
        // مهم: باید سرویس متوقف شود
        try {
          await stopService(service.user_id, service.id);
          // اطلاع رسانی به کاربر (اختیاری)
          // await sendNotificationToUser(client, `سرویس "${service.name}" شما منقضی و غیرفعال شد.`);
          console.log(
            `🔴 Service ${service.id} for user ${service.user_id} deactivated due to expiry.`
          );
        } catch (err) {
          console.error(`Error stopping expired service ${service.id}:`, err);
        }
      }
      console.log(
        `✅ ${servicesToExpire.length} services expired successfully.`
      );
    } else {
      console.log("✅ No normal user services to expire at this time.");
    }
  } catch (error) {
    console.error("❌ Error in checkAndExpireNormalUserServices:", error);
  }
}

// Initialize all services on server start
initializeAllServices();

// راه‌اندازی بررسی انقضای سرویس‌ها به صورت دوره‌ای (مثلاً هر ساعت)
const EXPIRY_CHECK_INTERVAL = 60 * 60 * 1000; // 1 ساعت
setInterval(checkAndExpireNormalUserServices, EXPIRY_CHECK_INTERVAL);
checkAndExpireNormalUserServices(); // یکبار هم در ابتدای راه‌اندازی سرور اجرا شود

// Start server
app.listen(PORT, HOST, () => {
  const displayHost = isProduction ? "sna.freebotmoon.ir" : HOST;
  console.log(`Server running on http://${displayHost}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Listening on: ${HOST}:${PORT}`);
  console.log("CORS origins:", corsOptions.origin);
});
