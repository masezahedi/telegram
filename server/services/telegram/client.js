const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { API_ID, API_HASH } = require("../../config");

// Store active clients
const activeClients = new Map(); // This map holds clients during the auth flow (sendCode, signIn, checkPassword)

// Store persistent clients (for active services)
const persistentClients = new Map(); // This map holds clients for running services

async function createClient(session = "") {
  const client = new TelegramClient(new StringSession(session), API_ID, API_HASH, {
    connectionRetries: 20,
    retryDelay: 5000,
    useWSS: true,
    timeout: 60000,
    requestRetries: 10,
    floodSleepThreshold: 120,
    autoReconnect: true,
    systemVersion: "1.0.0",
    appVersion: "1.0.0",
    langCode: "en",
    systemLangCode: "en",
    updatesPendingMax: 20,
  });

  // Connect only if not already connected
  if (!client.connected) {
    await client.connect();
  }
  return client;
}

async function disconnectClient(userId) {
  const client = persistentClients.get(userId);
  if (client) {
    try {
      await client.disconnect();
      console.log(`Disconnected persistent client for user ${userId}`);
    } catch (err) {
      console.error(`Error disconnecting persistent client for user ${userId}:`, err);
    } finally {
      persistentClients.delete(userId);
    }
  }
}

async function getOrCreateClient(userId, session) {
  let client = persistentClients.get(userId);
  
  if (!client) {
    client = await createClient(session);
    if (!(await client.isUserAuthorized())) {
      throw new Error("Telegram session is invalid");
    }
    persistentClients.set(userId, client);
    console.log(`Created and stored new persistent client for user ${userId}`);
  } else if (!client.connected) {
    // If client exists but is disconnected, try to reconnect
    try {
      await client.connect();
      if (!(await client.isUserAuthorized())) {
        throw new Error("Telegram session became invalid, please reconnect");
      }
      console.log(`Reconnected existing persistent client for user ${userId}`);
    } catch (e) {
      console.error(`Failed to reconnect persistent client for user ${userId}:`, e);
      persistentClients.delete(userId); // Remove invalid client
      throw new Error("Failed to reconnect Telegram client. Please try re-connecting your account.");
    }
  }
  
  return client;
}

module.exports = {
  activeClients, // For auth flow
  persistentClients, // For active services
  createClient,
  disconnectClient,
  getOrCreateClient
};