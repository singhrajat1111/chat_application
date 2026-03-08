import { query, getClient } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

class MessageService {
  // Create new message (transactional: insert message + update conversation timestamp)
  async createMessage(conversationId, senderId, content) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const messageId = uuidv4();
      
      const result = await client.query(
        `INSERT INTO messages (id, conversation_id, sender_id, content, status)
         VALUES ($1, $2, $3, $4, 'sent')
         RETURNING id, conversation_id, sender_id, content, status, created_at`,
        [messageId, conversationId, senderId, content]
      );

      // Update conversation updated_at atomically
      await client.query(
        'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [conversationId]
      );

      await client.query('COMMIT');

      const message = result.rows[0];
      return {
        id: message.id,
        conversationId: message.conversation_id,
        senderId: message.sender_id,
        content: message.content,
        status: message.status,
        createdAt: message.created_at,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get messages for a conversation
  async getMessages(conversationId, userId, limit = 50, offset = 0) {
    try {
      // First verify user is participant
      const participantCheck = await query(
        'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, userId]
      );

      if (participantCheck.rows.length === 0) {
        throw new Error('Not authorized to view these messages');
      }

      const result = await query(
        `SELECT 
          m.id,
          m.conversation_id,
          m.sender_id,
          m.content,
          m.status,
          m.created_at,
          u.username as sender_username
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.conversation_id = $1
         ORDER BY m.created_at DESC
         LIMIT $2 OFFSET $3`,
        [conversationId, limit, offset]
      );

      return result.rows.map(row => ({
        id: row.id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        senderUsername: row.sender_username,
        content: row.content,
        status: row.status,
        createdAt: row.created_at,
      })).reverse(); // Return in chronological order
    } catch (error) {
      throw error;
    }
  }

  // Update message status
  async updateMessageStatus(messageId, status, userId) {
    try {
      // Verify user is participant in the conversation
      const messageCheck = await query(
        `SELECT m.id, m.conversation_id, m.sender_id
         FROM messages m
         JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
         WHERE m.id = $1 AND cp.user_id = $2`,
        [messageId, userId]
      );

      if (messageCheck.rows.length === 0) {
        throw new Error('Message not found or not authorized');
      }

      const message = messageCheck.rows[0];

      // Don't allow sender to mark their own message as seen
      if (status === 'seen' && message.sender_id === userId) {
        return {
          id: message.id,
          conversationId: message.conversation_id,
          senderId: message.sender_id,
          status: 'sent',
        };
      }

      const result = await query(
        `UPDATE messages 
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, conversation_id, sender_id, content, status, created_at`,
        [status, messageId]
      );

      const updated = result.rows[0];
      return {
        id: updated.id,
        conversationId: updated.conversation_id,
        senderId: updated.sender_id,
        content: updated.content,
        status: updated.status,
        createdAt: updated.created_at,
      };
    } catch (error) {
      throw error;
    }
  }

  // Mark all messages in conversation as seen
  async markConversationAsSeen(conversationId, userId) {
    try {
      const result = await query(
        `UPDATE messages 
         SET status = 'seen', updated_at = CURRENT_TIMESTAMP
         WHERE conversation_id = $1 AND sender_id != $2 AND status != 'seen'
         RETURNING id`,
        [conversationId, userId]
      );

      return result.rows.map(row => row.id);
    } catch (error) {
      throw error;
    }
  }

  // Get unread message count for user
  async getUnreadCount(userId) {
    try {
      const result = await query(
        `SELECT COUNT(*) as count
         FROM messages m
         JOIN conversation_participants cp ON m.conversation_id = cp.conversation_id
         WHERE cp.user_id = $1 AND m.sender_id != $1 AND m.status != 'seen'`,
        [userId]
      );

      return parseInt(result.rows[0].count);
    } catch (error) {
      throw error;
    }
  }
}

export default new MessageService();
