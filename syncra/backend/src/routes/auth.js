import express from 'express';
import authController from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));

// Protected routes
router.get('/me', authenticateToken, authController.me.bind(authController));
router.get('/search', authenticateToken, authController.searchUsers.bind(authController));

export default router;
