import messageService from '../services/messageService.js';
import conversationService from '../services/conversationService.js';
import logger from '../utils/logger.js';
import { sanitizeContent, MAX_MESSAGE_LENGTH } from '../utils/validation.js';
import { getMessageType, getMaxSize, uploadToSupabase } from '../middleware/upload.js';

class MessageController {
  // Get messages for a conversation
  async getMessages(req, res) {
    try {
      const { conversationId } = req.params;
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset) || 0, 0);

      // Verify user is participant
      const isParticipant = await conversationService.isParticipant(
        conversationId, 
        req.user.id
      );

      if (!isParticipant) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const messages = await messageService.getMessages(
        conversationId,
        req.user.id,
        limit,
        offset
      );

      res.json({ messages });
    } catch (error) {
      logger.error('Get messages error:', error.message);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  // Send message (HTTP fallback)
  async sendMessage(req, res) {
    try {
      const { conversationId } = req.params;
      const { content } = req.body;

      const sanitized = sanitizeContent(content);
      if (!sanitized || sanitized.length === 0) {
        return res.status(400).json({ error: 'Message content is required' });
      }
      if (sanitized.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
      }

      // Verify user is participant
      const isParticipant = await conversationService.isParticipant(
        conversationId, 
        req.user.id
      );

      if (!isParticipant) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const message = await messageService.createMessage(
        conversationId,
        req.user.id,
        sanitized
      );

      res.status(201).json({ message });
    } catch (error) {
      logger.error('Send message error:', error.message);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  // Update message status
  async updateStatus(req, res) {
    try {
      const { messageId } = req.params;
      const { status } = req.body;

      if (!['delivered', 'seen'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const message = await messageService.updateMessageStatus(
        messageId,
        status,
        req.user.id
      );

      res.json({ message });
    } catch (error) {
      logger.error('Update status error:', error.message);
      res.status(500).json({ error: 'Failed to update message status' });
    }
  }

  // Mark all messages in conversation as seen
  async markConversationAsSeen(req, res) {
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

      const messageIds = await messageService.markConversationAsSeen(
        conversationId,
        req.user.id
      );

      res.json({ messageIds, count: messageIds.length });
    } catch (error) {
      logger.error('Mark as seen error:', error.message);
      res.status(500).json({ error: 'Failed to mark as seen' });
    }
  }

  // Get unread count
  async getUnreadCount(req, res) {
    try {
      const count = await messageService.getUnreadCount(req.user.id);
      res.json({ count });
    } catch (error) {
      logger.error('Get unread count error:', error.message);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  }

  // Upload media and create message
  async uploadMedia(req, res) {
    try {
      const { conversationId } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Verify user is participant
      const isParticipant = await conversationService.isParticipant(
        conversationId,
        req.user.id
      );

      if (!isParticipant) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Determine message type from mime
      const messageType = getMessageType(file.mimetype);
      if (!messageType) {
        return res.status(400).json({ error: 'Unsupported file type' });
      }

      // Validate size per type
      const maxSize = getMaxSize(file.mimetype);
      if (file.size > maxSize) {
        return res.status(400).json({ error: `File too large. Max size: ${Math.round(maxSize / (1024 * 1024))}MB` });
      }

      // Optional caption
      const caption = req.body.caption ? sanitizeContent(req.body.caption) : null;
      if (caption && caption.length > MAX_MESSAGE_LENGTH) {
        return res.status(400).json({ error: `Caption cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
      }

      // Upload to Supabase Storage
      const mediaUrl = await uploadToSupabase(file.buffer, file.originalname, file.mimetype);

      const message = await messageService.createMessage(
        conversationId,
        req.user.id,
        caption,
        {
          messageType,
          mediaUrl,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
        }
      );

      res.status(201).json({ message });
    } catch (error) {
      logger.error('Upload media error:', error.message);
      res.status(500).json({ error: 'Failed to upload media' });
    }
  }
}

export default new MessageController();
