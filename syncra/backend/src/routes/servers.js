import express from 'express';
import serverController from '../controllers/serverController.js';
import channelController from '../controllers/channelController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateUUIDParam } from '../utils/validation.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// ===== Server CRUD =====
router.get('/', serverController.getServers.bind(serverController));
router.post('/', serverController.createServer.bind(serverController));
router.get('/:serverId', validateUUIDParam('serverId'), serverController.getServer.bind(serverController));
router.patch('/:serverId', validateUUIDParam('serverId'), serverController.updateServer.bind(serverController));
router.delete('/:serverId', validateUUIDParam('serverId'), serverController.deleteServer.bind(serverController));

// ===== Members =====
router.get('/:serverId/members', validateUUIDParam('serverId'), serverController.getMembers.bind(serverController));
router.delete('/:serverId/members/:userId', validateUUIDParam('serverId', 'userId'), serverController.removeMember.bind(serverController));
router.patch('/:serverId/members/:userId/role', validateUUIDParam('serverId', 'userId'), serverController.updateMemberRole.bind(serverController));
router.post('/:serverId/leave', validateUUIDParam('serverId'), serverController.leaveServer.bind(serverController));

// ===== Invites =====
router.post('/:serverId/invites', validateUUIDParam('serverId'), serverController.createInvite.bind(serverController));
router.get('/:serverId/invites', validateUUIDParam('serverId'), serverController.getInvites.bind(serverController));
router.delete('/:serverId/invites/:inviteId', validateUUIDParam('serverId', 'inviteId'), serverController.deleteInvite.bind(serverController));

// ===== Channels =====
router.get('/:serverId/channels', validateUUIDParam('serverId'), channelController.getChannels.bind(channelController));
router.post('/:serverId/channels', validateUUIDParam('serverId'), channelController.createChannel.bind(channelController));
router.patch('/:serverId/channels/:channelId', validateUUIDParam('serverId', 'channelId'), channelController.updateChannel.bind(channelController));
router.delete('/:serverId/channels/:channelId', validateUUIDParam('serverId', 'channelId'), channelController.deleteChannel.bind(channelController));

// ===== Categories =====
router.post('/:serverId/categories', validateUUIDParam('serverId'), channelController.createCategory.bind(channelController));

// ===== Channel Messages =====
router.get('/:serverId/channels/:channelId/messages', validateUUIDParam('serverId', 'channelId'), channelController.getMessages.bind(channelController));
router.post('/:serverId/channels/:channelId/messages', validateUUIDParam('serverId', 'channelId'), channelController.sendMessage.bind(channelController));
router.post('/:serverId/channels/:channelId/upload', validateUUIDParam('serverId', 'channelId'), upload.single('file'), channelController.uploadMedia.bind(channelController));
router.get('/:serverId/channels/:channelId/pins', validateUUIDParam('serverId', 'channelId'), channelController.getPinnedMessages.bind(channelController));

// ===== Message Actions =====
router.patch('/messages/:messageId', validateUUIDParam('messageId'), channelController.editMessage.bind(channelController));
router.delete('/messages/:messageId', validateUUIDParam('messageId'), channelController.deleteMessage.bind(channelController));
router.post('/messages/:messageId/reactions', validateUUIDParam('messageId'), channelController.addReaction.bind(channelController));
router.delete('/messages/:messageId/reactions', validateUUIDParam('messageId'), channelController.removeReaction.bind(channelController));
router.post('/messages/:messageId/pin', validateUUIDParam('messageId'), channelController.pinMessage.bind(channelController));
router.delete('/messages/:messageId/pin', validateUUIDParam('messageId'), channelController.unpinMessage.bind(channelController));

// ===== Join via invite (global — no serverId needed) =====
router.post('/join', serverController.joinViaInvite.bind(serverController));

export default router;
