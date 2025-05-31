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
async function sendNewMessage(message, finalText, targetChannel, hasValidMedia, client) {
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
async function processMessage(message, isEdit, sourceChannelIds, service, client, genAI) {
  try {
    const serviceId = service.id;
    const targetChannels = JSON.parse(service.target_channels);
    const searchReplaceRules = JSON.parse(service.search_replace_rules);
    const useAI = Boolean(service.prompt_template);
    const promptTemplate = service.prompt_template;

    if (!message) {
      console.log(`⛔ Service ${serviceId}: Empty message`);
      return;
    }

    // بهتر شده: دقیق‌تر channel ID رو استخراج کن
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
      return;
    }

    // بهتر شده: دقیق‌تر بررسی کن که از source channel هست یا نه
    const isFromSourceChannel = sourceChannelIds.some(sourceId => {
      // Handle different ID types (BigInt, Number, String)
      const sourceIdStr = sourceId?.toString?.() || String(sourceId);
      const channelIdStr = channelId?.toString?.() || String(channelId);
      
      // Try multiple comparison methods
      return sourceIdStr === channelIdStr || 
             sourceId?.value?.toString() === channelId?.value?.toString() ||
             Math.abs(sourceId) === Math.abs(channelId);
    });

    if (!isFromSourceChannel) {
      console.log(`⛔ Service ${serviceId}: Message from non-source channel ignored`);
      console.log(`Channel ID: ${channelId}, Source IDs: ${sourceChannelIds.map(id => id.toString())}`);
      return;
    }

    const originalText = message.message || message.caption;
    const hasMedia = message.media && 
      message.media.className !== "MessageMediaEmpty" && 
      message.media.className !== "MessageMediaWebPage";

    if (!originalText && !hasMedia) {
      console.log(`⛔ Service ${serviceId}: Message without text and media ignored`);
      return;
    }

    // Handle message mapping - بهتر شده
    const messageMap = messageMaps.get(serviceId) || new Map();
    if (!messageMaps.has(serviceId)) {
      messageMaps.set(serviceId, messageMap);
    }

    // بهتر شده: دقیق‌تر message key بساز
    const messageKey = `${channelId.toString()}_${message.id}`;
    const currentTime = Date.now();

    console.log(`📝 Processing message: ${messageKey}, isEdit: ${isEdit}`);

    let processedText = originalText;

    // Process with AI if enabled
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
        processedText = originalText; // Fallback to original text
      }
    }

    // Apply search/replace rules
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

    // Send to target channels
    for (const targetUsername of targetChannels) {
      try {
        const formattedUsername = targetUsername.startsWith("@") 
          ? targetUsername 
          : `@${targetUsername}`;
        const targetEntity = await client.getEntity(formattedUsername);

        if (isEdit && messageMap.has(messageKey)) {
          // ادیت کردن پیام موجود
          const existingMessage = messageMap.get(messageKey);
          console.log(`🔄 Service ${serviceId}: Editing existing message for ${targetUsername}`);
          console.log(`Existing message data:`, existingMessage);

          // بهتر شده: دقیق‌تر target message ID رو پیدا کن
          const targetMessageId = existingMessage.targetMessageIds?.[targetUsername];

          if (targetMessageId) {
            try {
              console.log(`✏️ Service ${serviceId}: Attempting to edit message ${targetMessageId} in ${targetUsername}`);
              
              await client.editMessage(targetEntity, {
                message: parseInt(targetMessageId),
                text: processedText,
                parseMode: "html",
              });

              console.log(`✅ Service ${serviceId}: Message edited successfully in ${targetUsername}`);

              // Update timestamp
              existingMessage.timestamp = currentTime;
              messageMap.set(messageKey, existingMessage);
              
            } catch (editError) {
              console.error(`❌ Edit error in ${targetUsername}:`, editError.message);
              
              // اگر ادیت نشد، پیام جدید بفرست
              console.log(`🔄 Service ${serviceId}: Sending new message instead of editing`);
              const sentMessage = await sendNewMessage(
                message,
                processedText,
                targetEntity,
                hasMedia,
                client
              );
              
              if (sentMessage) {
                // بهتر شده: درست update کن
                if (!existingMessage.targetMessageIds) {
                  existingMessage.targetMessageIds = {};
                }
                existingMessage.targetMessageIds[targetUsername] = sentMessage.id.toString();
                existingMessage.timestamp = currentTime;
                messageMap.set(messageKey, existingMessage);
                console.log(`📝 Service ${serviceId}: Updated message mapping for ${targetUsername}`);
              }
            }
          } else {
            console.log(`⚠️ Service ${serviceId}: No target message ID found for ${targetUsername}, sending new message`);
            // اگر target message ID نداریم، پیام جدید بفرست
            const sentMessage = await sendNewMessage(
              message,
              processedText,
              targetEntity,
              hasMedia,
              client
            );
            
            if (sentMessage) {
              // بهتر شده: اگر existingMessage وجود داره ولی targetMessageIds نداره
              if (!existingMessage.targetMessageIds) {
                existingMessage.targetMessageIds = {};
              }
              existingMessage.targetMessageIds[targetUsername] = sentMessage.id.toString();
              existingMessage.timestamp = currentTime;
              messageMap.set(messageKey, existingMessage);
            }
          }
        } else {
          // پیام جدید بفرست
          console.log(`📤 Service ${serviceId}: Sending new message to ${targetUsername}`);
          const sentMessage = await sendNewMessage(
            message,
            processedText,
            targetEntity,
            hasMedia,
            client
          );
          
          if (sentMessage) {
            // بهتر شده: درست message mapping رو ذخیره کن
            const messageData = {
              targetMessageIds: {
                [targetUsername]: sentMessage.id.toString()
              },
              timestamp: currentTime,
              originalChannelId: channelId.toString(),
              originalMessageId: message.id
            };
            
            messageMap.set(messageKey, messageData);
            console.log(`📝 Service ${serviceId}: Saved message mapping: ${messageKey} -> ${sentMessage.id}`);
          }
        }
      } catch (err) {
        console.error(`❌ Error sending to ${targetUsername}:`, err);
      }
    }

    // ذخیره message map
    saveMessageMap(serviceId, messageMap);
    console.log(`💾 Service ${serviceId}: Message map saved`);

  } catch (err) {
    console.error(`❌ Service ${service.id}: Message processing error:`, err);
  }
}

module.exports = {
  processMessage,
  sendNotificationToUser
};