import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { fetchWithTimeout } from '../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const useChannelStore = create((set, get) => ({
  // State
  categories: [],
  uncategorized: [],
  currentChannel: null,
  messages: {},        // channelId -> messages[]
  typingUsers: {},     // channelId -> [{userId, username}]
  isLoading: false,
  error: null,

  // Actions
  setCurrentChannel: (channel) => set({ currentChannel: channel }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // Fetch channels for a server
  fetchChannels: async (serverId) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    set({ isLoading: true, error: null });
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers/${serverId}/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch channels');
      const data = await res.json();
      set({
        categories: data.categories || [],
        uncategorized: data.uncategorized || [],
        isLoading: false,
      });
      return data;
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return null;
    }
  },

  // Create channel
  createChannel: async (serverId, name, type = 'text', categoryId = null, topic = null) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers/${serverId}/channels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, type, categoryId, topic }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create channel');
      }
      const data = await res.json();
      await get().fetchChannels(serverId);
      return { success: true, channel: data.channel };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Delete channel
  deleteChannel: async (serverId, channelId) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers/${serverId}/channels/${channelId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete channel');
      }
      await get().fetchChannels(serverId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Create category
  createCategory: async (serverId, name) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers/${serverId}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to create category');
      await get().fetchChannels(serverId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Fetch channel messages
  fetchMessages: async (serverId, channelId, limit = 50, offset = 0) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    set({ isLoading: true });
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/servers/${serverId}/channels/${channelId}/messages?limit=${limit}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      const messages = data.messages || [];
      set((state) => ({
        messages: {
          ...state.messages,
          [channelId]: offset > 0
            ? [...messages, ...(state.messages[channelId] || [])]
            : messages,
        },
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Add a channel message (from socket)
  addMessage: (channelId, message) =>
    set((state) => {
      const existing = state.messages[channelId] || [];
      const exists = existing.some((m) => m.id === message.id);
      if (exists) return state;
      return {
        messages: { ...state.messages, [channelId]: [...existing, message] },
      };
    }),

  // Replace temp message
  replaceTempMessage: (channelId, tempId, realMessage) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).map((m) =>
          m.id === tempId ? realMessage : m
        ),
      },
    })),

  // Update a message (edit)
  updateMessage: (channelId, messageId, updates) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
      },
    })),

  // Remove a message (soft delete visual)
  markMessageDeleted: (channelId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, content: null } : m
        ),
      },
    })),

  // Remove message entirely
  removeMessage: (channelId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).filter((m) => m.id !== messageId),
      },
    })),

  // Add reaction to a message
  addReaction: (channelId, messageId, reaction) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).map((m) => {
          if (m.id !== messageId) return m;
          const reactions = [...(m.reactions || [])];
          const exists = reactions.some(
            (r) => r.emoji === reaction.emoji && r.userId === reaction.userId
          );
          if (!exists) reactions.push(reaction);
          return { ...m, reactions };
        }),
      },
    })),

  // Remove reaction from a message
  removeReaction: (channelId, messageId, emoji, userId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [channelId]: (state.messages[channelId] || []).map((m) => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            reactions: (m.reactions || []).filter(
              (r) => !(r.emoji === emoji && r.userId === userId)
            ),
          };
        }),
      },
    })),

  // Typing users
  setTypingUser: (channelId, userId, username, isTyping) =>
    set((state) => {
      const current = state.typingUsers[channelId] || [];
      let updated;
      if (isTyping) {
        if (current.some((t) => t.userId === userId)) return state;
        updated = [...current, { userId, username }];
      } else {
        updated = current.filter((t) => t.userId !== userId);
      }
      return { typingUsers: { ...state.typingUsers, [channelId]: updated } };
    }),

  // Upload media in channel
  uploadMedia: async (serverId, channelId, file, caption) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };
    const formData = new FormData();
    formData.append('file', file);
    if (caption) formData.append('caption', caption);
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/servers/${serverId}/channels/${channelId}/upload`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
        60000
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to upload');
      }
      const data = await res.json();
      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
}));
