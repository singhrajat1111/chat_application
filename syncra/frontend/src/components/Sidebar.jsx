import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useConversationStore } from '../store/conversationStore';
import { useOnlineStore } from '../store/onlineStore';
import { useThemeStore } from '../store/themeStore';
import { useDebounce } from '../hooks/useDebounce';
import ConversationItem from './ConversationItem';
import UserSearchItem from './UserSearchItem';
import { getInitials, getAvatarColor } from '../utils/format';

const Sidebar = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  const { user, logout } = useAuthStore();
  const { conversations, currentConversation, setActiveConversation, startConversation } = useConversationStore();
  const { isUserOnline } = useOnlineStore();
  const { toggleTheme, resolvedTheme } = useThemeStore();
  
  const debouncedSearch = useDebounce(searchQuery, 300);
  const userMenuRef = useRef(null);

  // Search users when query changes
  useEffect(() => {
    const search = async () => {
      if (debouncedSearch.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const results = await useAuthStore.getState().searchUsers(debouncedSearch);
      setSearchResults(results);
      setIsSearching(false);
    };

    search();
  }, [debouncedSearch]);

  // Close user menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUserSelect = async (selectedUser) => {
    const result = await startConversation(selectedUser.id);
    if (result.success) {
      await setActiveConversation(result.conversationId);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const showSearchResults = searchQuery.length >= 2;

  return (
    <div className="w-full lg:w-80 h-full bg-white dark:bg-surface-900/95 border-r border-surface-200 dark:border-surface-700/40 flex flex-col backdrop-blur-sm">
      {/* Header */}
      <div className="p-4 border-b border-surface-200 dark:border-surface-700/40">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-surface-900 dark:text-white">Syncra</span>
          </div>
          
          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(user?.username)}`}>
                {getInitials(user?.username)}
              </div>
              <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700/50 py-2 z-50 animate-fade-in">
                <div className="px-4 py-2 border-b border-surface-200 dark:border-surface-700/40">
                  <p className="font-medium text-surface-900 dark:text-white">{user?.username}</p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">{user?.email}</p>
                </div>
                
                <button
                  onClick={toggleTheme}
                  className="w-full px-4 py-2 text-left text-sm text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center gap-2"
                >
                  {resolvedTheme === 'dark' ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      Light mode
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      </svg>
                      Dark mode
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface-100 dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/50 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 dark-glow-focus transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {showSearchResults ? (
          <div className="p-2">
            <h3 className="px-4 py-2 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
              Search Results
            </h3>
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((user) => (
                <UserSearchItem
                  key={user.id}
                  user={user}
                  onClick={() => handleUserSelect(user)}
                  isOnline={isUserOnline(user.id)}
                />
              ))
            ) : (
              <div className="text-center py-8 text-surface-500 dark:text-surface-400">
                No users found
              </div>
            )}
          </div>
        ) : (
          <div className="p-2">
            <h3 className="px-4 py-2 text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
              Conversations
            </h3>
            {conversations.length > 0 ? (
              conversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isActive={currentConversation?.id === conversation.id}
                  onClick={() => setActiveConversation(conversation.id)}
                  isOnline={isUserOnline(conversation.otherUser?.id)}
                />
              ))
            ) : (
              <div className="text-center py-8 px-4">
                <div className="w-12 h-12 mx-auto mb-3 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-surface-500 dark:text-surface-400 text-sm">
                  No conversations yet.
                  <br />
                  Search for users to start chatting!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
