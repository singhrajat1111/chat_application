import { v4 as uuidv4 } from 'uuid';
import channelService from '../services/channelService.js';
import serverService from '../services/serverService.js';
import logger from '../utils/logger.js';
import { sanitizeContent, MAX_MESSAGE_LENGTH } from '../utils/validation.js';
import { getMessageType, getMaxSize, uploadToSupabase } from '../middleware/upload.js';
import { query } from '../db/index.js';

class ChannelController {
  // Get server channels
  async getChannels(req, res) {
    try {
      const isMember = await serverService.isMember(req.params.serverId, req.user.id);
      if (!isMember) return res.status(403).json({ error: 'Not a member' });
      const data = await channelService.getServerChannels(req.params.serverId);
      res.json(data);
    } catch (error) {
      logger.error('Get channels error:', error.message);
      res.status(500).json({ error: 'Failed to fetch channels' });
    }
  }

  // Create channel
  async createChannel(req, res) {
    try {
      const member = await serverService.getMember(req.params.serverId, req.user.id);
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const { name, type, categoryId, topic } = req.body;
      if (!name || name.trim().length < 1 || name.trim().length > 100) {
        return res.status(400).json({ error: 'Channel name must be 1-100 characters' });
      }
      // Normalize channel name: lowercase, replace spaces with hyphens
      const normalized = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, '');
      const channel = await channelService.createChannel(
        req.params.serverId, normalized, type || 'text', categoryId || null, topic || null
      );
      res.status(201).json({ channel });
    } catch (error) {
      logger.error('Create channel error:', error.message);
      res.status(500).json({ error: 'Failed to create channel' });
    }
  }

  // Update channel
  async updateChannel(req, res) {
    try {
      const member = await serverService.getMember(req.params.serverId, req.user.id);
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const channel = await channelService.updateChannel(req.params.channelId, req.body);
      res.json({ channel });
    } catch (error) {
      logger.error('Update channel error:', error.message);
      res.status(500).json({ error: 'Failed to update channel' });
    }
  }

  // Delete channel
  async deleteChannel(req, res) {
    try {
      const member = await serverService.getMember(req.params.serverId, req.user.id);
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      await channelService.deleteChannel(req.params.channelId);
      res.json({ success: true });
    } catch (error) {
      if (error.message.includes('Cannot delete')) return res.status(400).json({ error: error.message });
      logger.error('Delete channel error:', error.message);
      res.status(500).json({ error: 'Failed to delete channel' });
    }
  }

  // Create category
  async createCategory(req, res) {
    try {
      const member = await serverService.getMember(req.params.serverId, req.user.id);
      if (!member || !['owner', 'admin'].includes(member.role)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const { name } = req.body;
      if (!name || name.trim().length < 1) return res.status(400).json({ error: 'Category name required' });
      const category = await channelService.createCategory(req.params.serverId, name.trim());
      res.status(201).json({ category });
    } catch (error) {
      logger.error('Create category error:', error.message);
      res.status(500).json({ error: 'Failed to create category' });
    }
  }

  // Get channel messages
  async getMessages(req, res) {
    try {
      const channel = await channelService.getChannel(req.params.channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });
      const isMember = await serverService.isMember(channel.serverId, req.user.id);
      if (!isMember) return res.status(403).json({ error: 'Not a member' });

      const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset) || 0, 0);
      const messages = await channelService.getChannelMessages(req.params.channelId, limit, offset);

      // Fetch reactions
      const messageIds = messages.map(m => m.id);
      const reactions = await channelService.getReactions(messageIds);
      const messagesWithReactions = messages.map(m => ({
        ...m,
        reactions: reactions[m.id] || [],
      }));

      res.json({ messages: messagesWithReactions });
    } catch (error) {
      logger.error('Get channel messages error:', error.message);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  }

  // Send message in channel
  async sendMessage(req, res) {
    try {
      const channel = await channelService.getChannel(req.params.channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });
      const isMember = await serverService.isMember(channel.serverId, req.user.id);
      if (!isMember) return res.status(403).json({ error: 'Not a member' });

      const { content, replyToId } = req.body;
      const sanitized = sanitizeContent(content);
      if (!sanitized || sanitized.length === 0) return res.status(400).json({ error: 'Content required' });
      if (sanitized.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ error: 'Message too long' });

      const result = await query(
        `INSERT INTO messages (id, channel_id, sender_id, content, message_type, reply_to_id, status)
         VALUES ($1, $2, $3, $4, 'text', $5, 'sent')
         RETURNING *`,
        [uuidv4(), req.params.channelId, req.user.id, sanitized, replyToId || null]
      );
      const msg = result.rows[0];

      // Format with sender info
      const message = {
        id: msg.id,
        channelId: msg.channel_id,
        senderId: msg.sender_id,
        senderUsername: req.user.username,
        content: msg.content,
        messageType: msg.message_type,
        status: msg.status,
        isEdited: msg.is_edited,
        replyToId: msg.reply_to_id,
        createdAt: msg.created_at,
        reactions: [],
      };

      res.status(201).json({ message });
    } catch (error) {
      logger.error('Send channel message error:', error.message);
      res.status(500).json({ error: 'Failed to send message' });
    }
  }

  // Upload media in channel
  async uploadMedia(req, res) {
    try {
      const channel = await channelService.getChannel(req.params.channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });
      const isMember = await serverService.isMember(channel.serverId, req.user.id);
      if (!isMember) return res.status(403).json({ error: 'Not a member' });

      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      const messageType = getMessageType(file.mimetype);
      if (!messageType) return res.status(400).json({ error: 'Unsupported file type' });
      const maxSize = getMaxSize(file.mimetype);
      if (file.size > maxSize) return res.status(400).json({ error: 'File too large' });

      const caption = req.body.caption ? sanitizeContent(req.body.caption) : null;
      const mediaUrl = await uploadToSupabase(file.buffer, file.originalname, file.mimetype);

      const result = await query(
        `INSERT INTO messages (id, channel_id, sender_id, content, message_type, media_url, file_name, file_size, mime_type, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'sent')
         RETURNING *`,
        [uuidv4(), req.params.channelId, req.user.id, caption, messageType, mediaUrl, file.originalname, file.size, file.mimetype]
      );

      const msg = result.rows[0];
      const message = {
        id: msg.id,
        channelId: msg.channel_id,
        senderId: msg.sender_id,
        senderUsername: req.user.username,
        content: msg.content,
        messageType: msg.message_type,
        mediaUrl: msg.media_url,
        fileName: msg.file_name,
        fileSize: msg.file_size ? Number(msg.file_size) : null,
        mimeType: msg.mime_type,
        status: msg.status,
        createdAt: msg.created_at,
        reactions: [],
      };
      res.status(201).json({ message });
    } catch (error) {
      logger.error('Upload channel media error:', error.message);
      res.status(500).json({ error: 'Failed to upload media' });
    }
  }

  // Edit message
  async editMessage(req, res) {
    try {
      const { content } = req.body;
      const sanitized = sanitizeContent(content);
      if (!sanitized) return res.status(400).json({ error: 'Content required' });

      const result = await query(
        `UPDATE messages SET content = $1, is_edited = true, edited_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND sender_id = $3 AND is_deleted = false
         RETURNING *`,
        [sanitized, req.params.messageId, req.user.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Message not found or not yours' });

      const msg = result.rows[0];
      res.json({ message: { id: msg.id, content: msg.content, isEdited: true, editedAt: msg.edited_at } });
    } catch (error) {
      logger.error('Edit message error:', error.message);
      res.status(500).json({ error: 'Failed to edit message' });
    }
  }

  // Delete message (soft delete)
  async deleteMessage(req, res) {
    try {
      // Allow sender or server admin/owner to delete
      const result = await query(
        `UPDATE messages SET is_deleted = true, content = NULL
         WHERE id = $1 AND (sender_id = $2 OR EXISTS (
           SELECT 1 FROM server_members sm
           JOIN channels ch ON ch.server_id = sm.server_id
           WHERE ch.id = messages.channel_id AND sm.user_id = $2 AND sm.role IN ('owner', 'admin', 'moderator')
         ))
         RETURNING id`,
        [req.params.messageId, req.user.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Message not found or not authorized' });
      res.json({ success: true });
    } catch (error) {
      logger.error('Delete message error:', error.message);
      res.status(500).json({ error: 'Failed to delete message' });
    }
  }

  // Add reaction
  async addReaction(req, res) {
    try {
      const { emoji } = req.body;
      if (!emoji) return res.status(400).json({ error: 'Emoji required' });
      await query(
        `INSERT INTO message_reactions (message_id, user_id, emoji)
         VALUES ($1, $2, $3)
         ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
        [req.params.messageId, req.user.id, emoji]
      );
      res.json({ success: true });
    } catch (error) {
      logger.error('Add reaction error:', error.message);
      res.status(500).json({ error: 'Failed to add reaction' });
    }
  }

  // Remove reaction
  async removeReaction(req, res) {
    try {
      const { emoji } = req.body;
      await query(
        `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
        [req.params.messageId, req.user.id, emoji]
      );
      res.json({ success: true });
    } catch (error) {
      logger.error('Remove reaction error:', error.message);
      res.status(500).json({ error: 'Failed to remove reaction' });
    }
  }

  // Pin message
  async pinMessage(req, res) {
    try {
      const msg = await query('SELECT * FROM messages WHERE id = $1', [req.params.messageId]);
      if (msg.rows.length === 0) return res.status(404).json({ error: 'Message not found' });
      const m = msg.rows[0];

      // Authorization: must be server member with mod+ role
      if (m.channel_id) {
        const channel = await channelService.getChannel(m.channel_id);
        if (!channel) return res.status(404).json({ error: 'Channel not found' });
        const member = await serverService.getMember(channel.serverId, req.user.id);
        if (!member || !['owner', 'admin', 'moderator'].includes(member.role)) {
          return res.status(403).json({ error: 'Not authorized to pin messages' });
        }
      } else {
        return res.status(400).json({ error: 'Can only pin channel messages' });
      }

      await query(
        `INSERT INTO pinned_messages (message_id, channel_id, conversation_id, pinned_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (message_id) DO NOTHING`,
        [m.id, m.channel_id, m.conversation_id, req.user.id]
      );
      res.json({ success: true });
    } catch (error) {
      logger.error('Pin message error:', error.message);
      res.status(500).json({ error: 'Failed to pin message' });
    }
  }

  // Unpin message
  async unpinMessage(req, res) {
    try {
      const pin = await query(
        `SELECT pm.*, m.channel_id FROM pinned_messages pm
         JOIN messages m ON pm.message_id = m.id
         WHERE pm.message_id = $1`,
        [req.params.messageId]
      );
      if (pin.rows.length === 0) return res.status(404).json({ error: 'Pin not found' });

      // Authorization
      if (pin.rows[0].channel_id) {
        const channel = await channelService.getChannel(pin.rows[0].channel_id);
        if (channel) {
          const member = await serverService.getMember(channel.serverId, req.user.id);
          if (!member || !['owner', 'admin', 'moderator'].includes(member.role)) {
            return res.status(403).json({ error: 'Not authorized' });
          }
        }
      }

      await query('DELETE FROM pinned_messages WHERE message_id = $1', [req.params.messageId]);
      res.json({ success: true });
    } catch (error) {
      logger.error('Unpin message error:', error.message);
      res.status(500).json({ error: 'Failed to unpin message' });
    }
  }

  // Get pinned messages
  async getPinnedMessages(req, res) {
    try {
      // Verify membership
      const channel = await channelService.getChannel(req.params.channelId);
      if (!channel) return res.status(404).json({ error: 'Channel not found' });
      const isMember = await serverService.isMember(channel.serverId, req.user.id);
      if (!isMember) return res.status(403).json({ error: 'Not a member of this server' });

      const result = await query(
        `SELECT m.*, u.username as sender_username, pm.pinned_at, pu.username as pinned_by_username
         FROM pinned_messages pm
         JOIN messages m ON pm.message_id = m.id
         JOIN users u ON m.sender_id = u.id
         JOIN users pu ON pm.pinned_by = pu.id
         WHERE pm.channel_id = $1
         ORDER BY pm.pinned_at DESC`,
        [req.params.channelId]
      );
      res.json({ messages: result.rows });
    } catch (error) {
      logger.error('Get pinned error:', error.message);
      res.status(500).json({ error: 'Failed to fetch pinned messages' });
    }
  }
}

export default new ChannelController();
