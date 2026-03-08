import { setupMessageHandlers } from './messageHandlers.js';
import { setupPresenceHandlers } from './presenceHandlers.js';
import redisService from '../config/redis.js';
import logger from '../utils/logger.js';

// Subscribe to Redis pub/sub after Redis is connected
export const subscribeToRedis = async (io) => {
  await redisService.subscribe('message:new', (data) => {
    const { recipientIds, ...messagePayload } = data;
    if (recipientIds) {
      recipientIds.forEach((recipientId) => {
        io.to(`user:${recipientId}`).emit('message:new', messagePayload);
      });
    }
  });
};

export const setupSocketHandlers = (io) => {
  // Main connection handler
  io.on('connection', (socket) => {
    logger.debug(`Socket connected: ${socket.id}, User: ${socket.user?.username}`);

    // Setup handlers
    setupPresenceHandlers(io, socket);
    setupMessageHandlers(io, socket);

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for ${socket.id}:`, error.message);
    });
  });
};
