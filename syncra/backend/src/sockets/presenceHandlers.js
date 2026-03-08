import redisService from '../config/redis.js';
import conversationService from '../services/conversationService.js';
import logger from '../utils/logger.js';

export const setupPresenceHandlers = (io, socket) => {
  const userId = socket.user.id;
  const username = socket.user.username;

  // Join user's personal room for direct messaging
  socket.join(`user:${userId}`);

  // Broadcast presence only to users who share a conversation with this user
  const broadcastPresence = async (event) => {
    try {
      const conversations = await conversationService.getUserConversations(userId);
      const notifiedIds = new Set();
      for (const conv of conversations) {
        const otherId = conv.otherUser?.id;
        if (otherId && !notifiedIds.has(otherId)) {
          notifiedIds.add(otherId);
          io.to(`user:${otherId}`).emit(event, {
            userId,
            username,
            timestamp: new Date().toISOString(),
          });
        }
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
    await setOffline();
  });

  // Handle explicit logout
  socket.on('user:logout', async () => {
    await setOffline();
  });

  // Get online users (for client to know who's online)
  socket.on('presence:getOnline', async (callback) => {
    try {
      const onlineUsers = await redisService.getOnlineUsers();
      if (callback) {
        callback({ 
          success: true, 
          onlineUsers: Object.keys(onlineUsers) 
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
