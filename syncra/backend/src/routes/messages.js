import express from 'express';
import messageController from '../controllers/messageController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateUUIDParam } from '../utils/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Update message status
router.patch('/:messageId/status', validateUUIDParam('messageId'), messageController.updateStatus.bind(messageController));

// Get unread count
router.get('/unread/count', messageController.getUnreadCount.bind(messageController));

export default router;
