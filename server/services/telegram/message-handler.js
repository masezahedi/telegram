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

    const channelId = message.peerId?.channelId || message.chatId;
    const isFromSourceChannel = sourceChannelIds.some(id => 
      channelId && channelId.toString() === id.toString()
    );

    if (!isFromSourceChannel) {
      console.log(`⛔ Service ${serviceId}: Message from non-source channel ignored`);
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

    // Handle message mapping
    const messageMap = messageMaps.get(serviceId) || new Map();
    if (!messageMaps.has(serviceId)) {
      messageMaps.set(serviceId, messageMap);
    }

    const messageKey = `${channelId}_${message.id}`;
    const currentTime = Date.now();

    let processedText = originalText;

    // Process with AI if enabled
    if (originalText && useAI && genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = createPromptTemplate(originalText, promptTemplate);
        const result = await model.generateContent(prompt);
        const response = await result.response;
        processedText = response.text().trim();
      } catch (err) {
        console.error(`❌ Service ${serviceId}: AI Error:`, err);
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
          const existingMessage = messageMap.get(messageKey);
          const targetMessageId = existingMessage.targetMessageIds?.[targetUsername];

          if (targetMessageId) {
            try {
              await client.editMessage(targetEntity, {
                message: parseInt(targetMessageId),
                text: processedText,
              });
              messageMap.set(messageKey, {
                ...existingMessage,
                timestamp: currentTime,
              });
            } catch (editError) {
              console.error(`❌ Edit error in ${targetUsername}:`, editError.message);
              const sentMessage = await sendNewMessage(
                message,
                processedText,
                targetEntity,
                hasMedia,
                client
              );
              if (sentMessage) {
                existingMessage.targetMessageIds = {
                  ...existingMessage.targetMessageIds,
                  [targetUsername]: sentMessage.id.toString()
                };
                existingMessage.timestamp = currentTime;
                messageMap.set(messageKey, existingMessage);
              }
            }
          }
        } else {
          const sentMessage = await sendNewMessage(
            message,
            processedText,
            targetEntity,
            hasMedia,
            client
          );
          if (sentMessage) {
            messageMap.set(messageKey, {
              targetMessageIds: {
                [targetUsername]: sentMessage.id.toString()
              },
              timestamp: currentTime
            });
          }
        }
      } catch (err) {
        console.error(`❌ Error sending to ${targetUsername}:`, err);
      }
    }

    saveMessageMap(serviceId, messageMap);
  } catch (err) {
    console.error(`❌ Service ${service.id}: Message processing error:`, err);
  }
}

module.exports = {
  processMessage,
  sendNotificationToUser
};