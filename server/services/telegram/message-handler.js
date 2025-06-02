// Fixed message-handler.js - اصلاح شده برای پشتیبانی از ویرایش پیام‌ها
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { messageMaps } = require("./message-maps");
const { cleanExpiredMessages, saveMessageMap } = require("./message-maps");

// Create prompt template for Gemini
const createPromptTemplate = (originalText, customTemplate) => {
  if (!customTemplate) return originalText;
  return `${customTemplate}: ${originalText}`;
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

// Send new message
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
      console.log(`📤 Sending media type: ${message.media.className}`);
      sentMessage = await client.sendFile(targetChannel, {
        file: message.media,
        caption: finalText,
        forceDocument: false,
        parseMode: "html",
      });
    } else {
      console.log("📤 Sending text message");
      sentMessage = await client.sendMessage(targetChannel, {
        message: finalText,
        parseMode: "html",
      });
    }

    console.log("✅ New message sent");
    return sentMessage;
  } catch (err) {
    console.error("❌ Error sending message:", err);
    return null;
  }
}

// 🔥 NEW: Edit existing message
async function editExistingMessage(
  targetMessageId,
  finalText,
  targetChannel,
  hasValidMedia,
  message,
  client
) {
  try {
    console.log(`✏️ Editing message ID: ${targetMessageId}`);

    if (hasValidMedia) {
      // برای پیام‌های رسانه‌ای، فقط caption را ویرایش می‌کنیم
      // چون نمی‌توان فایل رسانه را ویرایش کرد
      await client.editMessage(targetChannel, {
        message: targetMessageId,
        text: finalText,
        parseMode: "html",
      });
      console.log("✅ Media message caption edited");
    } else {
      // برای پیام‌های متنی
      await client.editMessage(targetChannel, {
        message: targetMessageId,
        text: finalText,
        parseMode: "html",
      });
      console.log("✅ Text message edited");
    }

    return true;
  } catch (err) {
    console.error("❌ Error editing message:", err);

    // اگر ویرایش ناموفق بود، پیام جدید ارسال کن
    console.log("🔄 Attempting to send new message instead of edit");
    const sentMessage = await sendNewMessage(
      message,
      finalText,
      targetChannel,
      hasValidMedia,
      client
    );

    return sentMessage ? sentMessage.id.toString() : null;
  }
}

