const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { API_ID, API_HASH } = require("../../config");

// Store active clients
const activeClients = new Map();

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

  await client.connect();
  return client;
}

async function disconnectClient(userId) {
  const client = activeClients.get(userId);
  if (client) {
    await client.disconnect();
    activeClients.delete(userId);
  }
}

async function getOrCreateClient(userId, session) {
  let client = activeClients.get(userId);
  
  if (!client) {
    client = await createClient(session);
    if (!(await client.isUserAuthorized())) {
      throw new Error("Telegram session is invalid");
    }
    activeClients.set(userId, client);
  }
  
  return client;
}

module.exports = {
  activeClients,
  createClient,
  disconnectClient,
  getOrCreateClient
};