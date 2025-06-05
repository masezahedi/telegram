// File: server/telegram-server.js

const express = require("express");
const cors = require("cors");
const axios = require("axios"); // NEW: Import axios
const { Api } = require("telegram");
const { verifyToken } = require("./utils/auth");
const { createClient, activeClients } = require("./services/telegram/client");
const {
  initializeAllServices,
  stopService,
  startUserServices, // NEW: Import startUserServices
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

// ZarinPal configuration (add these to your environment variables)
const ZARINPAL_MERCHANT_ID = process.env.ZARINPAL_MERCHANT_ID || "YOUR_ZARINPAL_MERCHANT_ID";
const ZARINPAL_CALLBACK_HOST = isProduction ? "https://sna.freebotmoon.ir:1332" : "http://localhost:1332"; // Host of your Next.js frontend

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

// Auth Routes (Copied from telegram-server.js, assuming they are correct)
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

    // Attempt to sign in
    const result = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode: code,
      })
    );

    const stringSession = client.session.save();
    // Do NOT delete client here yet, wait until session is saved in Next.js backend
    // activeClients.delete(phoneNumber);

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
    // Do NOT delete client here yet, wait until session is saved in Next.js backend
    // activeClients.delete(phoneNumber);

    res.json({
      success: true,
      stringSession,
    });
  } catch (err) {
    console.error("Error in checkPassword:", err);
    res.status(500).json({ error: err.message });
  }
});

// Service Routes (Using service-manager functions)
app.post("/services/start", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    await require("./services/telegram/service-manager").startUserServices(
      decoded.userId
    );
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
    await require("./services/telegram/service-manager").stopUserServices(
      decoded.userId
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Error stopping services:", err);
    res.status(500).json({ error: err.message });
  }
});

// Tariff Settings API
app.use("/tariff-settings", require("./routes/tariff-settings"));

// NEW: ZarinPal Payment Routes
app.post("/payment/request", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = await verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { amount, description, callbackUrl } = req.body;

    if (!amount || amount <= 0 || !description || !callbackUrl) {
      return res.status(400).json({ success: false, error: "اطلاعات پرداخت ناقص است." });
    }

    const db = await openDb();
    const user = await db.get("SELECT email, phone_number FROM users WHERE id = ?", [decoded.userId]);
    if (!user) {
      return res.status(404).json({ success: false, error: "کاربر یافت نشد." });
    }

    // ZarinPal Request API
    const zarinpalResponse = await axios.post("https://api.zarinpal.com/pg/v4/payment/request.json", {
      merchant_id: ZARINPAL_MERCHANT_ID,
      amount: amount,
      description: description,
      callback_url: `${ZARINPAL_CALLBACK_HOST}/api/payment/verify?userId=${decoded.userId}&amount=${amount}&callbackUrl=${encodeURIComponent(callbackUrl)}`,
      metadata: {
        email: user.email,
        mobile: user.phone_number,
      },
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    const data = zarinpalResponse.data;

    if (data.data.code === 100) {
      return res.json({
        success: true,
        paymentUrl: `https://www.zarinpal.com/pg/StartPay/${data.data.authority}`,
      });
    } else {
      console.error("ZarinPal Request Error:", data.errors);
      return res.status(400).json({
        success: false,
        message: data.errors.message || "خطا در ایجاد درخواست پرداخت از زرین‌پال.",
      });
    }
  } catch (error) {
    console.error("Payment Request Error:", error);
    return res.status(500).json({ success: false, error: "خطای سرور هنگام شروع پرداخت." });
  }
});

app.get("/payment/verify", async (req, res) => {
  const { Authority, Status, userId, amount, callbackUrl } = req.query;

  if (Status === "OK") {
    try {
      const db = await openDb();
      const user = await db.get("SELECT id, is_premium, premium_expiry_date FROM users WHERE id = ?", [userId]);

      if (!user) {
        return res.redirect(`${decodeURIComponent(callbackUrl)}?payment_status=failed&message=${encodeURIComponent("کاربر یافت نشد.")}`);
      }

      // ZarinPal Verify API
      const zarinpalResponse = await axios.post("https://api.zarinpal.com/pg/v4/payment/verify.json", {
        merchant_id: ZARINPAL_MERCHANT_ID,
        amount: parseFloat(amount),
        authority: Authority,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      const data = zarinpalResponse.data;

      if (data.data.code === 100) {
        // Payment successful
        const tariffSettings = await db.get("SELECT premium_user_default_days FROM tariff_settings LIMIT 1");
        const premiumDurationDays = tariffSettings?.premium_user_default_days ?? 30;

        let newExpiryDate = new Date();
        if (user.is_premium && user.premium_expiry_date && new Date(user.premium_expiry_date) > newExpiryDate) {
            // If already premium and has a future expiry, extend from current expiry
            newExpiryDate = new Date(user.premium_expiry_date);
        }
        newExpiryDate.setDate(newExpiryDate.getDate() + premiumDurationDays);

        await db.run(
          "UPDATE users SET is_premium = 1, premium_expiry_date = ?, trial_activated_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [newExpiryDate.toISOString(), userId]
        );
        console.log(`User ${userId} successfully upgraded to premium. Expiry: ${newExpiryDate.toISOString()}`);
        
        // Restart user services to apply new premium status and limits
        await startUserServices(userId);

        return res.redirect(`${decodeURIComponent(callbackUrl)}?payment_status=success&message=${encodeURIComponent("پرداخت با موفقیت انجام شد و حساب شما پرمیوم شد!")}`);
      } else {
        // Payment failed or already verified
        console.error("ZarinPal Verify Error:", data.errors);
        return res.redirect(`${decodeURIComponent(callbackUrl)}?payment_status=failed&message=${encodeURIComponent(data.errors.message || "پرداخت ناموفق بود یا قبلا تایید شده است.")}`);
      }
    } catch (error) {
      console.error("Payment Verification Error:", error);
      return res.redirect(`${decodeURIComponent(callbackUrl)}?payment_status=failed&message=${encodeURIComponent("خطای سرور هنگام تأیید پرداخت.")}`);
    }
  } else {
    // Payment cancelled by user
    return res.redirect(`${decodeURIComponent(callbackUrl)}?payment_status=failed&message=${encodeURIComponent("پرداخت توسط کاربر لغو شد.")}`);
  }
});


// Health check endpoint
app.get("/health", (req, res) => {
  const {
    activeServices: activeUserServicesMap,
  } = require("./services/telegram/service-manager");
  const activeServiceInstanceCount = Array.from(
    activeUserServicesMap.values()
  ).reduce((total, userServices) => total + userServices.size, 0);
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    activeTelegramClients: activeClients.size,
    activeServiceInstances: activeServiceInstanceCount,
  });
});

