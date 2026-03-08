import { createClient } from 'redis';

class RedisService {
  constructor() {
    this.client = null;
    this.publisher = null;
    this.subscriber = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      let config;

      // Support REDIS_URL (common in managed Redis: Railway, Render, Heroku)
      if (process.env.REDIS_URL) {
        config = { url: process.env.REDIS_URL };
      } else {
        config = {
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
          },
        };

        if (process.env.REDIS_PASSWORD) {
          config.password = process.env.REDIS_PASSWORD;
        }
      }

      // Main client for general operations
      this.client = createClient(config);
      
      // Separate clients for pub/sub (Redis requirement)
      this.publisher = createClient(config);
      this.subscriber = createClient(config);

      // Error handlers
      this.client.on('error', (err) => console.error('Redis Client Error:', err));
      this.publisher.on('error', (err) => console.error('Redis Publisher Error:', err));
      this.subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));

      // Connect all clients
      await this.client.connect();
      await this.publisher.connect();
      await this.subscriber.connect();

      this.isConnected = true;
      console.log('Redis connected successfully');
      return true;
    } catch (error) {
      console.error('Redis connection failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  // Online presence: Store userId -> socketId mapping
  async setUserOnline(userId, socketId) {
    if (!this.isConnected) return;
    try {
      await this.client.hSet('online_users', userId, socketId);
      await this.client.hSet('socket_to_user', socketId, userId);
    } catch (error) {
      console.error('Error setting user online:', error);
    }
  }

  // Remove user from online list
  async setUserOffline(userId, socketId) {
    if (!this.isConnected) return;
    try {
      await this.client.hDel('online_users', userId);
      await this.client.hDel('socket_to_user', socketId);
    } catch (error) {
      console.error('Error setting user offline:', error);
    }
  }

  // Get user's socketId
  async getUserSocketId(userId) {
    if (!this.isConnected) return null;
    try {
      return await this.client.hGet('online_users', userId);
    } catch (error) {
      console.error('Error getting user socket:', error);
      return null;
    }
  }

  // Get userId from socketId
  async getUserIdFromSocket(socketId) {
    if (!this.isConnected) return null;
    try {
      return await this.client.hGet('socket_to_user', socketId);
    } catch (error) {
      console.error('Error getting user from socket:', error);
      return null;
    }
  }

  // Get all online users
  async getOnlineUsers() {
    if (!this.isConnected) return {};
    try {
      return await this.client.hGetAll('online_users');
    } catch (error) {
      console.error('Error getting online users:', error);
      return {};
    }
  }

  // Check if user is online
  async isUserOnline(userId) {
    if (!this.isConnected) return false;
    try {
      const socketId = await this.client.hGet('online_users', userId);
      return !!socketId;
    } catch (error) {
      console.error('Error checking user online status:', error);
      return false;
    }
  }

  // Publish message for scaling (multi-server support)
  async publish(channel, message) {
    if (!this.isConnected) return;
    try {
      await this.publisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error('Error publishing message:', error);
    }
  }

  // Typing indicators (stored in Redis for multi-server support)
  async setTyping(conversationId, userId) {
    if (!this.isConnected) return;
    try {
      const key = `typing:${conversationId}`;
      await this.client.hSet(key, userId, Date.now().toString());
      await this.client.expire(key, 10); // auto-expire after 10s (safety net)
    } catch (error) {
      console.error('Error setting typing:', error);
    }
  }

  async clearTyping(conversationId, userId) {
    if (!this.isConnected) return;
    try {
      await this.client.hDel(`typing:${conversationId}`, userId);
    } catch (error) {
      console.error('Error clearing typing:', error);
    }
  }

  async getTypingUsers(conversationId) {
    if (!this.isConnected) return [];
    try {
      const typing = await this.client.hGetAll(`typing:${conversationId}`);
      const now = Date.now();
      // Filter out stale entries (older than 10s)
      return Object.entries(typing)
        .filter(([, ts]) => now - parseInt(ts) < 10000)
        .map(([userId]) => userId);
    } catch (error) {
      console.error('Error getting typing users:', error);
      return [];
    }
  }

  // Subscribe to channel
  async subscribe(channel, callback) {
    if (!this.isConnected) return;
    try {
      await this.subscriber.subscribe(channel, (message) => {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch (e) {
          callback(message);
        }
      });
    } catch (error) {
      console.error('Error subscribing to channel:', error);
    }
  }

  // Disconnect all clients
  async disconnect() {
    if (this.client) await this.client.quit();
    if (this.publisher) await this.publisher.quit();
    if (this.subscriber) await this.subscriber.quit();
    this.isConnected = false;
  }
}

// Singleton instance
const redisService = new RedisService();
export default redisService;