// 🔥 IMPROVED: Process message with edit support
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

    if (!message) {
      console.log(`⛔ Service ${serviceId}: Empty message`);
      return null;
    }

    // استخراج channelId
    let channelId = null;
    if (message.peerId?.channelId) {
      channelId = message.peerId.channelId;
    } else if (message.chatId) {
      channelId = message.chatId;
    } else if (message.chat?.id) {
      channelId = message.chat.id;
    }

    if (!channelId) {
      console.log(`⛔ Service ${serviceId}: No channel ID found`);
      return null;
    }

    // بررسی source channel
    const isFromSourceChannel = sourceChannelIds.some((sourceId) => {
      const sourceIdStr = sourceId?.toString?.() || String(sourceId);
      const channelIdStr = channelId?.toString?.() || String(channelId);
      return (
        sourceIdStr === channelIdStr ||
        sourceId?.value?.toString() === channelId?.value?.toString() ||
        Math.abs(sourceId) === Math.abs(channelId)
      );
    });

    if (!isFromSourceChannel) {
      console.log(
        `⛔ Service ${serviceId}: Message from non-source channel ignored`
      );
      return null;
    }

    const originalText = message.message || message.caption;
    const hasMedia =
      message.media &&
      message.media.className !== "MessageMediaEmpty" &&
      message.media.className !== "MessageMediaWebPage";

    if (!originalText && !hasMedia) {
      console.log(
        `⛔ Service ${serviceId}: Message without text and media ignored`
      );
      return null;
    }

    // مدیریت messageMap
    const messageMap = messageMaps.get(serviceId) || new Map();
    const messageKey = `${channelId.toString()}_${message.id}`;
    const currentTime = Date.now();

    console.log(`📝 Processing message: ${messageKey}, isEdit: ${isEdit}`);

    // 🔥 IMPROVED: بررسی وضعیت پیام برای تصمیم‌گیری بین ارسال جدید یا ویرایش
    const existingMessageData = messageMap.get(messageKey);

    if (isEdit && !existingMessageData) {
      console.log(
        `⚠️ Service ${serviceId}: Edit requested but original message not found in map. Treating as new message.`
      );
    }

    if (!isEdit && existingMessageData) {
      console.log(
        `⏭️ Service ${serviceId}: New message but already exists in map, skipping duplicate`
      );
      return null;
    }

    let processedText = originalText;

    // پردازش با AI (اگر فعال باشد)
    if (originalText && useAI && genAI) {
      try {
        console.log(`🤖 Service ${serviceId}: Processing with AI`);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = createPromptTemplate(originalText, promptTemplate);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        processedText = response.text().trim();
        console.log(`🤖 Service ${serviceId}: AI processing completed`);
      } catch (err) {
        console.error(`❌ Service ${serviceId}: AI Error:`, err);
        processedText = originalText;
      }
    }

    // اعمال قواعد جستجو/جایگزینی
    if (processedText && searchReplaceRules?.length > 0) {
      for (const rule of searchReplaceRules) {
        if (rule.search && rule.replace) {
          processedText = processedText.replace(
            new RegExp(rule.search, "g"),
            rule.replace
          );
        }
      }
    }

    // 🔥 IMPROVED: ارسال یا ویرایش پیام‌ها بر اساس وضعیت
    const forwardedMessages = {};

    for (const targetUsername of targetChannels) {
      try {
        const formattedUsername = targetUsername.startsWith("@")
          ? targetUsername
          : `@${targetUsername}`;
        const targetEntity = await client.getEntity(formattedUsername);

        if (
          isEdit &&
          existingMessageData &&
          existingMessageData.targetMessageIds[targetUsername]
        ) {
          // 🔥 ویرایش پیام موجود
          const targetMessageId =
            existingMessageData.targetMessageIds[targetUsername];
          console.log(
            `✏️ Service ${serviceId}: Editing message ${targetMessageId} in ${targetUsername}`
          );

          const editResult = await editExistingMessage(
            targetMessageId,
            processedText,
            targetEntity,
            hasMedia,
            message,
            client
          );

          if (editResult === true) {
            // ویرایش موفق بود، ID قبلی را حفظ کن
            forwardedMessages[targetUsername] = targetMessageId;
            console.log(
              `✅ Service ${serviceId}: Message edited in ${targetUsername} (ID: ${targetMessageId})`
            );
          } else if (editResult) {
            // پیام جدید ارسال شد به جای ویرایش
            forwardedMessages[targetUsername] = editResult;
            console.log(
              `✅ Service ${serviceId}: New message sent instead of edit in ${targetUsername} (ID: ${editResult})`
            );
          }
        } else {
          // 🔥 ارسال پیام جدید
          console.log(
            `📤 Service ${serviceId}: Sending new message to ${targetUsername}`
          );
          const sentMessage = await sendNewMessage(
            message,
            processedText,
            targetEntity,
            hasMedia,
            client
          );

          if (sentMessage) {
            forwardedMessages[targetUsername] = sentMessage.id.toString();
            console.log(
              `✅ Service ${serviceId}: New message sent to ${targetUsername} (ID: ${sentMessage.id})`
            );
          }
        }
      } catch (err) {
        console.error(`❌ Error processing ${targetUsername}:`, err);
      }
    }

    // 🔥 IMPROVED: ذخیره یا به‌روزرسانی messageMap
    if (Object.keys(forwardedMessages).length > 0) {
      const messageData = {
        targetMessageIds: forwardedMessages,
        timestamp: currentTime,
        originalChannelId: channelId.toString(),
        originalMessageId: message.id,
        lastUpdated: currentTime,
        editCount: existingMessageData
          ? (existingMessageData.editCount || 0) + 1
          : 0,
      };

      messageMap.set(messageKey, messageData);
      messageMaps.set(serviceId, messageMap);

      console.log(
        `💾 Service ${serviceId}: Message mapping ${
          isEdit ? "updated" : "saved"
        } (Edit count: ${messageData.editCount})`
      );

      // ذخیره تغییرات در فایل
      try {
        saveMessageMap(serviceId, messageMap);
      } catch (err) {
        console.error(
          `❌ Service ${serviceId}: Error saving message map:`,
          err
        );
      }
    }

    return forwardedMessages;
  } catch (err) {
    console.error(`❌ Service ${service.id}: Message processing error:`, err);
    return null;
  }
}

module.exports = {
  processMessage,
  sendNotificationToUser,
};
