import messageService from '../services/messageService.js';
import conversationService from '../services/conversationService.js';
import serverService from '../services/serverService.js';
import channelService from '../services/channelService.js';
import redisService from '../config/redis.js';
import logger from '../utils/logger.js';
import { isValidUUID, sanitizeContent, MAX_MESSAGE_LENGTH } from '../utils/validation.js';
import { createSocketRateLimiter, cleanupSocket } from '../utils/socketRateLimit.js';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../db/index.js';

// Rate limiters: messages = 30/min, typing = 60/min, status updates = 60/min
const messageLimit = createSocketRateLimiter(30, 60_000);
const typingLimit = createSocketRateLimiter(60, 60_000);
const statusLimit = createSocketRateLimiter(60, 60_000);

// Redis-backed participant cache (scales across instances)
const isParticipantCached = async (conversationId, userId) => {
  const cached = await redisService.isParticipantCached(conversationId, userId);
  if (cached === true) return true;
  const result = await conversationService.isParticipant(conversationId, userId);
  if (result) {
    await redisService.cacheParticipant(conversationId, userId);
  }
  return result;
};

// Get participants with Redis cache
const getParticipantsCached = async (conversationId) => {
  const cached = await redisService.getCachedParticipants(conversationId);
  if (cached) return cached;
  const participants = await conversationService.getConversationParticipants(conversationId);
  await redisService.cacheParticipants(conversationId, participants);
  return participants;
};

