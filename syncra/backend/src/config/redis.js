import { createClient } from 'redis';

class RedisService {
  constructor() {
    this.client = null;
    this.publisher = null;
    this.subscriber = null;
    this.isConnected = false;
    this.isDisabled = false;
  }

  async connect() {
    if (this.isDisabled) return false;

    try {
      let config;
      const socketConfig = {
        reconnectStrategy: false,
        connectTimeout: 5000,
      };

      // Support REDIS_URL (common in managed Redis: Railway, Render, Heroku)
      if (process.env.REDIS_URL) {
        config = {
          url: process.env.REDIS_URL,
          socket: socketConfig,
        };
      } else {
        config = {
          socket: {
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            ...socketConfig,
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
      const handleRedisError = (label) => (err) => {
        if (this.isConnected || !this.isDisabled) {
          console.error(`${label}:`, err.message);
        }
      };
      this.client.on('error', handleRedisError('Redis Client Error'));
      this.publisher.on('error', handleRedisError('Redis Publisher Error'));
      this.subscriber.on('error', handleRedisError('Redis Subscriber Error'));

      // Connect all clients
      await this.client.connect();
      await this.publisher.connect();
      await this.subscriber.connect();

      this.isConnected = true;
      console.log('Redis connected successfully');
      return true;
    } catch (error) {
      console.warn('Redis connection failed, continuing without Redis:', error.message);
      await this.disconnect(true);
      this.isDisabled = true;
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
  async disconnect(silent = false) {
    const closeClient = async (client) => {
      if (!client?.isOpen) return;
      await client.quit();
    };

    try {
      await closeClient(this.client);
      await closeClient(this.publisher);
      await closeClient(this.subscriber);
    } catch (error) {
      if (!silent) throw error;
    }

    this.client = null;
    this.publisher = null;
    this.subscriber = null;
    this.isConnected = false;
  }

  // ---- Participant cache (Redis-backed, scales across instances) ----

  // Cache that a user is a participant in a conversation (TTL 5 min)
  async cacheParticipant(conversationId, userId) {
    if (!this.isConnected) return;
    try {
      await this.client.set(`participant:${conversationId}:${userId}`, '1', { EX: 300 });
    } catch (error) {
      console.error('Error caching participant:', error);
    }
  }

  // Check if participant membership is cached
  async isParticipantCached(conversationId, userId) {
    if (!this.isConnected) return null; // null = cache miss
    try {
      const val = await this.client.get(`participant:${conversationId}:${userId}`);
      return val === '1' ? true : null; // true = confirmed, null = cache miss
    } catch (error) {
      console.error('Error checking participant cache:', error);
      return null;
    }
  }

  // Cache conversation participants list (TTL 5 min)
  async cacheParticipants(conversationId, participants) {
    if (!this.isConnected) return;
    try {
      await this.client.set(
        `participants:${conversationId}`,
        JSON.stringify(participants),
        { EX: 300 }
      );
    } catch (error) {
      console.error('Error caching participants:', error);
    }
  }

  // Get cached participants list
  async getCachedParticipants(conversationId) {
    if (!this.isConnected) return null;
    try {
      const val = await this.client.get(`participants:${conversationId}`);
      return val ? JSON.parse(val) : null;
    } catch (error) {
      console.error('Error getting cached participants:', error);
      return null;
    }
  }
}

// Singleton instance
const redisService = new RedisService();
export default redisService;
