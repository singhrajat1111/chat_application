import bcrypt from 'bcrypt';
import { query } from '../db/index.js';
import { generateToken } from '../middleware/auth.js';

const SALT_ROUNDS = 12;

class AuthService {
  // Register new user
  async register(username, email, password) {
    // Hash password before attempting insert
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    try {
      // Atomic insert — rely on UNIQUE constraints to prevent duplicates
      const result = await query(
        `INSERT INTO users (username, email, password_hash) 
         VALUES ($1, $2, $3) 
         RETURNING id, username, email, created_at`,
        [username, email, passwordHash]
      );

      const user = result.rows[0];
      const token = generateToken(user);

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.created_at,
        },
        token,
      };
    } catch (error) {
      // Handle unique constraint violations without leaking DB internals
      if (error.code === '23505') {
        if (error.constraint?.includes('username')) {
          throw new Error('Username already taken');
        }
        if (error.constraint?.includes('email')) {
          throw new Error('Email already registered');
        }
        throw new Error('Username or email already taken');
      }
      throw error;
    }
  }

  // Login user
  async login(email, password) {
    try {
      // Find user by email
      const result = await query(
        'SELECT id, username, email, password_hash, created_at FROM users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        throw new Error('Invalid credentials');
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      const token = generateToken(user);

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          createdAt: user.created_at,
        },
        token,
      };
    } catch (error) {
      throw error;
    }
  }

  // Get user by ID
  async getUserById(userId) {
    try {
      const result = await query(
        'SELECT id, username, email, created_at FROM users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  // Search users by username
  async searchUsers(searchQuery, currentUserId, limit = 20) {
    try {
      // Escape LIKE wildcards to prevent pattern-based enumeration
      const escaped = searchQuery.replace(/[%_\\]/g, '\\$&');
      const result = await query(
        `SELECT id, username, created_at 
         FROM users 
         WHERE username ILIKE $1 AND id != $2
         ORDER BY username
         LIMIT $3`,
        [`%${escaped}%`, currentUserId, limit]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }
}

export default new AuthService();
