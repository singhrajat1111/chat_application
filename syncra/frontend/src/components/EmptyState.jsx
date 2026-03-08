const EmptyState = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-surface-50 dark:bg-surface-950 dark-gradient-bg p-8">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 mx-auto mb-6 relative">
          <div className="absolute inset-0 bg-primary-500/10 dark:bg-primary-500/20 rounded-full animate-pulse" />
          <div className="relative w-full h-full bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center shadow-xl shadow-primary-500/30">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-bold text-surface-900 dark:text-white mb-3">
          Start a conversation
        </h2>
        
        <p className="text-surface-500 dark:text-surface-400 leading-relaxed">
          Select a conversation from the sidebar or search for a user to start messaging. 
          Your messages are synchronized in real-time across all your devices.
        </p>

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-surface-400 dark:text-surface-500">
          <span className="w-2 h-2 bg-accent-400 rounded-full animate-pulse" />
          Connected and ready
        </div>
      </div>
    </div>
  );
};

export default EmptyState;
