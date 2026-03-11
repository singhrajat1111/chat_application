import { create } from 'zustand';
import { useAuthStore } from './authStore';
import { fetchWithTimeout } from '../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const useServerStore = create((set, get) => ({
  // State
  servers: [],
  currentServer: null,
  members: [],
  isLoading: false,
  error: null,

  // Actions
  setServers: (servers) => set({ servers }),
  setCurrentServer: (server) => set({ currentServer: server }),
  setMembers: (members) => set({ members }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // Fetch user's servers
  fetchServers: async () => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    set({ isLoading: true, error: null });
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch servers');
      const data = await res.json();
      set({ servers: data.servers || [], isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  // Get server details
  fetchServer: async (serverId) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers/${serverId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch server');
      const data = await res.json();
      set({ currentServer: data.server });
      return data.server;
    } catch (error) {
      set({ error: error.message });
      return null;
    }
  },

  // Create server
  createServer: async (name) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };
    set({ isLoading: true, error: null });
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create server');
      }
      const data = await res.json();
      await get().fetchServers();
      set({ isLoading: false });
      return { success: true, server: data.server };
    } catch (error) {
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // Update server
  updateServer: async (serverId, updates) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers/${serverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update server');
      const data = await res.json();
      await get().fetchServers();
      return { success: true, server: data.server };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Delete server
  deleteServer: async (serverId) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers/${serverId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete server');
      set({ currentServer: null });
      await get().fetchServers();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Leave server
  leaveServer: async (serverId) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers/${serverId}/leave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to leave server');
      }
      set({ currentServer: null });
      await get().fetchServers();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Fetch members
  fetchMembers: async (serverId) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers/${serverId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch members');
      const data = await res.json();
      set({ members: data.members || [] });
    } catch (error) {
      console.error('Fetch members error:', error);
    }
  },

  // Create invite
  createInvite: async (serverId, maxUses, expiresInHours) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers/${serverId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ maxUses, expiresInHours }),
      });
      if (!res.ok) throw new Error('Failed to create invite');
      const data = await res.json();
      return { success: true, invite: data.invite };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Join via invite
  joinViaInvite: async (code) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to join');
      }
      const data = await res.json();
      await get().fetchServers();
      return { success: true, ...data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Update member role
  updateMemberRole: async (serverId, userId, role) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers/${serverId}/members/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      await get().fetchMembers(serverId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Remove member
  removeMember: async (serverId, userId) => {
    const token = useAuthStore.getState().token;
    if (!token) return { success: false };
    try {
      const res = await fetchWithTimeout(`${API_URL}/servers/${serverId}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to remove member');
      await get().fetchMembers(serverId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
}));
