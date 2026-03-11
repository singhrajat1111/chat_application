import { query } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

class ChannelService {
  // Create channel
  async createChannel(serverId, name, type = 'text', categoryId = null, topic = null) {
    // Get next position
    const posResult = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM channels WHERE server_id = $1`,
      [serverId]
    );
    const position = posResult.rows[0].next_pos;

    const result = await query(
      `INSERT INTO channels (id, server_id, category_id, name, type, topic, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [uuidv4(), serverId, categoryId, name, type, topic, position]
    );
    const ch = result.rows[0];
    return this._formatChannel(ch);
  }

  // Get all channels for a server (grouped by category)
  async getServerChannels(serverId) {
    const categoriesResult = await query(
      `SELECT * FROM channel_categories WHERE server_id = $1 ORDER BY position ASC`,
      [serverId]
    );
    const channelsResult = await query(
      `SELECT * FROM channels WHERE server_id = $1 ORDER BY position ASC`,
      [serverId]
    );

    const categories = categoriesResult.rows.map(c => ({
      id: c.id,
      name: c.name,
      position: c.position,
      channels: [],
    }));

    const uncategorized = [];
    for (const ch of channelsResult.rows) {
      const formatted = this._formatChannel(ch);
      const cat = categories.find(c => c.id === ch.category_id);
      if (cat) {
        cat.channels.push(formatted);
      } else {
        uncategorized.push(formatted);
      }
    }

    return { categories, uncategorized };
  }

  // Get single channel
  async getChannel(channelId) {
    const result = await query('SELECT * FROM channels WHERE id = $1', [channelId]);
    if (result.rows.length === 0) return null;
    return this._formatChannel(result.rows[0]);
  }

  // Update channel
  async updateChannel(channelId, updates) {
    const fields = [];
    const values = [];
    let idx = 1;
    if (updates.name !== undefined) { fields.push(`name = $${idx++}`); values.push(updates.name); }
    if (updates.topic !== undefined) { fields.push(`topic = $${idx++}`); values.push(updates.topic); }
    if (updates.categoryId !== undefined) { fields.push(`category_id = $${idx++}`); values.push(updates.categoryId); }
    if (updates.position !== undefined) { fields.push(`position = $${idx++}`); values.push(updates.position); }
    if (fields.length === 0) throw new Error('No fields to update');
    values.push(channelId);
    const result = await query(
      `UPDATE channels SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) throw new Error('Channel not found');
    return this._formatChannel(result.rows[0]);
  }

  // Delete channel
  async deleteChannel(channelId) {
    const ch = await this.getChannel(channelId);
    if (!ch) throw new Error('Channel not found');
    if (ch.isDefault) throw new Error('Cannot delete the default channel');
    await query('DELETE FROM channels WHERE id = $1', [channelId]);
  }

  // ============ CATEGORIES ============

  async createCategory(serverId, name) {
    const posResult = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM channel_categories WHERE server_id = $1`,
      [serverId]
    );
    const result = await query(
      `INSERT INTO channel_categories (id, server_id, name, position)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [uuidv4(), serverId, name, posResult.rows[0].next_pos]
    );
    const c = result.rows[0];
    return { id: c.id, name: c.name, position: c.position, serverId: c.server_id };
  }

  async updateCategory(categoryId, name) {
    const result = await query(
      `UPDATE channel_categories SET name = $1 WHERE id = $2 RETURNING *`,
      [name, categoryId]
    );
    if (result.rows.length === 0) throw new Error('Category not found');
    const c = result.rows[0];
    return { id: c.id, name: c.name, position: c.position, serverId: c.server_id };
  }

  async deleteCategory(categoryId) {
    // Move channels to uncategorized
    await query('UPDATE channels SET category_id = NULL WHERE category_id = $1', [categoryId]);
    await query('DELETE FROM channel_categories WHERE id = $1', [categoryId]);
  }

  // ============ CHANNEL MESSAGES ============

  async getChannelMessages(channelId, limit = 50, offset = 0) {
    const result = await query(
      `SELECT
        m.id, m.channel_id, m.sender_id, m.content, m.message_type,
        m.media_url, m.file_name, m.file_size, m.mime_type,
        m.status, m.is_edited, m.is_deleted, m.edited_at,
        m.reply_to_id, m.created_at,
        u.username as sender_username,
        rm.content as reply_content, rm.sender_id as reply_sender_id,
        ru.username as reply_sender_username
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       LEFT JOIN messages rm ON m.reply_to_id = rm.id
       LEFT JOIN users ru ON rm.sender_id = ru.id
       WHERE m.channel_id = $1 AND m.is_deleted = false
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [channelId, limit, offset]
    );

    return result.rows.map(r => this._formatMessage(r)).reverse();
  }

  // Get reactions for a set of messages
  async getReactions(messageIds) {
    if (messageIds.length === 0) return {};
    const result = await query(
      `SELECT mr.message_id, mr.emoji, mr.user_id, u.username
       FROM message_reactions mr
       JOIN users u ON mr.user_id = u.id
       WHERE mr.message_id = ANY($1)`,
      [messageIds]
    );
    const reactions = {};
    for (const r of result.rows) {
      if (!reactions[r.message_id]) reactions[r.message_id] = [];
      reactions[r.message_id].push({ emoji: r.emoji, userId: r.user_id, username: r.username });
    }
    return reactions;
  }

  _formatChannel(ch) {
    return {
      id: ch.id,
      serverId: ch.server_id,
      categoryId: ch.category_id,
      name: ch.name,
      topic: ch.topic,
      type: ch.type,
      position: ch.position,
      isDefault: ch.is_default,
      createdAt: ch.created_at,
    };
  }

  _formatMessage(r) {
    return {
      id: r.id,
      channelId: r.channel_id,
      senderId: r.sender_id,
      senderUsername: r.sender_username,
      content: r.is_deleted ? null : r.content,
      messageType: r.message_type,
      mediaUrl: r.media_url,
      fileName: r.file_name,
      fileSize: r.file_size ? Number(r.file_size) : null,
      mimeType: r.mime_type,
      status: r.status,
      isEdited: r.is_edited,
      isDeleted: r.is_deleted,
      editedAt: r.edited_at,
      replyToId: r.reply_to_id,
      replyTo: r.reply_to_id ? {
        content: r.reply_content,
        senderId: r.reply_sender_id,
        senderUsername: r.reply_sender_username,
      } : null,
      createdAt: r.created_at,
    };
  }
}

export default new ChannelService();
