import authService from '../services/authService.js';
import logger from '../utils/logger.js';
import { isValidUsername, isValidEmail, MIN_USERNAME_LENGTH, MAX_USERNAME_LENGTH, MIN_PASSWORD_LENGTH } from '../utils/validation.js';

class AuthController {
  async register(req, res) {
    try {
      const { username, email, password } = req.body;

      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({ 
          error: 'Username, email, and password are required' 
        });
      }

      if (username.length < MIN_USERNAME_LENGTH || username.length > MAX_USERNAME_LENGTH) {
        return res.status(400).json({ 
          error: `Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters` 
        });
      }

      if (!isValidUsername(username)) {
        return res.status(400).json({ 
          error: 'Username can only contain letters, numbers, underscores, and hyphens' 
        });
      }

      if (password.length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ 
          error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` 
        });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      const result = await authService.register(username, email, password);
      res.status(201).json(result);
    } catch (error) {
      logger.error('Register error:', error.message);
      // These are domain errors (duplicate user, etc.) — safe to return
      res.status(400).json({ error: error.message });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ 
          error: 'Email and password are required' 
        });
      }

      const result = await authService.login(email, password);
      res.json(result);
    } catch (error) {
      logger.debug('Login failed:', error.message);
      res.status(401).json({ error: 'Invalid credentials' });
    }
  }

  async me(req, res) {
    try {
      const user = await authService.getUserById(req.user.id);
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
      });
    } catch (error) {
      logger.error('Get user error:', error.message);
      res.status(404).json({ error: 'User not found' });
    }
  }

  async searchUsers(req, res) {
    try {
      const { q } = req.query;
      
      if (!q || q.length < 2) {
        return res.status(400).json({ 
          error: 'Search query must be at least 2 characters' 
        });
      }

      const users = await authService.searchUsers(q, req.user.id);
      res.json({ users });
    } catch (error) {
      logger.error('Search users error:', error.message);
      res.status(500).json({ error: 'Search failed' });
    }
  }
}

export default new AuthController();
