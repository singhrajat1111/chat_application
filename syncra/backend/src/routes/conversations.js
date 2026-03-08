import express from 'express';
import conversationController from '../controllers/conversationController.js';
import messageController from '../controllers/messageController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateUUIDParam } from '../utils/validation.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Conversation routes
router.get('/', conversationController.getConversations.bind(conversationController));
router.post('/', conversationController.getOrCreateConversation.bind(conversationController));
router.get('/:conversationId', validateUUIDParam('conversationId'), conversationController.getConversation.bind(conversationController));
router.get('/:conversationId/participants', validateUUIDParam('conversationId'), conversationController.getParticipants.bind(conversationController));

// Message routes
router.get('/:conversationId/messages', validateUUIDParam('conversationId'), messageController.getMessages.bind(messageController));
router.post('/:conversationId/messages', validateUUIDParam('conversationId'), messageController.sendMessage.bind(messageController));
router.post('/:conversationId/seen', validateUUIDParam('conversationId'), messageController.markConversationAsSeen.bind(messageController));

export default router;
