import { useState, useEffect } from 'react';
import { useChannelStore } from '../store/channelStore';
import { useServerStore } from '../store/serverStore';
import { useAuthStore } from '../store/authStore';

const ChannelSidebar = ({ serverId, onBack }) => {
  const { categories, uncategorized, currentChannel, setCurrentChannel, fetchChannels, createChannel, createCategory } = useChannelStore();
  const { currentServer, fetchServer, fetchMembers } = useServerStore();
  const { user } = useAuthStore();
  
  const [collapsed, setCollapsed] = useState({});
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('text');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    if (serverId) {
      fetchServer(serverId);
      fetchChannels(serverId);
      fetchMembers(serverId);
    }
  }, [serverId, fetchServer, fetchChannels, fetchMembers]);

  // Auto-select first channel
  useEffect(() => {
    if (!currentChannel) {
      const firstChannel = uncategorized[0] || categories[0]?.channels?.[0];
      if (firstChannel) setCurrentChannel(firstChannel);
    }
  }, [uncategorized, categories, currentChannel, setCurrentChannel]);

  const isAdmin = () => {
    const members = useServerStore.getState().members;
    const me = members.find(m => m.userId === user?.id);
    return me && ['owner', 'admin'].includes(me.serverRole || me.server_role);
  };

  const toggleCollapse = (catId) => {
    setCollapsed(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;
    const result = await createChannel(serverId, newChannelName.trim(), newChannelType, selectedCategory);
    if (result.success) {
      setNewChannelName('');
      setShowCreateChannel(false);
      fetchChannels(serverId);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    const result = await createCategory(serverId, newCategoryName.trim());
    if (result.success) {
      setNewCategoryName('');
      setShowCreateCategory(false);
      fetchChannels(serverId);
    }
  };

  const handleInvite = async () => {
    setInviteLoading(true);
    const result = await useServerStore.getState().createInvite(serverId);
    setInviteLoading(false);
    if (result.success) {
      setInviteCode(result.invite?.code || result.code || '');
      setShowInvite(true);
    }
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(inviteCode);
  };

  const channelIcon = (type) => {
    if (type === 'voice') return (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      </svg>
    );
    if (type === 'announcement') return (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    );
    return (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
      </svg>
    );
  };

  const renderChannel = (channel) => {
    const isActive = currentChannel?.id === channel.id;
    return (
      <button
        key={channel.id}
        onClick={() => setCurrentChannel(channel)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors group ${
          isActive
            ? 'bg-surface-200 dark:bg-surface-700 text-surface-900 dark:text-white font-medium'
            : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-surface-200'
        }`}
      >
        <span className={isActive ? 'text-surface-700 dark:text-surface-300' : 'text-surface-400 dark:text-surface-500'}>
          {channelIcon(channel.channelType || channel.channel_type)}
        </span>
        <span className="truncate">{channel.name}</span>
      </button>
    );
  };

  return (
    <div className="w-60 h-full bg-surface-50 dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700/40 flex flex-col flex-shrink-0">
      {/* Server header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-surface-200 dark:border-surface-700/40 shadow-sm">
        <button onClick={onBack} className="mr-2 p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500 dark:text-surface-400 lg:hidden">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-semibold text-surface-900 dark:text-white truncate text-sm flex-1">
          {currentServer?.name || 'Server'}
        </h2>
        {isAdmin() && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleInvite}
              className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500 dark:text-surface-400 transition-colors"
              title="Create Invite"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {/* Uncategorized channels */}
        {uncategorized.map(renderChannel)}

        {/* Categorized channels */}
        {categories.map((cat) => (
          <div key={cat.id} className="mt-2">
            <button
              onClick={() => toggleCollapse(cat.id)}
              className="flex items-center gap-1 w-full px-1 py-1 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200 transition-colors group"
            >
              <svg
                className={`w-3 h-3 transition-transform ${collapsed[cat.id] ? '-rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span className="truncate">{cat.name}</span>
              {isAdmin() && (
                <svg
                  onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat.id); setShowCreateChannel(true); }}
                  className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity hover:text-surface-900 dark:hover:text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              )}
            </button>
            {!collapsed[cat.id] && (
              <div className="ml-1 space-y-0.5">
                {(cat.channels || []).map(renderChannel)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom actions */}
      {isAdmin() && (
        <div className="px-2 py-2 border-t border-surface-200 dark:border-surface-700/40 flex gap-1">
          <button
            onClick={() => { setSelectedCategory(null); setShowCreateChannel(true); }}
            className="flex-1 py-1.5 text-xs text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 rounded-md transition-colors"
          >
            + Channel
          </button>
          <button
            onClick={() => setShowCreateCategory(true)}
            className="flex-1 py-1.5 text-xs text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-100 dark:hover:bg-surface-800 rounded-md transition-colors"
          >
            + Category
          </button>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateChannel(false)}>
          <div className="bg-white dark:bg-surface-800 rounded-xl p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-3">Create Channel</h3>
            <form onSubmit={handleCreateChannel} className="space-y-3">
              <input
                type="text"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="channel-name"
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                autoFocus
              />
              <div className="flex gap-2">
                {['text', 'voice', 'announcement'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewChannelType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      newChannelType === t
                        ? 'bg-primary-500 text-white'
                        : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreateChannel(false)} className="px-4 py-2 text-sm text-surface-500 hover:text-surface-800 dark:hover:text-white">Cancel</button>
                <button type="submit" disabled={!newChannelName.trim()} className="px-4 py-2 btn-gradient text-white rounded-lg text-sm font-medium disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {showCreateCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateCategory(false)}>
          <div className="bg-white dark:bg-surface-800 rounded-xl p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-3">Create Category</h3>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                maxLength={100}
                className="w-full px-3 py-2 rounded-lg bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreateCategory(false)} className="px-4 py-2 text-sm text-surface-500 hover:text-surface-800 dark:hover:text-white">Cancel</button>
                <button type="submit" disabled={!newCategoryName.trim()} className="px-4 py-2 btn-gradient text-white rounded-lg text-sm font-medium disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowInvite(false)}>
          <div className="bg-white dark:bg-surface-800 rounded-xl p-5 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-surface-900 dark:text-white mb-3">Server Invite</h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-3">Share this code with others to join:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-surface-50 dark:bg-surface-900 rounded-lg text-sm text-surface-900 dark:text-white font-mono select-all break-all">
                {inviteCode}
              </code>
              <button onClick={copyInvite} className="px-3 py-2 btn-gradient text-white rounded-lg text-sm font-medium">
                Copy
              </button>
            </div>
            <button onClick={() => setShowInvite(false)} className="mt-3 w-full text-center text-sm text-surface-500 hover:text-surface-800 dark:hover:text-white">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChannelSidebar;
