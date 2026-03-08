import dotenv from 'dotenv';
dotenv.config();

import dns from 'dns';
// Force IPv4 to avoid ENETUNREACH on networks without IPv6
dns.setDefaultResultOrder('ipv4first');

import pg from 'pg';
const { Pool } = pg;

import logger from '../utils/logger.js';

// Support Supabase connection string or individual params
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'syncra',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_HOST?.includes('supabase') ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

// Log pool errors (don't crash on idle client errors)
pool.on('error', (err) => {
  logger.error('Unexpected pool error:', err.message);
});

// Query helper
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug(`Query (${duration}ms):`, text.substring(0, 60));
    return result;
  } catch (error) {
    logger.error('Database query error:', error.message);
    throw error;
  }
};

// Get client for transactions
export const getClient = () => pool.connect();

// Test connection
export const testConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    logger.info('Database connected at:', result.rows[0].now);
    return true;
  } catch (error) {
    logger.error('Database connection failed:', error.message);
    return false;
  }
};

// Initialize schema (runs CREATE IF NOT EXISTS — safe to call every startup)
export const initializeSchema = async () => {
  const { readFileSync, readdirSync, existsSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const schemaPath = join(__dirname, 'schema.sql');

  const schema = readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
  logger.info('Database schema initialized');

  // Run migrations (safe to re-run — all use IF NOT EXISTS)
  const migrationsDir = join(__dirname, 'migrations');
  if (existsSync(migrationsDir)) {
    const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      await pool.query(sql);
      logger.info(`Migration applied: ${file}`);
    }
  }
};

export default pool;
