// Enhanced message-handler.js with Edit Support
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
  client
) {
  try {
    console.log(`✏️ Editing message ID: ${targetMessageId}`);

    if (hasValidMedia) {
      // برای پیام‌های رسانه‌ای، فقط caption قابل ویرایش است
      await client.editMessage(targetChannel, {
        message: targetMessageId,
        text: finalText,
        parseMode: "html",
      });
    } else {
      // برای پیام‌های متنی
      await client.editMessage(targetChannel, {
        message: targetMessageId,
        text: finalText,
        parseMode: "html",
      });
    }

    console.log("✅ Message edited successfully");
    return true;
  } catch (err) {
    console.error("❌ Error editing message:", err);
    return false;
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

    // 🔥 IMPROVED: مدیریت Edit vs New Message
    const forwardedMessages = {};

    if (isEdit && messageMap.has(messageKey)) {
      // 🔥 EDIT MODE: ویرایش پیام‌های موجود
      console.log(`✏️ Service ${serviceId}: Editing existing messages`);

      const existingMessageData = messageMap.get(messageKey);
      const targetMessageIds = existingMessageData.targetMessageIds;

      for (const targetUsername of targetChannels) {
        try {
          const formattedUsername = targetUsername.startsWith("@")
            ? targetUsername
            : `@${targetUsername}`;
          const targetEntity = await client.getEntity(formattedUsername);

          // بررسی اینکه آیا پیام در این کانال وجود دارد
          if (targetMessageIds[targetUsername]) {
            const targetMessageId = parseInt(targetMessageIds[targetUsername]);

            console.log(
              `✏️ Service ${serviceId}: Editing message ${targetMessageId} in ${targetUsername}`
            );

            const editSuccess = await editExistingMessage(
              targetMessageId,
              processedText,
              targetEntity,
              hasMedia,
              client
            );

            if (editSuccess) {
              forwardedMessages[targetUsername] = targetMessageId.toString();
              console.log(
                `✅ Service ${serviceId}: Message edited in ${targetUsername} (ID: ${targetMessageId})`
              );
            } else {
              console.log(
                `⚠️ Service ${serviceId}: Failed to edit message in ${targetUsername}, will send new message`
              );

              // اگر ویرایش ناموفق بود، پیام جدید ارسال کن
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
          } else {
            console.log(
              `⚠️ Service ${serviceId}: No existing message found for ${targetUsername}, sending new message`
            );

            // اگر پیام قبلی وجود نداشت، پیام جدید ارسال کن
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
          console.error(`❌ Error editing/sending to ${targetUsername}:`, err);
        }
      }

      // به‌روزرسانی messageMap با ID های جدید (در صورت نیاز)
      if (Object.keys(forwardedMessages).length > 0) {
        const updatedMessageData = {
          ...existingMessageData,
          targetMessageIds: {
            ...existingMessageData.targetMessageIds,
            ...forwardedMessages,
          },
          lastEditTimestamp: currentTime,
        };
        messageMap.set(messageKey, updatedMessageData);
        messageMaps.set(serviceId, messageMap);
        console.log(
          `💾 Service ${serviceId}: Message mapping updated for edit`
        );
      }
    } else {
      // 🔥 NEW MESSAGE MODE: ارسال پیام جدید
      console.log(`📤 Service ${serviceId}: Sending new messages`);

      // اگر پیام قبلاً پردازش شده، از ارسال مجدد جلوگیری کن
      if (messageMap.has(messageKey)) {
        console.log(
          `⏭️ Service ${serviceId}: Message already processed, skipping`
        );
        return null;
      }

      for (const targetUsername of targetChannels) {
        try {
          const formattedUsername = targetUsername.startsWith("@")
            ? targetUsername
            : `@${targetUsername}`;
          const targetEntity = await client.getEntity(formattedUsername);

          // ارسال پیام جدید
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
        console.log(
          `💾 Service ${serviceId}: Message mapping saved for new message`
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
