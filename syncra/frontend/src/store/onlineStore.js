import { create } from 'zustand';

export const useOnlineStore = create((set, get) => ({
  // State
  onlineUsers: new Set(), // Set of user IDs
  lastSeen: {}, // userId -> timestamp

  // Actions
  setUserOnline: (userId) =>
    set((state) => ({
      onlineUsers: new Set([...state.onlineUsers, userId]),
      lastSeen: { ...state.lastSeen, [userId]: null },
    })),

  setUserOffline: (userId) =>
    set((state) => ({
      onlineUsers: new Set([...state.onlineUsers].filter((id) => id !== userId)),
      lastSeen: { ...state.lastSeen, [userId]: new Date().toISOString() },
    })),

  setOnlineUsers: (userIds) =>
    set({
      onlineUsers: new Set(userIds),
    }),

  isUserOnline: (userId) => {
    return get().onlineUsers.has(userId);
  },

  getLastSeen: (userId) => {
    return get().lastSeen[userId];
  },

  // Bulk update from server
  updateOnlineStatus: (onlineUserIds) => {
    set({
      onlineUsers: new Set(onlineUserIds),
    });
  },

  // Clear all
  clear: () => {
    set({
      onlineUsers: new Set(),
      lastSeen: {},
    });
  },
}));
