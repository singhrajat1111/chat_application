import { useState } from 'react';
import { useServerStore } from '../store/serverStore';
import { getInitials } from '../utils/format';

const ServerStrip = ({ onSelectServer, activeServerId, onDMClick, isDMActive }) => {
  const { servers } = useServerStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  const handleCreateServer = async (e) => {
    e.preventDefault();
    if (!newServerName.trim()) return;
    setCreating(true);
    setError('');
    const result = await useServerStore.getState().createServer(newServerName.trim());
    setCreating(false);
    if (result.success) {
      setNewServerName('');
      setShowCreate(false);
      onSelectServer(result.server.id);
    } else {
      setError(result.error || 'Failed to create server');
    }
  };

  const handleJoinServer = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setJoining(true);
    setError('');
    const result = await useServerStore.getState().joinViaInvite(inviteCode.trim());
    setJoining(false);
    if (result.success) {
      setInviteCode('');
      setShowJoin(false);
      if (result.serverId) onSelectServer(result.serverId);
    } else {
      setError(result.error || 'Failed to join');
    }
  };

  return (
    <div className="w-[72px] h-full bg-surface-100 dark:bg-surface-950 flex flex-col items-center py-3 gap-2 overflow-y-auto flex-shrink-0">
      {/* DM button */}
      <button
        onClick={onDMClick}
        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 group relative ${
          isDMActive
            ? 'bg-primary-500 text-white rounded-xl'
            : 'bg-surface-200 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-primary-500 hover:text-white hover:rounded-xl'
        }`}
        title="Direct Messages"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        {isDMActive && (
          <span className="absolute -left-1 w-1 h-10 bg-primary-500 rounded-r-full" />
        )}
      </button>

      <div className="w-8 h-[2px] bg-surface-200 dark:bg-surface-700 rounded-full my-1" />

      {/* Server icons */}
      {servers.map((server) => {
        const isActive = activeServerId === server.id;
        return (
          <button
            key={server.id}
            onClick={() => onSelectServer(server.id)}
            className={`relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 text-sm font-semibold group ${
              isActive
                ? 'bg-primary-500 text-white rounded-xl'
                : 'bg-surface-200 dark:bg-surface-800 text-surface-600 dark:text-surface-300 hover:bg-primary-500 hover:text-white hover:rounded-xl'
            }`}
            title={server.name}
          >
            {server.iconUrl ? (
              <img src={server.iconUrl} alt={server.name} className="w-full h-full rounded-inherit object-cover" />
            ) : (
              getInitials(server.name)
            )}
            {isActive && (
              <span className="absolute -left-1 w-1 h-10 bg-primary-500 rounded-r-full" />
            )}
            {!isActive && (
              <span className="absolute -left-1 w-1 h-0 bg-surface-400 dark:bg-white rounded-r-full group-hover:h-5 transition-all duration-200" />
            )}
            {/* Tooltip */}
            <span className="absolute left-full ml-3 px-3 py-1.5 bg-surface-900 dark:bg-surface-800 text-white text-sm rounded-md shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              {server.name}
            </span>
          </button>
        );
      })}

      {/* Add server / Join */}
      <button
        onClick={() => { setShowCreate(true); setError(''); }}
        className="w-12 h-12 rounded-2xl bg-surface-200 dark:bg-surface-800 text-accent-500 hover:bg-accent-500 hover:text-white hover:rounded-xl transition-all duration-200 flex items-center justify-center group relative"
        title="Add a Server"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <span className="absolute left-full ml-3 px-3 py-1.5 bg-surface-900 dark:bg-surface-800 text-white text-sm rounded-md shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
          Add a Server
        </span>
      </button>

      {/* Create Server Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white dark:bg-surface-800 rounded-xl p-6 w-full max-w-md shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-4">Create a Server</h2>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <form onSubmit={handleCreateServer} className="space-y-4">
              <input
                type="text"
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="Server name"
                maxLength={100}
                className="w-full px-4 py-3 rounded-lg bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setShowJoin(true); setError(''); }}
                  className="flex-1 py-2.5 text-sm text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors"
                >
                  Have an invite? Join instead
                </button>
                <button
                  type="submit"
                  disabled={creating || !newServerName.trim()}
                  className="px-6 py-2.5 btn-gradient text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Server Modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowJoin(false)}>
          <div className="bg-white dark:bg-surface-800 rounded-xl p-6 w-full max-w-md shadow-2xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-4">Join a Server</h2>
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <form onSubmit={handleJoinServer} className="space-y-4">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Invite code"
                className="w-full px-4 py-3 rounded-lg bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                autoFocus
              />
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowJoin(false); setShowCreate(true); setError(''); }}
                  className="px-4 py-2.5 text-sm text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={joining || !inviteCode.trim()}
                  className="px-6 py-2.5 btn-gradient text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {joining ? 'Joining...' : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServerStrip;
