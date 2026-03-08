import redisService from '../config/redis.js';
import conversationService from '../services/conversationService.js';
import logger from '../utils/logger.js';
import { isValidUUID } from '../utils/validation.js';
import { cleanupSocket } from '../utils/socketRateLimit.js';

export const setupPresenceHandlers = (io, socket) => {
  const userId = socket.user.id;
  const username = socket.user.username;

  // Join user's personal room for direct messaging
  socket.join(`user:${userId}`);

  // Broadcast presence only to users who share a conversation with this user
  const broadcastPresence = async (event) => {
    try {
      const partnerIds = await conversationService.getConversationPartnerIds(userId);
      for (const partnerId of partnerIds) {
        io.to(`user:${partnerId}`).emit(event, {
          userId,
          username,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      logger.error('Error broadcasting presence:', error.message);
    }
  };

  // Set user as online
  const setOnline = async () => {
    try {
      await redisService.setUserOnline(userId, socket.id);
      await broadcastPresence('user:online');
      logger.debug(`User ${username} is now online`);
    } catch (error) {
      logger.error('Error setting user online:', error.message);
    }
  };

  // Set user as offline
  const setOffline = async () => {
    try {
      await redisService.setUserOffline(userId, socket.id);
      await broadcastPresence('user:offline');
      logger.debug(`User ${username} is now offline`);
    } catch (error) {
      logger.error('Error setting user offline:', error.message);
    }
  };

  // Handle disconnect
  socket.on('disconnect', async (reason) => {
    logger.debug(`User ${username} disconnected: ${reason}`);
    cleanupSocket(socket.id);
    await setOffline();
  });

  // Handle explicit logout
  socket.on('user:logout', async () => {
    await setOffline();
  });

  // Get online users (filtered to users sharing conversations with requester)
  socket.on('presence:getOnline', async (callback) => {
    try {
      const onlineUsers = await redisService.getOnlineUsers();
      const allOnlineIds = Object.keys(onlineUsers);
      // Only return users who share a conversation with the requester
      const partnerIds = await conversationService.getConversationPartnerIds(userId);
      const partnerSet = new Set(partnerIds);
      const filteredOnline = allOnlineIds.filter(id => partnerSet.has(id));
      if (callback) {
        callback({ 
          success: true, 
          onlineUsers: filteredOnline 
        });
      }
    } catch (error) {
      logger.error('Error getting online users:', error.message);
      if (callback) callback({ error: 'Failed to get online users' });
    }
  });

  // Check if specific user is online
  socket.on('presence:check', async (data, callback) => {
    try {
      const { userId: checkUserId } = data;
      if (!checkUserId || !isValidUUID(checkUserId)) {
        if (callback) callback({ error: 'Invalid user ID' });
        return;
      }
      const isOnline = await redisService.isUserOnline(checkUserId);
      if (callback) {
        callback({ success: true, userId: checkUserId, isOnline });
      }
    } catch (error) {
      logger.error('Error checking presence:', error.message);
      if (callback) callback({ error: 'Failed to check presence' });
    }
  });

  // Set user online on connection
  setOnline();
};
