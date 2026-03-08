import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useMessageStore } from '../store/messageStore';
import { useOnlineStore } from '../store/onlineStore';
import { useConversationStore } from '../store/conversationStore';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
const isDev = import.meta.env.DEV;

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
  }

  connect() {
    const token = useAuthStore.getState().token;
    if (!token) return;
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      if (isDev) console.log('Socket connected:', this.socket.id);
      this.isConnected = true;
    });

    this.socket.on('disconnect', (reason) => {
      if (isDev) console.log('Socket disconnected:', reason);
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      if (isDev) console.error('Socket connection error:', error.message);
      this.isConnected = false;

      // If auth fails, don't keep retrying - log out
      if (error.message?.includes('Authentication')) {
        this.disconnect();
        useAuthStore.getState().logout();
      }
    });

    // Message events
    this.socket.on('message:new', (data) => {
      useMessageStore.getState().handleIncomingMessage(data);
      useConversationStore.getState().updateConversationWithMessage(
        data.conversationId,
        data
      );
      this.socket.emit('message:delivered', {
        messageId: data.id,
        conversationId: data.conversationId,
      });
    });

    this.socket.on('message:sent', () => {
      // Backup confirmation — primary is the callback in sendMessage
    });

    this.socket.on('message:delivered', (data) => {
      const { conversationId, messageId } = data;
      useMessageStore.getState().updateMessageStatus(conversationId, messageId, 'delivered');
    });

    this.socket.on('message:seen', (data) => {
      useMessageStore.getState().handleStatusUpdate(data);
    });

    // Presence events
    this.socket.on('user:online', (data) => {
      useOnlineStore.getState().setUserOnline(data.userId);
    });

    this.socket.on('user:offline', (data) => {
      useOnlineStore.getState().setUserOffline(data.userId);
    });

    // Typing events
    this.socket.on('typing:update', (data) => {
      useMessageStore.getState().handleTypingUpdate(data);
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  // Send message via socket with timeout
  sendMessage(conversationId, content, callback) {
    if (!this.isConnected) {
      if (callback) callback({ error: 'Not connected' });
      return;
    }

    // Add a timeout to the callback so UI doesn't hang forever
    let called = false;
    const timer = setTimeout(() => {
      if (!called) {
        called = true;
        if (callback) callback({ error: 'Request timed out' });
      }
    }, 15000);

    this.socket.emit('message:send', { conversationId, content }, (response) => {
      if (!called) {
        called = true;
        clearTimeout(timer);
        if (callback) callback(response);
      }
    });
  }

  // Mark messages as seen
  markAsSeen(conversationId, callback) {
    if (!this.isConnected) return;
    this.socket.emit('message:seen', { conversationId }, callback);
  }

  // Start typing
  startTyping(conversationId) {
    if (!this.isConnected) return;
    this.socket.emit('typing:start', { conversationId });
  }

  // Stop typing
  stopTyping(conversationId) {
    if (!this.isConnected) return;
    this.socket.emit('typing:stop', { conversationId });
  }

  // Get online users
  getOnlineUsers(callback) {
    if (!this.isConnected) return;
    this.socket.emit('presence:getOnline', callback);
  }

  // Check if user is online
  checkUserOnline(userId, callback) {
    if (!this.isConnected) return;
    this.socket.emit('presence:check', { userId }, callback);
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Reconnect with new token
  reconnect() {
    this.disconnect();
    this.connect();
  }
}

// Singleton instance
const socketService = new SocketService();
export default socketService;

// React hook for socket
export const useSocket = () => {
  return {
    socket: socketService.socket,
    isConnected: socketService.isConnected,
    sendMessage: socketService.sendMessage.bind(socketService),
    markAsSeen: socketService.markAsSeen.bind(socketService),
    startTyping: socketService.startTyping.bind(socketService),
    stopTyping: socketService.stopTyping.bind(socketService),
    getOnlineUsers: socketService.getOnlineUsers.bind(socketService),
    checkUserOnline: socketService.checkUserOnline.bind(socketService),
  };
};
