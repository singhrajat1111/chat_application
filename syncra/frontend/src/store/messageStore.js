import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { fetchWithTimeout } from '../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const useMessageStore = create((set, get) => ({
  // State
  messages: {}, // conversationId -> messages[]
  typingUsers: {}, // conversationId -> userIds[]
  isLoading: false,
  error: null,
  hasMore: {}, // conversationId -> boolean

  // Actions
  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: messages },
    })),

  addMessage: (conversationId, message) =>
    set((state) => {
      const existingMessages = state.messages[conversationId] || [];
      // Check if message already exists (optimistic update)
      const exists = existingMessages.some((m) => m.id === message.id);
      if (exists) {
        return {
          messages: {
            ...state.messages,
            [conversationId]: existingMessages.map((m) =>
              m.id === message.id ? message : m
            ),
          },
        };
      }
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...existingMessages, message],
        },
      };
    }),

  updateMessageStatus: (conversationId, messageId, status) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          m.id === messageId ? { ...m, status } : m
        ),
      },
    })),

  replaceTempMessage: (conversationId, tempId, realMessage) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).map((m) =>
          m.id === tempId ? realMessage : m
        ),
      },
    })),

  setTypingUsers: (conversationId, userIds) =>
    set((state) => ({
      typingUsers: { ...state.typingUsers, [conversationId]: userIds },
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // Fetch messages for conversation
  fetchMessages: async (conversationId, limit = 50, offset = 0) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const response = await fetchWithTimeout(
        `${API_URL}/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      const messages = data.messages || [];

      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: offset > 0 
            ? [...messages, ...(state.messages[conversationId] || [])]
            : messages,
        },
        hasMore: {
          ...state.hasMore,
          [conversationId]: messages.length === limit,
        },
        isLoading: false,
      }));
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Send message (HTTP fallback)
  sendMessage: async (conversationId, content) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };

    try {
      const response = await fetchWithTimeout(
        `${API_URL}/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();
      get().addMessage(conversationId, data.message);
      return { success: true, message: data.message };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  // Mark messages as seen
  markAsSeen: async (conversationId) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    try {
      await fetchWithTimeout(`${API_URL}/conversations/${conversationId}/seen`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Update local message statuses
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            m.senderId !== useAuthStore.getState().user?.id && m.status !== 'seen'
              ? { ...m, status: 'seen' }
              : m
          ),
        },
      }));
    } catch (error) {
      console.error('Mark as seen error:', error);
    }
  },

  // Handle incoming socket message
  handleIncomingMessage: (message) => {
    const conversationId = message.conversationId;
    get().addMessage(conversationId, message);
  },

  // Handle message status update
  handleStatusUpdate: (data) => {
    const { conversationId, messageIds, seenBy } = data;
    messageIds.forEach((messageId) => {
      get().updateMessageStatus(conversationId, messageId, 'seen');
    });
  },

  // Handle typing update
  handleTypingUpdate: (data) => {
    const { conversationId, typingUsers } = data;
    get().setTypingUsers(conversationId, typingUsers);
  },

  // Remove a message (e.g. failed optimistic message)
  removeMessage: (conversationId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).filter(
          (m) => m.id !== messageId
        ),
      },
    })),

  // Clear messages for conversation
  clearMessages: (conversationId) => {
    set((state) => {
      const newMessages = { ...state.messages };
      delete newMessages[conversationId];
      return { messages: newMessages };
    });
  },

  // Upload media file and create message
  uploadMedia: async (conversationId, file, caption) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false, error: 'Not authenticated' };

    const apiUrl = API_URL;
    const formData = new FormData();
    formData.append('file', file);
    if (caption) formData.append('caption', caption);

    try {
      const response = await fetchWithTimeout(
        `${apiUrl}/conversations/${conversationId}/upload`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
        60000 // 60s timeout for large files
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to upload');
      }

      const data = await response.json();
      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
}));