async function checkAndExpireServices() {
  console.log("🕒 Checking for expired user accounts and services...");
  try {
    const db = await openDb();
    const now = new Date();
    const nowISO = now.toISOString();

    // Fetch tariff settings
    const tariffSettings = await db.get("SELECT * FROM tariff_settings LIMIT 1");
    const normalUserTrialDays = tariffSettings?.normal_user_trial_days ?? 15;

    // 1. Handle users whose premium_expiry_date has passed (applies to both premium and normal users after trial)
    const expiredUsers = await db.all(
      `
      SELECT id FROM users
      WHERE is_admin = 0 AND premium_expiry_date IS NOT NULL AND premium_expiry_date < ?
    `,
      [nowISO]
    );

    for (const user of expiredUsers) {
      console.log(
        `⏳ Account expired for user ${user.id}. Deactivating services and ensuring non-premium status.`
      );

      // Set is_premium to 0 for expired premium users
      await db.run(
        "UPDATE users SET is_premium = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_premium = 1",
        [user.id]
      );

      const userServices = await db.all(
        "SELECT id FROM forwarding_services WHERE user_id = ? AND is_active = 1",
        [user.id]
      );
      for (const service of userServices) {
        console.log(
          `🔴 Deactivating service ${service.id} for user ${user.id} due to account expiry.`
        );
        await db.run(
          "UPDATE forwarding_services SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [service.id]
        );
        try {
          // IMPORTANT: Call stopService from service-manager to actually stop the active process
          await stopService(user.id, service.id);
        } catch (err) {
          console.error(
            `Error stopping expired service ${service.id}:`,
            err
          );
        }
      }
      // TODO: Notify user about expiry (e.g., via Telegram if session is valid or email)
    }

    console.log("✅ Finished checking for expired accounts and services.");
  } catch (error) {
    console.error("❌ Error in checkAndExpireServices:", error);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n💾 Saving data and closing connections...");
  for (const [serviceId, messageMap] of messageMaps.entries()) {
    cleanExpiredMessages(serviceId);
    saveMessageMap(serviceId, messageMap);
  }
  // Disconnect active Telegram clients used for login/2FA steps
  for (const clientData of activeClients.values()) {
    if (
      clientData &&
      clientData.client &&
      typeof clientData.client.disconnect === "function"
    ) {
      try {
        await clientData.client.disconnect();
      } catch (err) {
        console.error("Error disconnecting a temp client:", err);
      }
    }
  }
  // Disconnect persistent clients from service-manager
  const {
    persistentClients, // Corrected import
  } = require("./services/telegram/client");
  for (const client of persistentClients.values()) {
    if (client && typeof client.disconnect === "function") {
      try {
        await client.disconnect();
      } catch (err) {
        console.error("Error disconnecting persistent client:", err);
      }
    }
  }
  console.log("✅ Data saved. Exiting...");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  // Same as SIGINT
  console.log("\n💾 Saving data and closing connections...");
  for (const [serviceId, messageMap] of messageMaps.entries()) {
    cleanExpiredMessages(serviceId);
    saveMessageMap(serviceId, messageMap);
  }
  for (const clientData of activeClients.values()) {
    if (
      clientData &&
      clientData.client &&
      typeof clientData.client.disconnect === "function"
    ) {
      try {
        await clientData.client.disconnect();
      } catch (err) {
        console.error("Error disconnecting a temp client:", err);
      }
    }
  }
  const {
    persistentClients, // Corrected import
  } = require("./services/telegram/client");
  for (const client of persistentClients.values()) {
    if (client && typeof client.disconnect === "function") {
      try {
        await client.disconnect();
      } catch (err) {
        console.error("Error disconnecting persistent client:", err);
      }
    }
  }
  console.log("✅ Data saved. Exiting...");
  process.exit(0);
});

// Initialize all services on server start (from service-manager)
require("./services/telegram/service-manager").initializeAllServices();

const EXPIRY_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
// const EXPIRY_CHECK_INTERVAL = 30 * 1000; // For testing: 30 seconds
setInterval(checkAndExpireServices, EXPIRY_CHECK_INTERVAL);
checkAndExpireServices(); // Run once on server start

// Start server
app.listen(PORT, HOST, () => {
  const displayHost = isProduction ? "sna.freebotmoon.ir" : HOST;
  console.log(`Server running on http://${displayHost}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`Listening on: ${HOST}:${PORT}`);
  console.log("CORS origins:", corsOptions.origin);
});