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
      const originalMessageData = messageMap.get(messageKey);
      console.log(
        `🔄 Service ${serviceId}: Updating existing forwarded messages for ${messageKey}`
      );

      let processedText = originalText; // متن پیام ویرایش شده از مبدا

      // پردازش با AI (اگر فعال باشد)
      if (originalText && useAI && genAI) {
        try {
          console.log(`🤖 Service ${serviceId}: Processing edit with AI`);
          const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
          const prompt = createPromptTemplate(originalText, promptTemplate);
          const result = await model.generateContent(prompt);
          const response = await result.response;
          processedText = response.text().trim();
          console.log(
            `🤖 Service ${serviceId}: AI processing for edit completed`
          );
        } catch (err) {
          console.error(`❌ Service ${serviceId}: AI Error on edit:`, err);
          // در صورت خطا در AI، از متن ویرایش شده اصلی استفاده کن
        }
      }

      // اعمال قواعد جستجو/جایگزینی بر روی متن ویرایش شده
      if (processedText && searchReplaceRules?.length > 0) {
        for (const rule of searchReplaceRules) {
          if (rule.search) {
            // مطمئن شوید rule.search تعریف شده است
            processedText = processedText.replace(
              new RegExp(rule.search, "g"),
              rule.replace || "" // اگر rule.replace تعریف نشده، با رشته خالی جایگزین کن
            );
          }
        }
      }

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

            // ویرایش پیام موجود در کانال مقصد
            await client.editMessage(targetEntity, {
              message: messageIdToEdit,
              text: processedText,
              parseMode: "html",
              // سایر پارامترهای مورد نیاز برای ویرایش مانند linkPreview یا file (برای ویرایش کپشن مدیا)
              // اگر پیام اصلی مدیا داشته و فقط کپشن ویرایش شده، text به عنوان کپشن جدید عمل خواهد کرد.
              // اگر خود مدیا تغییر کرده باشد، ویرایش پیچیده‌تر است و ممکن است نیاز به ارسال پیام جدید باشد.
              // فعلا فرض بر ویرایش متن یا کپشن است.
            });

            console.log(
              `✅ Service ${serviceId}: Message ${messageIdToEdit} edited successfully in ${targetUsername}`
            );
          } catch (err) {
            console.error(
              `❌ Error editing message ${originalTargetMessageIdString} in ${targetUsername}:`,
              err
            );
            // اینجا می‌توانید تصمیم بگیرید که اگر ویرایش ناموفق بود، پیام جدیدی ارسال شود یا خیر
            // مثلا:
            // console.log(`↪️ Falling back to sending new message in ${targetUsername} for edited content.`);
            // await sendNewMessage(message, processedText, await client.getEntity(targetUsername.startsWith("@") ? targetUsername : `@${targetUsername}`), hasMedia, client);
          }
        } else {
          // اگر به هر دلیلی پیام اصلی در این کانال مقصد قبلا فوروارد نشده بود،
          // پیام ویرایش شده را به عنوان یک پیام جدید ارسال کن. (رفتار فعلی شما)
          console.log(
            `➕ Service ${serviceId}: Original message not found in ${targetUsername}, sending new message for edit.`
          );
          await sendNewMessage(
            message,
            processedText,
            await client.getEntity(
              targetUsername.startsWith("@")
                ? targetUsername
                : `@${targetUsername}`
            ),
            hasMedia,
            client
          );
        }
      }
      // نیازی به ذخیره مجدد در messageMap نیست مگر اینکه بخواهید timestamp ویرایش را نگه دارید
      // یا اگر ID پیام مقصد پس از ویرایش تغییر کند (که معمولا اینطور نیست).
    } else {
      // پیام جدید یا پیامی که قبلاً فوروارد نشده و اکنون ویرایش دریافت کرده (ولی مپینگ ندارد)
      // (رفتار فعلی شما: ارسال به عنوان پیام جدید)
      // ... (بقیه کد برای ارسال پیام جدید) ...
      console.log(
        `✨ Service ${serviceId}: Processing as new message (or edit without prior map)`
      );
      const forwardedMessages = {};
      for (const targetUsername of targetChannels) {
        // ... (کد فعلی شما برای sendNewMessage)
        try {
          const formattedUsername = targetUsername.startsWith("@")
            ? targetUsername
            : `@${targetUsername}`;
          const targetEntity = await client.getEntity(formattedUsername);
          const sentMessage = await sendNewMessage(
            message,
            processedText, // استفاده از متن پردازش شده
            targetEntity,
            hasMedia,
            client
          );
          if (sentMessage) {
            forwardedMessages[targetUsername] = sentMessage.id.toString();
          }
        } catch (err) {
          console.error(
            `❌ Error sending to ${targetUsername} (new/unmapped edit):`,
            err
          );
        }
      }
      if (Object.keys(forwardedMessages).length > 0) {
        const messageData = {
          targetMessageIds: forwardedMessages,
          timestamp: currentTime,
          originalChannelId: channelId.toString(),
          originalMessageId: message.id,
        };
        messageMap.set(messageKey, messageData);
        messageMaps.set(serviceId, messageMap); // اطمینان از اینکه messageMaps به‌روز می‌شود
        saveMessageMap(serviceId, messageMap); // ذخیره در فایل
        console.log(
          `💾 Service ${serviceId}: Message mapping saved for ${messageKey}`
        );
      }
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
