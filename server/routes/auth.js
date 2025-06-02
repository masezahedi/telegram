// server/routes/auth.js
const express = require("express");
const { Api } = require("telegram"); // TelegramClient is managed in client.js now
const { API_ID, API_HASH } = require("../config");
// activeClients should be managed by the client.js or a shared service if needed by routes directly
const {
  activeClients: serverActiveClients,
} = require("../services/telegram/client"); // Assuming client.js exports activeClients
const { openDb } = require("../utils/db");

const router = express.Router();

router.post("/sendCode", async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res
        .status(400)
        .json({ success: false, error: "Phone number is required" });
    }
    // client creation and management is ideally handled by your `createClient` from `client.js`
    // For this route, a temporary client instance is fine if it's just for sending code.
    const tempClient = new (require("telegram").TelegramClient)(
      new (require("telegram/sessions").StringSession)(""),
      API_ID,
      API_HASH
    );
    await tempClient.connect();

    const result = await tempClient.invoke(
      new Api.auth.SendCode({
        phoneNumber,
        apiId: API_ID,
        apiHash: API_HASH,
        settings: new Api.CodeSettings({}),
      })
    );

    // Store the temporary client and phoneCodeHash, keyed by phoneNumber for the next step
    serverActiveClients.set(phoneNumber, {
      client: tempClient, // Storing the temporary client
      phoneCodeHash: result.phoneCodeHash,
    });

    res.json({
      success: true,
      phoneCodeHash: result.phoneCodeHash,
    });
  } catch (err) {
    console.error("Error in sendCode:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/signIn", async (req, res) => {
  try {
    const { phoneNumber, code } = req.body;
    const data = serverActiveClients.get(phoneNumber);

    if (!data) {
      return res.status(400).json({
        success: false,
        error:
          "No active session found for this phone number. Please send code again.",
      });
    }

    const { client, phoneCodeHash } = data;

    if (!client.connected) {
      await client.connect();
    }

    await client.invoke(
      // No need to assign to result if only checking for success/error
      new Api.auth.SignIn({
        phoneNumber,
        phoneCodeHash,
        phoneCode: code,
      })
    );

    const me = await client.getMe();
    const telegramId = me.id.toString();
    const stringSession = client.session.save();

    // No need to delete from serverActiveClients if client is temporary for this flow
    // client.disconnect(); // Disconnect temporary client after use

    res.json({ success: true, stringSession, telegramId, phoneNumber });
  } catch (err) {
    console.error("Error in signIn:", err);
    const { phoneNumber } = req.body; // For logging or potential cleanup
    if (err.message && err.message.includes("SESSION_PASSWORD_NEEDED")) {
      // Keep the client in serverActiveClients for the 2FA step
      res.json({
        success: false,
        requires2FA: true,
        error: "SESSION_PASSWORD_NEEDED",
      });
    } else {
      if (phoneNumber && serverActiveClients.has(phoneNumber)) {
        serverActiveClients.get(phoneNumber).client.disconnect();
        serverActiveClients.delete(phoneNumber);
      }
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

router.post("/checkPassword", async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;
    const data = serverActiveClients.get(phoneNumber);

    if (!data || !data.client) {
      return res.status(400).json({
        success: false,
        error: "Session expired or invalid. Please try sending the code again.",
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

    const me = await client.getMe();
    const telegramId = me.id.toString();
    const stringSession = client.session.save();

    // client.disconnect(); // Disconnect temporary client
    // serverActiveClients.delete(phoneNumber); // Clean up

    res.json({
      success: true,
      stringSession,
      telegramId,
      phoneNumber,
    });
  } catch (err) {
    console.error("Error in checkPassword:", err);
    const { phoneNumber } = req.body;
    if (phoneNumber && serverActiveClients.has(phoneNumber)) {
      serverActiveClients.get(phoneNumber).client.disconnect();
      serverActiveClients.delete(phoneNumber);
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
