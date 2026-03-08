import dotenv from 'dotenv';
// Load environment variables before any other imports that use process.env
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import logger from './utils/logger.js';

import pool, { testConnection, initializeSchema } from './db/index.js';
import redisService from './config/redis.js';
import { authenticateSocket } from './middleware/auth.js';
import { setupSocketHandlers, subscribeToRedis } from './sockets/index.js';

// Import routes
import authRoutes from './routes/auth.js';
import conversationRoutes from './routes/conversations.js';
import messageRoutes from './routes/messages.js';

// Validate required environment variables in production
if (process.env.NODE_ENV === 'production') {
  const required = ['JWT_SECRET', 'CLIENT_URL'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('JWT_SECRET must be at least 32 characters in production');
    process.exit(1);
  }
}

const app = express();
const httpServer = createServer(app);

// Trust proxy when behind reverse proxy (nginx, load balancer)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',')
  : ['http://localhost:5173'];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Scaling-ready configuration
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // stricter limit for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' },
});

// Request logging
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'connected',
      redis: redisService.isConnected ? 'connected' : 'disconnected',
    }
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/conversations', apiLimiter, conversationRoutes);
app.use('/api/messages', apiLimiter, messageRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  // Handle multer errors (file upload issues)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large' });
  }
  if (err.message?.includes('File type') && err.message?.includes('not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  logger.error('Unhandled express error:', err.message);
  res.status(err.status || 500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Socket.io authentication middleware
io.use(authenticateSocket);

// Setup socket handlers
setupSocketHandlers(io);

// Initialize services and start server
const startServer = async () => {
  try {
    // Test database connection
    logger.info('Connecting to database...');
    const dbConnected = await testConnection();
    if (!dbConnected) {
      logger.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Initialize database schema (safe — uses IF NOT EXISTS)
    logger.info('Initializing database schema...');
    await initializeSchema();

    // Connect to Redis
    logger.info('Connecting to Redis...');
    const redisConnected = await redisService.connect();
    if (!redisConnected) {
      logger.warn('Redis connection failed. Continuing without Redis...');
    } else {
      // Subscribe to Redis pub/sub channels after successful connection
      await subscribeToRedis(io);
    }

    // Start HTTP server
    httpServer.listen(PORT, () => {
      logger.info(`Syncra server running on port ${PORT} [${process.env.NODE_ENV || 'development'}] — DB: connected, Redis: ${redisConnected ? 'connected' : 'disconnected'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    await redisService.disconnect();
    logger.info('Redis connections closed');
  } catch (err) {
    logger.error('Error closing Redis:', err.message);
  }

  try {
    await pool.end();
    logger.info('Database pool closed');
  } catch (err) {
    logger.error('Error closing database pool:', err.message);
  }
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

// Start the server
startServer();
