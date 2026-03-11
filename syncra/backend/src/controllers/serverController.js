import serverService from '../services/serverService.js';
import logger from '../utils/logger.js';

class ServerController {
  // Create server
  async createServer(req, res) {
    try {
      const { name } = req.body;
      if (!name || name.trim().length < 1 || name.trim().length > 100) {
        return res.status(400).json({ error: 'Server name must be 1-100 characters' });
      }
      const server = await serverService.createServer(name.trim(), req.user.id);
      res.status(201).json({ server });
    } catch (error) {
      logger.error('Create server error:', error.message);
      res.status(500).json({ error: 'Failed to create server' });
    }
  }

  // Get user's servers
  async getServers(req, res) {
    try {
      const servers = await serverService.getUserServers(req.user.id);
      res.json({ servers });
    } catch (error) {
      logger.error('Get servers error:', error.message);
      res.status(500).json({ error: 'Failed to fetch servers' });
    }
  }

  // Get server details
  async getServer(req, res) {
    try {
      const server = await serverService.getServer(req.params.serverId, req.user.id);
      if (!server) return res.status(404).json({ error: 'Server not found' });
      res.json({ server });
    } catch (error) {
      logger.error('Get server error:', error.message);
      res.status(500).json({ error: 'Failed to fetch server' });
    }
  }

  // Update server
  async updateServer(req, res) {
    try {
      const server = await serverService.updateServer(req.params.serverId, req.user.id, req.body);
      res.json({ server });
    } catch (error) {
      if (error.message === 'Not authorized') return res.status(403).json({ error: error.message });
      logger.error('Update server error:', error.message);
      res.status(500).json({ error: 'Failed to update server' });
    }
  }

  // Delete server
  async deleteServer(req, res) {
    try {
      await serverService.deleteServer(req.params.serverId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      if (error.message === 'Not authorized') return res.status(403).json({ error: error.message });
      logger.error('Delete server error:', error.message);
      res.status(500).json({ error: 'Failed to delete server' });
    }
  }

  // Get members
  async getMembers(req, res) {
    try {
      const isMember = await serverService.isMember(req.params.serverId, req.user.id);
      if (!isMember) return res.status(403).json({ error: 'Not a member' });
      const members = await serverService.getMembers(req.params.serverId);
      res.json({ members });
    } catch (error) {
      logger.error('Get members error:', error.message);
      res.status(500).json({ error: 'Failed to fetch members' });
    }
  }

  // Remove member
  async removeMember(req, res) {
    try {
      await serverService.removeMember(req.params.serverId, req.params.userId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      if (error.message.includes('Not authorized') || error.message.includes('Cannot remove')) {
        return res.status(403).json({ error: error.message });
      }
      logger.error('Remove member error:', error.message);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }

  // Update member role
  async updateMemberRole(req, res) {
    try {
      const { role } = req.body;
      if (!['admin', 'moderator', 'member'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }
      const member = await serverService.updateMemberRole(
        req.params.serverId, req.params.userId, role, req.user.id
      );
      res.json({ member });
    } catch (error) {
      if (error.message.includes('Only owner')) return res.status(403).json({ error: error.message });
      logger.error('Update role error:', error.message);
      res.status(500).json({ error: 'Failed to update role' });
    }
  }

  // Leave server
  async leaveServer(req, res) {
    try {
      await serverService.leaveServer(req.params.serverId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      if (error.message.includes('Owner cannot')) return res.status(400).json({ error: error.message });
      logger.error('Leave server error:', error.message);
      res.status(500).json({ error: 'Failed to leave server' });
    }
  }

  // Create invite
  async createInvite(req, res) {
    try {
      const { maxUses, expiresInHours } = req.body;
      const invite = await serverService.createInvite(
        req.params.serverId, req.user.id, maxUses || null, expiresInHours || 24
      );
      res.status(201).json({ invite });
    } catch (error) {
      logger.error('Create invite error:', error.message);
      res.status(500).json({ error: 'Failed to create invite' });
    }
  }

  // Join via invite
  async joinViaInvite(req, res) {
    try {
      const { code } = req.body;
      if (!code) return res.status(400).json({ error: 'Invite code is required' });
      const result = await serverService.joinViaInvite(code.trim(), req.user.id);
      res.json(result);
    } catch (error) {
      if (error.message.includes('Invalid') || error.message.includes('expired') || error.message.includes('maximum')) {
        return res.status(400).json({ error: error.message });
      }
      logger.error('Join invite error:', error.message);
      res.status(500).json({ error: 'Failed to join server' });
    }
  }

  // Get server invites
  async getInvites(req, res) {
    try {
      const invites = await serverService.getInvites(req.params.serverId, req.user.id);
      res.json({ invites });
    } catch (error) {
      if (error.message === 'Not authorized') return res.status(403).json({ error: error.message });
      logger.error('Get invites error:', error.message);
      res.status(500).json({ error: 'Failed to fetch invites' });
    }
  }

  // Delete invite
  async deleteInvite(req, res) {
    try {
      await serverService.deleteInvite(req.params.inviteId, req.params.serverId, req.user.id);
      res.json({ success: true });
    } catch (error) {
      if (error.message === 'Not authorized') return res.status(403).json({ error: error.message });
      logger.error('Delete invite error:', error.message);
      res.status(500).json({ error: 'Failed to delete invite' });
    }
  }
}

export default new ServerController();
