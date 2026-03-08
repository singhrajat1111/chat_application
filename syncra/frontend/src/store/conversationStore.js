import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { fetchWithTimeout } from '../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const useConversationStore = create((set, get) => ({
  // State
  conversations: [],
  currentConversation: null,
  isLoading: false,
  error: null,

  // Actions
  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // Fetch user's conversations
  fetchConversations: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    set({ isLoading: true, error: null });
    try {
      const response = await fetchWithTimeout(`${API_URL}/conversations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      set({ conversations: data.conversations || [], isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Get or create conversation with user
  startConversation: async (userId) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };

    set({ isLoading: true, error: null });
    try {
      const response = await fetchWithTimeout(`${API_URL}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const data = await response.json();
      
      // Add to conversations list if new
      if (data.isNew) {
        await get().fetchConversations();
      }

      set({ isLoading: false });
      return { success: true, conversationId: data.id };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // Set active conversation
  setActiveConversation: async (conversationId) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    try {
      const response = await fetchWithTimeout(`${API_URL}/conversations/${conversationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch conversation');
      }

      const data = await response.json();
      set({ currentConversation: data.conversation });
    } catch (error) {
      console.error('Set active conversation error:', error);
    }
  },

  // Update conversation with new message
  updateConversationWithMessage: (conversationId, message) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? {
              ...conv,
              lastMessage: message,
              updatedAt: message.createdAt,
              unreadCount:
                state.currentConversation?.id === conversationId
                  ? 0
                  : (conv.unreadCount || 0) + 1,
            }
          : conv
      ),
    }));
  },

  // Update unread count
  updateUnreadCount: (conversationId, reset = false) => {
    set((state) => ({
      conversations: state.conversations.map((conv) =>
        conv.id === conversationId
          ? { ...conv, unreadCount: reset ? 0 : conv.unreadCount }
          : conv
      ),
    }));
  },

  // Mark conversation as read
  markAsRead: async (conversationId) => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    try {
      await fetchWithTimeout(`${API_URL}/conversations/${conversationId}/seen`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      get().updateUnreadCount(conversationId, true);
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  },

  // Clear current conversation
  clearCurrentConversation: () => {
    set({ currentConversation: null });
  },
}));
