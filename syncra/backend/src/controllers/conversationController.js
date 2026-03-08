import conversationService from '../services/conversationService.js';
import logger from '../utils/logger.js';
import { isValidUUID } from '../utils/validation.js';

class ConversationController {
  // Get all conversations for current user
  async getConversations(req, res) {
    try {
      const conversations = await conversationService.getUserConversations(req.user.id);
      res.json({ conversations });
    } catch (error) {
      logger.error('Get conversations error:', error.message);
      res.status(500).json({ error: 'Failed to fetch conversations' });
    }
  }

  // Get or create conversation with another user
  async getOrCreateConversation(req, res) {
    try {
      const { userId } = req.body;
      
      if (!userId || !isValidUUID(userId)) {
        return res.status(400).json({ error: 'Valid user ID is required' });
      }

      if (userId === req.user.id) {
        return res.status(400).json({ error: 'Cannot create conversation with yourself' });
      }

      // Verify target user exists
      const targetExists = await conversationService.userExists(userId);
      if (!targetExists) {
        return res.status(404).json({ error: 'User not found' });
      }

      const result = await conversationService.getOrCreateConversation(
        req.user.id, 
        userId
      );

      res.json(result);
    } catch (error) {
      logger.error('Create conversation error:', error.message);
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  }

  // Get single conversation
  async getConversation(req, res) {
    try {
      const { conversationId } = req.params;
      const conversation = await conversationService.getConversationById(
        conversationId, 
        req.user.id
      );
      res.json({ conversation });
    } catch (error) {
      logger.error('Get conversation error:', error.message);
      res.status(404).json({ error: 'Conversation not found' });
    }
  }

  // Get conversation participants
  async getParticipants(req, res) {
    try {
      const { conversationId } = req.params;
      
      // Verify user is participant
      const isParticipant = await conversationService.isParticipant(
        conversationId, 
        req.user.id
      );

      if (!isParticipant) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const participants = await conversationService.getConversationParticipants(
        conversationId
      );
      res.json({ participants });
    } catch (error) {
      logger.error('Get participants error:', error.message);
      res.status(500).json({ error: 'Failed to fetch participants' });
    }
  }
}

export default new ConversationController();
