import { query, getClient } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';

class ServerService {
  // Create a new server with a default "general" channel
  async createServer(name, ownerId, iconUrl = null) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const serverId = uuidv4();
      const serverResult = await client.query(
        `INSERT INTO servers (id, name, icon_url, owner_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [serverId, name, iconUrl, ownerId]
      );

      // Add owner as member with 'owner' role
      await client.query(
        `INSERT INTO server_members (server_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [serverId, ownerId]
      );

      // Create default category
      const categoryId = uuidv4();
      await client.query(
        `INSERT INTO channel_categories (id, server_id, name, position)
         VALUES ($1, $2, 'Text Channels', 0)`,
        [categoryId, serverId]
      );

      // Create default #general channel
      const channelId = uuidv4();
      await client.query(
        `INSERT INTO channels (id, server_id, category_id, name, type, position, is_default)
         VALUES ($1, $2, $3, 'general', 'text', 0, true)`,
        [channelId, serverId, categoryId]
      );

      await client.query('COMMIT');

      const server = serverResult.rows[0];
      return {
        id: server.id,
        name: server.name,
        iconUrl: server.icon_url,
        ownerId: server.owner_id,
        createdAt: server.created_at,
        defaultChannelId: channelId,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get all servers a user is a member of
  async getUserServers(userId) {
    const result = await query(
      `SELECT s.id, s.name, s.icon_url, s.owner_id, s.created_at, sm.role,
              (SELECT COUNT(*) FROM server_members WHERE server_id = s.id) as member_count
       FROM servers s
       JOIN server_members sm ON s.id = sm.server_id AND sm.user_id = $1
       ORDER BY sm.joined_at ASC`,
      [userId]
    );
    return result.rows.map(r => ({
      id: r.id,
      name: r.name,
      iconUrl: r.icon_url,
      ownerId: r.owner_id,
      role: r.role,
      memberCount: parseInt(r.member_count),
      createdAt: r.created_at,
    }));
  }

  // Get server details
  async getServer(serverId, userId) {
    const result = await query(
      `SELECT s.*, sm.role as user_role
       FROM servers s
       JOIN server_members sm ON s.id = sm.server_id AND sm.user_id = $2
       WHERE s.id = $1`,
      [serverId, userId]
    );
    if (result.rows.length === 0) return null;
    const s = result.rows[0];
    return {
      id: s.id,
      name: s.name,
      iconUrl: s.icon_url,
      ownerId: s.owner_id,
      userRole: s.user_role,
      createdAt: s.created_at,
    };
  }

  // Update server
  async updateServer(serverId, userId, updates) {
    // Verify caller is owner or admin
    const member = await this.getMember(serverId, userId);
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('Not authorized');
    }
    const fields = [];
    const values = [];
    let idx = 1;
    if (updates.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.iconUrl !== undefined) {
      fields.push(`icon_url = $${idx++}`);
      values.push(updates.iconUrl);
    }
    if (fields.length === 0) throw new Error('No fields to update');
    values.push(serverId);
    const result = await query(
      `UPDATE servers SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    const s = result.rows[0];
    return { id: s.id, name: s.name, iconUrl: s.icon_url, ownerId: s.owner_id };
  }

  // Delete server (owner only)
  async deleteServer(serverId, userId) {
    const member = await this.getMember(serverId, userId);
    if (!member || member.role !== 'owner') throw new Error('Not authorized');
    await query('DELETE FROM servers WHERE id = $1', [serverId]);
  }

  // Get member
  async getMember(serverId, userId) {
    const result = await query(
      `SELECT sm.*, u.username, u.email
       FROM server_members sm
       JOIN users u ON sm.user_id = u.id
       WHERE sm.server_id = $1 AND sm.user_id = $2`,
      [serverId, userId]
    );
    if (result.rows.length === 0) return null;
    const m = result.rows[0];
    return { id: m.user_id, username: m.username, email: m.email, role: m.role, joinedAt: m.joined_at };
  }

  // Get all members of a server
  async getMembers(serverId) {
    const result = await query(
      `SELECT sm.role, sm.joined_at, u.id, u.username, u.email
       FROM server_members sm
       JOIN users u ON sm.user_id = u.id
       WHERE sm.server_id = $1
       ORDER BY
         CASE sm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'moderator' THEN 2 ELSE 3 END,
         u.username ASC`,
      [serverId]
    );
    return result.rows.map(m => ({
      id: m.id,
      username: m.username,
      email: m.email,
      role: m.role,
      joinedAt: m.joined_at,
    }));
  }

  // Add member to server
  async addMember(serverId, userId, role = 'member') {
    const existing = await this.getMember(serverId, userId);
    if (existing) return existing;
    await query(
      `INSERT INTO server_members (server_id, user_id, role)
       VALUES ($1, $2, $3)`,
      [serverId, userId, role]
    );
    return this.getMember(serverId, userId);
  }

  // Remove member
  async removeMember(serverId, userId, requesterId) {
    const requester = await this.getMember(serverId, requesterId);
    if (!requester || !['owner', 'admin'].includes(requester.role)) {
      throw new Error('Not authorized');
    }
    const target = await this.getMember(serverId, userId);
    if (!target) throw new Error('User is not a member');
    if (target.role === 'owner') throw new Error('Cannot remove the server owner');
    if (target.role === 'admin' && requester.role !== 'owner') throw new Error('Only owner can remove admins');
    await query('DELETE FROM server_members WHERE server_id = $1 AND user_id = $2', [serverId, userId]);
  }

  // Update member role
  async updateMemberRole(serverId, targetUserId, newRole, requesterId) {
    const requester = await this.getMember(serverId, requesterId);
    if (!requester || requester.role !== 'owner') throw new Error('Only owner can change roles');
    if (targetUserId === requesterId) throw new Error('Cannot change your own role');
    await query(
      `UPDATE server_members SET role = $1 WHERE server_id = $2 AND user_id = $3`,
      [newRole, serverId, targetUserId]
    );
    return this.getMember(serverId, targetUserId);
  }

  // Leave server
  async leaveServer(serverId, userId) {
    const member = await this.getMember(serverId, userId);
    if (!member) throw new Error('Not a member');
    if (member.role === 'owner') throw new Error('Owner cannot leave. Transfer ownership or delete the server.');
    await query('DELETE FROM server_members WHERE server_id = $1 AND user_id = $2', [serverId, userId]);
  }

  // Check membership
  async isMember(serverId, userId) {
    const result = await query(
      'SELECT 1 FROM server_members WHERE server_id = $1 AND user_id = $2',
      [serverId, userId]
    );
    return result.rows.length > 0;
  }

  // ============ INVITES ============

  // Create invite
  async createInvite(serverId, userId, maxUses = null, expiresInHours = 24) {
    const member = await this.getMember(serverId, userId);
    if (!member) throw new Error('Not a member');

    // Generate a short code
    const code = uuidv4().replace(/-/g, '').substring(0, 8);
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : null;

    const result = await query(
      `INSERT INTO server_invites (server_id, code, created_by, max_uses, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [serverId, code, userId, maxUses, expiresAt]
    );
    const inv = result.rows[0];
    return {
      id: inv.id,
      serverId: inv.server_id,
      code: inv.code,
      maxUses: inv.max_uses,
      uses: inv.uses,
      expiresAt: inv.expires_at,
      createdAt: inv.created_at,
    };
  }

  // Join via invite code
  async joinViaInvite(code, userId) {
    const result = await query(
      `SELECT si.*, s.name as server_name
       FROM server_invites si
       JOIN servers s ON si.server_id = s.id
       WHERE si.code = $1`,
      [code]
    );
    if (result.rows.length === 0) throw new Error('Invalid invite code');
    const invite = result.rows[0];

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      throw new Error('Invite has expired');
    }
    // Check max uses
    if (invite.max_uses && invite.uses >= invite.max_uses) {
      throw new Error('Invite has reached maximum uses');
    }
    // Check if already a member
    const existing = await this.getMember(invite.server_id, userId);
    if (existing) {
      return { serverId: invite.server_id, alreadyMember: true };
    }

    // Add member + increment uses
    await query(
      `UPDATE server_invites SET uses = uses + 1 WHERE id = $1`,
      [invite.id]
    );
    await this.addMember(invite.server_id, userId);

    // Get default channel
    const chResult = await query(
      `SELECT id FROM channels WHERE server_id = $1 AND is_default = true LIMIT 1`,
      [invite.server_id]
    );

    return {
      serverId: invite.server_id,
      serverName: invite.server_name,
      defaultChannelId: chResult.rows[0]?.id || null,
      alreadyMember: false,
    };
  }

  // Get server invites
  async getInvites(serverId, userId) {
    const member = await this.getMember(serverId, userId);
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('Not authorized');
    }
    const result = await query(
      `SELECT si.*, u.username as created_by_username
       FROM server_invites si
       JOIN users u ON si.created_by = u.id
       WHERE si.server_id = $1
       ORDER BY si.created_at DESC`,
      [serverId]
    );
    return result.rows.map(inv => ({
      id: inv.id,
      code: inv.code,
      createdBy: inv.created_by_username,
      maxUses: inv.max_uses,
      uses: inv.uses,
      expiresAt: inv.expires_at,
      createdAt: inv.created_at,
    }));
  }

  // Delete invite
  async deleteInvite(inviteId, serverId, userId) {
    const member = await this.getMember(serverId, userId);
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('Not authorized');
    }
    await query('DELETE FROM server_invites WHERE id = $1 AND server_id = $2', [inviteId, serverId]);
  }
}

export default new ServerService();
