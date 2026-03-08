import { query, getClient } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

class ConversationService {
  // Get or create 1-to-1 conversation between two users
  async getOrCreateConversation(userId1, userId2) {
    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      // Advisory lock based on sorted user pair prevents race condition
      // when two users simultaneously try to create the same conversation
      const [sortedId1, sortedId2] = [userId1, userId2].sort();
      const lockKey = Buffer.from(sortedId1.replace(/-/g, '').substring(0, 8), 'hex').readInt32BE(0);
      await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

      // Check if conversation already exists between these two users
      const existingQuery = `
        SELECT c.id 
        FROM conversations c
        JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
        JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
        WHERE cp1.user_id = $1 AND cp2.user_id = $2
        AND (
          SELECT COUNT(*) 
          FROM conversation_participants 
          WHERE conversation_id = c.id
        ) = 2
      `;
      
      const existingResult = await client.query(existingQuery, [sortedId1, sortedId2]);
      
      if (existingResult.rows.length > 0) {
        await client.query('COMMIT');
        return { id: existingResult.rows[0].id, isNew: false };
      }

      // Create new conversation
      const conversationId = uuidv4();
      await client.query(
        'INSERT INTO conversations (id) VALUES ($1)',
        [conversationId]
      );

      // Add both participants
      await client.query(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
        [conversationId, userId1, userId2]
      );

      await client.query('COMMIT');
      return { id: conversationId, isNew: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get user's conversations with last message
  async getUserConversations(userId) {
    try {
      const result = await query(
        `SELECT 
          c.id,
          c.created_at,
          c.updated_at,
          (
            SELECT json_build_object(
              'id', u.id,
              'username', u.username,
              'email', u.email
            )
            FROM users u
            JOIN conversation_participants cp2 ON u.id = cp2.user_id
            WHERE cp2.conversation_id = c.id AND cp2.user_id != $1
            LIMIT 1
          ) as other_user,
          (
            SELECT json_build_object(
              'id', m.id,
              'content', m.content,
              'status', m.status,
              'createdAt', m.created_at,
              'senderId', m.sender_id
            )
            FROM messages m
            WHERE m.conversation_id = c.id
            ORDER BY m.created_at DESC
            LIMIT 1
          ) as last_message,
          (
            SELECT COUNT(*)
            FROM messages m
            WHERE m.conversation_id = c.id AND m.sender_id != $1 AND m.status != 'seen'
          ) as unread_count
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE cp.user_id = $1
        ORDER BY c.updated_at DESC`,
        [userId]
      );

      return result.rows.map(row => ({
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        otherUser: row.other_user,
        lastMessage: row.last_message,
        unreadCount: parseInt(row.unread_count),
      }));
    } catch (error) {
      throw error;
    }
  }

  // Get conversation participants
  async getConversationParticipants(conversationId) {
    try {
      const result = await query(
        `SELECT u.id, u.username, u.email
         FROM users u
         JOIN conversation_participants cp ON u.id = cp.user_id
         WHERE cp.conversation_id = $1`,
        [conversationId]
      );

      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  // Check if user is participant in conversation
  async isParticipant(conversationId, userId) {
    try {
      const result = await query(
        'SELECT id FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, userId]
      );

      return result.rows.length > 0;
    } catch (error) {
      throw error;
    }
  }

  // Get conversation by ID
  async getConversationById(conversationId, userId) {
    try {
      const result = await query(
        `SELECT 
          c.id,
          c.created_at,
          c.updated_at,
          (
            SELECT json_build_object(
              'id', u.id,
              'username', u.username,
              'email', u.email
            )
            FROM users u
            JOIN conversation_participants cp2 ON u.id = cp2.user_id
            WHERE cp2.conversation_id = c.id AND cp2.user_id != $2
            LIMIT 1
          ) as other_user
        FROM conversations c
        JOIN conversation_participants cp ON c.id = cp.conversation_id
        WHERE c.id = $1 AND cp.user_id = $2`,
        [conversationId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('Conversation not found');
      }

      const row = result.rows[0];
      return {
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        otherUser: row.other_user,
      };
    } catch (error) {
      throw error;
    }
  }
}

export default new ConversationService();
