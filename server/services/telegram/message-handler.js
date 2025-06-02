// Fixed message-handler.js
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

// Process message
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
      return null; // بازگشت null برای خطا
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

    // اگر پیام قبلاً پردازش شده، از ارسال مجدد جلوگیری کن
    if (messageMap.has(messageKey)) {
      console.log(
        `⏭️ Service ${serviceId}: Message already processed, skipping`
      );
      return null;
    }

    let processedText = originalText;

    if (isEdit && messageMap.has(messageKey)) {
      // <--- شروع بلاک ویرایش
      const originalMessageData = messageMap.get(messageKey);
      console.log(
        `🔄 Service ${serviceId}: Updating existing forwarded messages for ${messageKey}`
      );

      let processedText = originalText; // متن پیام ویرایش شده از مبدا

      // پردازش با AI (اگر فعال باشد)
      if (originalText && useAI && genAI) {
        // ... (کد پردازش AI برای ویرایش)
      }

      // اعمال قواعد جستجو/جایگزینی بر روی متن ویرایش شده
      if (processedText && searchReplaceRules?.length > 0) {
        // ... (کد اعمال قواعد)
      }

      // ***** شروع بخش اصلاح شده برای ویرایش *****
      for (const targetUsername of targetChannels) {
        const originalTargetMessageIdString =
          originalMessageData.targetMessageIds[targetUsername];

        if (originalTargetMessageIdString) {
          try {
            const targetEntity = await client.getEntity(
              targetUsername.startsWith("@")
                ? targetUsername
                : `@${targetUsername}`
            );
            const messageIdToEdit = parseInt(originalTargetMessageIdString);

            console.log(
              `✏️ Service ${serviceId}: Attempting to edit message in ${targetUsername} (Target ID: ${messageIdToEdit}) with new text.`
            );

            await client.editMessage(targetEntity, {
              // <--- این بخش جایگزین sendNewMessage می شود
              message: messageIdToEdit,
              text: processedText,
              parseMode: "html",
              // سایر پارامترهای لازم برای editMessage
            });

            console.log(
              `✅ Service ${serviceId}: Message ${messageIdToEdit} edited successfully in ${targetUsername}`
            );
          } catch (err) {
            console.error(
              `❌ Error editing message ${originalTargetMessageIdString} in ${targetUsername}:`,
              err
            );
            // مدیریت خطا، مثلا ارسال پیام جدید در صورت عدم موفقیت ویرایش
          }
        } else {
          // اگر پیام اصلی در این کانال مقصد قبلا فوروارد نشده بود
          console.log(
            `➕ Service ${serviceId}: Original message mapping not found for ${targetUsername} in edit. Sending as new.`
          );
          // ارسال به عنوان پیام جدید (رفتار فعلی شما برای این حالت)
          const targetEntity = await client.getEntity(
            targetUsername.startsWith("@")
              ? targetUsername
              : `@${targetUsername}`
          );
          await sendNewMessage(
            message, // پیام ویرایش شده از مبدا
            processedText,
            targetEntity,
            hasMedia,
            client
          );
        }
      }
      // ***** پایان بخش اصلاح شده برای ویرایش *****
    } else {
      // پیام جدید یا پیامی که قبلاً فوروارد نشده و اکنون ویرایش دریافت کرده (ولی مپینگ ندارد)
      // (رفتار فعلی شما: ارسال به عنوان پیام جدید)
      console.log(
        `✨ Service ${serviceId}: Processing as new message (or edit without prior map for ${messageKey})`
      );
      // ... (کد فعلی شما برای ارسال پیام جدید زمانی که isEdit false است یا messageKey وجود ندارد)
      // اطمینان حاصل کنید که processedText در اینجا هم به درستی مقداردهی شده باشد
      // (احتمالا نیاز است کد پردازش AI و search/replace در این بلاک هم وجود داشته باشد
      // یا قبل از این if/else کلی انجام شود)

      const forwardedMessages = {};
      for (const targetUsername of targetChannels) {
        try {
          const formattedUsername = targetUsername.startsWith("@")
            ? targetUsername
            : `@${targetUsername}`;
          const targetEntity = await client.getEntity(formattedUsername);

          // اطمینان حاصل شود که processedText در اینجا هم متن درست را دارد
          // اگر AI یا search/replace در بلاک else انجام نشده، باید اینجا انجام شود یا از originalText استفاده شود
          let textToSend = originalText; // یا processedText اگر پردازش ها خارج از if/else انجام شده
          if (useAI && genAI && originalText) {
            // ... (کد پردازش AI) ...
            // textToSend = ... نتیجه AI
          }
          if (textToSend && searchReplaceRules?.length > 0) {
            // ... (کد search/replace) ...
            // textToSend = ... نتیجه search/replace
          }

          const sentMessage = await sendNewMessage(
            message,
            textToSend, // متن نهایی برای ارسال
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
        } catch (err) {
          console.error(
            `❌ Error sending new message to ${targetUsername}:`,
            err
          );
        }
      }

      if (Object.keys(forwardedMessages).length > 0) {
        const messageData = {
          targetMessageIds: forwardedMessages,
          timestamp: currentTime,
          originalChannelId: channelId.toString(),
          originalMessageId: message.id.toString(), // اطمینان از اینکه به صورت رشته ذخیره می‌شود
        };
        messageMap.set(messageKey, messageData);
        messageMaps.set(serviceId, messageMap);
        saveMessageMap(serviceId, messageMap); // ذخیره در فایل
        console.log(
          `💾 Service ${serviceId}: Message mapping saved for ${messageKey}`
        );
      }
      return forwardedMessages; // بازگرداندن پیام‌های فوروارد شده
    }

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

    // ارسال به کانال‌های مقصد
    const forwardedMessages = {}; // ذخیره پیام‌های فوروارد شده

    for (const targetUsername of targetChannels) {
      try {
        const formattedUsername = targetUsername.startsWith("@")
          ? targetUsername
          : `@${targetUsername}`;
        const targetEntity = await client.getEntity(formattedUsername);

        // ارسال پیام جدید (حتی برای ویرایش، اگر پیام هدف وجود نداشته باشد)
        console.log(
          `📤 Service ${serviceId}: Sending message to ${targetUsername}`
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
            `✅ Service ${serviceId}: Message sent to ${targetUsername} (ID: ${sentMessage.id})`
          );
        }
      } catch (err) {
        console.error(`❌ Error sending to ${targetUsername}:`, err);
      }
    }

    // ذخیره در messageMaps فقط اگر پیام‌ها با موفقیت ارسال شدند
    if (Object.keys(forwardedMessages).length > 0) {
      const messageData = {
        targetMessageIds: forwardedMessages,
        timestamp: currentTime,
        originalChannelId: channelId.toString(),
        originalMessageId: message.id,
      };
      messageMap.set(messageKey, messageData);
      messageMaps.set(serviceId, messageMap);
      console.log(`💾 Service ${serviceId}: Message mapping saved`);
    }

    return forwardedMessages; // بازگرداندن پیام‌های فوروارد شده
  } catch (err) {
    console.error(`❌ Service ${service.id}: Message processing error:`, err);
    return null;
  }
}

module.exports = {
  processMessage,
  sendNotificationToUser,
};