export const setupMessageHandlers = (io, socket) => {
  const userId = socket.user.id;

  // Handle sending a message
  socket.on('message:send', async (data, callback) => {
    try {
      if (!messageLimit(socket, 'message:send')) {
        if (callback) callback({ error: 'Too many messages, slow down' });
        return;
      }

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
      const participants = await getParticipantsCached(
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
        messageType: message.messageType || 'text',
        mediaUrl: message.mediaUrl || null,
        fileName: message.fileName || null,
        fileSize: message.fileSize || null,
        mimeType: message.mimeType || null,
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
      if (!statusLimit(socket, 'message:delivered')) {
        if (callback) callback({ error: 'Too many requests' });
        return;
      }

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
      const participants = await getParticipantsCached(
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
      if (!statusLimit(socket, 'message:seen')) {
        if (callback) callback({ error: 'Too many requests' });
        return;
      }

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
        const participants = await getParticipantsCached(
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
      if (!typingLimit(socket, 'typing')) return;

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

  // ============================================================
  // SERVER/CHANNEL HANDLERS
  // ============================================================

  // Join a server's socket rooms (called when user selects a server)
  socket.on('server:join', async (data, callback) => {
    try {
      const { serverId } = data;
      if (!serverId || !isValidUUID(serverId)) {
        if (callback) callback({ error: 'Invalid server' });
        return;
      }
      const isMember = await serverService.isMember(serverId, userId);
      if (!isMember) {
        if (callback) callback({ error: 'Not a member' });
        return;
      }
      socket.join(`server:${serverId}`);
      if (callback) callback({ success: true });
    } catch (error) {
      logger.error('Error joining server room:', error.message);
      if (callback) callback({ error: 'Failed to join server' });
    }
  });

  // Leave server room
  socket.on('server:leave', (data) => {
    const { serverId } = data;
    if (serverId) socket.leave(`server:${serverId}`);
  });

  // Join a specific channel room
  socket.on('channel:join', async (data, callback) => {
    try {
      const { channelId } = data;
      if (!channelId || !isValidUUID(channelId)) {
        if (callback) callback({ error: 'Invalid channel' });
        return;
      }
      const channel = await channelService.getChannel(channelId);
      if (!channel) {
        if (callback) callback({ error: 'Channel not found' });
        return;
      }
      const isMember = await serverService.isMember(channel.serverId, userId);
      if (!isMember) {
        if (callback) callback({ error: 'Not a member' });
        return;
      }
      socket.join(`channel:${channelId}`);
      if (callback) callback({ success: true });
    } catch (error) {
      logger.error('Error joining channel room:', error.message);
      if (callback) callback({ error: 'Failed to join channel' });
    }
  });

  socket.on('channel:leave', (data) => {
    const { channelId } = data;
    if (channelId) socket.leave(`channel:${channelId}`);
  });

  // Send message in a channel
  socket.on('channel:message:send', async (data, callback) => {
    try {
      if (!messageLimit(socket, 'channel:message:send')) {
        if (callback) callback({ error: 'Too many messages, slow down' });
        return;
      }

      const { channelId, content, replyToId } = data;
      if (!channelId || !isValidUUID(channelId)) {
        if (callback) callback({ error: 'Invalid channel' });
        return;
      }

      const sanitized = sanitizeContent(content);
      if (!sanitized || sanitized.length === 0) {
        if (callback) callback({ error: 'Message content is required' });
        return;
      }
      if (sanitized.length > MAX_MESSAGE_LENGTH) {
        if (callback) callback({ error: 'Message too long' });
        return;
      }

      const channel = await channelService.getChannel(channelId);
      if (!channel) {
        if (callback) callback({ error: 'Channel not found' });
        return;
      }
      const isMember = await serverService.isMember(channel.serverId, userId);
      if (!isMember) {
        if (callback) callback({ error: 'Not a member' });
        return;
      }

      // Get reply info if replying
      let replyTo = null;
      if (replyToId && isValidUUID(replyToId)) {
        const replyResult = await query(
          `SELECT m.content, m.sender_id, u.username as sender_username
           FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = $1`,
          [replyToId]
        );
        if (replyResult.rows.length > 0) {
          replyTo = {
            content: replyResult.rows[0].content,
            senderId: replyResult.rows[0].sender_id,
            senderUsername: replyResult.rows[0].sender_username,
          };
        }
      }

      const result = await query(
        `INSERT INTO messages (id, channel_id, sender_id, content, message_type, reply_to_id, status)
         VALUES ($1, $2, $3, $4, 'text', $5, 'sent')
         RETURNING *`,
        [uuidv4(), channelId, userId, sanitized, replyToId || null]
      );

      const msg = result.rows[0];
      const messagePayload = {
        id: msg.id,
        channelId: msg.channel_id,
        senderId: msg.sender_id,
        senderUsername: socket.user.username,
        content: msg.content,
        messageType: msg.message_type,
        status: msg.status,
        isEdited: false,
        isDeleted: false,
        replyToId: msg.reply_to_id,
        replyTo,
        createdAt: msg.created_at,
        reactions: [],
      };

      // Broadcast to everyone in the channel room
      io.to(`channel:${channelId}`).emit('channel:message:new', messagePayload);

      if (callback) callback({ success: true, message: messagePayload });
    } catch (error) {
      logger.error('Error sending channel message:', error.message);
      if (callback) callback({ error: 'Failed to send message' });
    }
  });

  // Channel typing
  socket.on('channel:typing:start', async (data) => {
    try {
      if (!typingLimit(socket, 'channel:typing')) return;
      const { channelId } = data;
      if (!channelId || !isValidUUID(channelId)) return;
      socket.to(`channel:${channelId}`).emit('channel:typing:update', {
        channelId,
        userId,
        username: socket.user.username,
        isTyping: true,
      });
    } catch (error) {
      logger.error('Error channel typing start:', error.message);
    }
  });

  socket.on('channel:typing:stop', async (data) => {
    try {
      const { channelId } = data;
      if (!channelId || !isValidUUID(channelId)) return;
      socket.to(`channel:${channelId}`).emit('channel:typing:update', {
        channelId,
        userId,
        username: socket.user.username,
        isTyping: false,
      });
    } catch (error) {
      logger.error('Error channel typing stop:', error.message);
    }
  });

  // Reaction via socket (real-time)
  socket.on('message:reaction:add', async (data, callback) => {
    try {
      const { messageId, emoji, channelId } = data;
      if (!messageId || !emoji) {
        if (callback) callback({ error: 'Invalid data' });
        return;
      }
      await query(
        `INSERT INTO message_reactions (message_id, user_id, emoji)
         VALUES ($1, $2, $3)
         ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
        [messageId, userId, emoji]
      );
      const payload = { messageId, emoji, channelId, userId, username: socket.user.username };
      if (channelId) {
        io.to(`channel:${channelId}`).emit('message:reaction:added', payload);
      }
      if (callback) callback({ success: true });
    } catch (error) {
      logger.error('Error adding reaction:', error.message);
      if (callback) callback({ error: 'Failed' });
    }
  });

  socket.on('message:reaction:remove', async (data, callback) => {
    try {
      const { messageId, emoji, channelId } = data;
      if (!messageId || !emoji) {
        if (callback) callback({ error: 'Invalid data' });
        return;
      }
      await query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
        [messageId, userId, emoji]
      );
      const payload = { messageId, emoji, channelId, userId };
      if (channelId) {
        io.to(`channel:${channelId}`).emit('message:reaction:removed', payload);
      }
      if (callback) callback({ success: true });
    } catch (error) {
      logger.error('Error removing reaction:', error.message);
      if (callback) callback({ error: 'Failed' });
    }
  });

  // Edit message via socket
  socket.on('message:edit', async (data, callback) => {
    try {
      const { messageId, content, channelId } = data;
      const sanitized = sanitizeContent(content);
      if (!sanitized) {
        if (callback) callback({ error: 'Content required' });
        return;
      }
      const result = await query(
        `UPDATE messages SET content = $1, is_edited = true, edited_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND sender_id = $3 AND is_deleted = false RETURNING *`,
        [sanitized, messageId, userId]
      );
      if (result.rows.length === 0) {
        if (callback) callback({ error: 'Not found or not yours' });
        return;
      }
      const payload = { messageId, content: sanitized, channelId, isEdited: true, editedAt: result.rows[0].edited_at };
      if (channelId) {
        io.to(`channel:${channelId}`).emit('message:edited', payload);
      }
      if (callback) callback({ success: true, ...payload });
    } catch (error) {
      logger.error('Error editing message:', error.message);
      if (callback) callback({ error: 'Failed' });
    }
  });

  // Delete message via socket
  socket.on('message:delete', async (data, callback) => {
    try {
      const { messageId, channelId } = data;
      const result = await query(
        `UPDATE messages SET is_deleted = true, content = NULL
         WHERE id = $1 AND (sender_id = $2 OR EXISTS (
           SELECT 1 FROM server_members sm
           JOIN channels ch ON ch.server_id = sm.server_id
           WHERE ch.id = messages.channel_id AND sm.user_id = $2 AND sm.role IN ('owner', 'admin', 'moderator')
         )) RETURNING id`,
        [messageId, userId]
      );
      if (result.rows.length === 0) {
        if (callback) callback({ error: 'Not found or not authorized' });
        return;
      }
      if (channelId) {
        io.to(`channel:${channelId}`).emit('message:deleted', { messageId, channelId });
      }
      if (callback) callback({ success: true });
    } catch (error) {
      logger.error('Error deleting message:', error.message);
      if (callback) callback({ error: 'Failed' });
    }
  });
};

// Broadcast typing status to conversation participants
const broadcastTypingStatus = async (io, conversationId, excludeUserId) => {
  try {
    const typingUserIds = await redisService.getTypingUsers(conversationId);

    const participants = await getParticipantsCached(
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
