import messageService from '../services/messageService.js';
import conversationService from '../services/conversationService.js';
import redisService from '../config/redis.js';
import logger from '../utils/logger.js';
import { isValidUUID, sanitizeContent, MAX_MESSAGE_LENGTH } from '../utils/validation.js';

// In-memory participant cache to avoid DB hit on every socket event
// Key: `${conversationId}:${userId}`, Value: timestamp
const participantCache = new Map();
const PARTICIPANT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const isParticipantCached = async (conversationId, userId) => {
  const key = `${conversationId}:${userId}`;
  const cached = participantCache.get(key);
  if (cached && Date.now() - cached < PARTICIPANT_CACHE_TTL) {
    return true;
  }
  const result = await conversationService.isParticipant(conversationId, userId);
  if (result) {
    participantCache.set(key, Date.now());
  }
  return result;
};

export const setupMessageHandlers = (io, socket) => {
  const userId = socket.user.id;

  // Handle sending a message
  socket.on('message:send', async (data, callback) => {
    try {
      const { conversationId, content } = data;

      if (!conversationId || !isValidUUID(conversationId)) {
        if (callback) callback({ error: 'Invalid conversation' });
        return;
      }

      const sanitized = sanitizeContent(content);
      if (!sanitized || sanitized.length === 0) {
        if (callback) callback({ error: 'Message content is required' });
        return;
      }
      if (sanitized.length > MAX_MESSAGE_LENGTH) {
        if (callback) callback({ error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
        return;
      }

      // Verify user is participant (cached)
      const isParticipant = await isParticipantCached(conversationId, userId);

      if (!isParticipant) {
        if (callback) callback({ error: 'Not authorized' });
        return;
      }

      // Create message
      const message = await messageService.createMessage(
        conversationId,
        userId,
        sanitized
      );

      // Get conversation participants
      const participants = await conversationService.getConversationParticipants(
        conversationId
      );

      // Prepare message payload
      const messagePayload = {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        senderUsername: socket.user.username,
        content: message.content,
        status: message.status,
        createdAt: message.createdAt,
      };

      // Emit to all participants in the conversation
      participants.forEach((participant) => {
        if (participant.id !== userId) {
          // Emit to recipient
          io.to(`user:${participant.id}`).emit('message:new', messagePayload);
        }
      });

      // Also emit back to sender with confirmation
      socket.emit('message:sent', messagePayload);

      // Publish for scaling (multi-server support)
      await redisService.publish('message:new', {
        ...messagePayload,
        recipientIds: participants.filter(p => p.id !== userId).map(p => p.id),
      });

      // Clear typing indicator via Redis
      await redisService.clearTyping(conversationId, userId);
      await broadcastTypingStatus(io, conversationId, userId);

      if (callback) callback({ success: true, message: messagePayload });
    } catch (error) {
      logger.error('Error sending message:', error.message);
      if (callback) callback({ error: 'Failed to send message' });
    }
  });

  // Handle message delivered
  socket.on('message:delivered', async (data, callback) => {
    try {
      const { messageId, conversationId } = data;

      if (!messageId || !conversationId || !isValidUUID(messageId) || !isValidUUID(conversationId)) {
        if (callback) callback({ error: 'Invalid data' });
        return;
      }

      // Update message status to delivered
      const updatedMessage = await messageService.updateMessageStatus(
        messageId,
        'delivered',
        userId
      );

      // Notify the sender that the message was delivered
      const participants = await conversationService.getConversationParticipants(
        conversationId
      );

      participants.forEach((participant) => {
        if (participant.id !== userId) {
          io.to(`user:${participant.id}`).emit('message:delivered', {
            conversationId,
            messageId,
          });
        }
      });

      if (callback) callback({ success: true });
    } catch (error) {
      logger.error('Error marking message as delivered:', error.message);
      if (callback) callback({ error: 'Failed to mark as delivered' });
    }
  });

  // Handle message seen
  socket.on('message:seen', async (data, callback) => {
    try {
      const { conversationId } = data;

      if (!conversationId || !isValidUUID(conversationId)) {
        if (callback) callback({ error: 'Invalid conversation' });
        return;
      }

      // Mark all messages as seen
      const messageIds = await messageService.markConversationAsSeen(
        conversationId,
        userId
      );

      if (messageIds.length > 0) {
        // Get conversation participants
        const participants = await conversationService.getConversationParticipants(
          conversationId
        );

        // Notify sender(s) that their messages were seen
        participants.forEach((participant) => {
          if (participant.id !== userId) {
            io.to(`user:${participant.id}`).emit('message:seen', {
              conversationId,
              messageIds,
              seenBy: userId,
            });
          }
        });
      }

      if (callback) callback({ success: true, messageIds });
    } catch (error) {
      logger.error('Error marking as seen:', error.message);
      if (callback) callback({ error: 'Failed to mark as seen' });
    }
  });

  // Handle typing start
  socket.on('typing:start', async (data) => {
    try {
      const { conversationId } = data;
      if (!conversationId || !isValidUUID(conversationId)) return;

      // Use cached participant check to avoid DB hit on every keypress
      const isParticipant = await isParticipantCached(conversationId, userId);
      if (!isParticipant) return;

      await redisService.setTyping(conversationId, userId);
      await broadcastTypingStatus(io, conversationId, userId);
    } catch (error) {
      logger.error('Error handling typing start:', error.message);
    }
  });

  // Handle typing stop
  socket.on('typing:stop', async (data) => {
    try {
      const { conversationId } = data;
      if (!conversationId || !isValidUUID(conversationId)) return;

      await redisService.clearTyping(conversationId, userId);
      await broadcastTypingStatus(io, conversationId, userId);
    } catch (error) {
      logger.error('Error handling typing stop:', error.message);
    }
  });
};

// Broadcast typing status to conversation participants
const broadcastTypingStatus = async (io, conversationId, excludeUserId) => {
  try {
    const typingUserIds = await redisService.getTypingUsers(conversationId);

    const participants = await conversationService.getConversationParticipants(
      conversationId
    );

    participants.forEach((participant) => {
      if (participant.id !== excludeUserId) {
        io.to(`user:${participant.id}`).emit('typing:update', {
          conversationId,
          typingUsers: typingUserIds,
        });
      }
    });
  } catch (error) {
    logger.error('Error broadcasting typing status:', error.message);
  }
};
