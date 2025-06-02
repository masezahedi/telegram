const fs = require("fs");
const path = require("path");

const MESSAGE_EXPIRY_TIME = 2 * 60 * 60 * 1000; // 2 hours
const messageMaps = new Map();

function getMessageMapFile(serviceId) {
  return path.join(
    __dirname,
    `../../data/message_maps/service_${serviceId}_message_mapping.json`
  );
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
        `📁 Service ${serviceId}: Loaded ${loadedMap.size} active messages from file`
      );
      return loadedMap;
    }
  } catch (err) {
    console.error(
      `❌ Error reading message map for service ${serviceId}:`,
      err
    );
  }
  return new Map();
}

function saveMessageMap(serviceId, messageMap) {
  try {
    const dirPath = path.join(__dirname, "../../data/message_maps");
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = getMessageMapFile(serviceId);
    const obj = Object.fromEntries(messageMap);
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error(`❌ Error saving message map for service ${serviceId}:`, err);
  }
}

// 🔥 NEW: تابع برای حذف فایل message mapping
function deleteMessageMapFile(serviceId) {
  try {
    const filePath = getMessageMapFile(serviceId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Service ${serviceId}: Message mapping file deleted`);
      return true;
    } else {
      console.log(
        `⚠️ Service ${serviceId}: Message mapping file not found for deletion`
      );
      return false;
    }
  } catch (err) {
    console.error(
      `❌ Error deleting message map file for service ${serviceId}:`,
      err
    );
    return false;
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
      `🗑️ Service ${serviceId}: Removed ${removedCount} expired messages`
    );
    saveMessageMap(serviceId, messageMap);
  }
}

module.exports = {
  messageMaps,
  loadMessageMap,
  saveMessageMap,
  deleteMessageMapFile,
  cleanExpiredMessages,
  MESSAGE_EXPIRY_TIME,
};
