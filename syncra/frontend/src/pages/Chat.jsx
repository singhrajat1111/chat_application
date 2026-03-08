import { useEffect } from 'react';
import { useConversationStore } from '../store/conversationStore';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import EmptyState from '../components/EmptyState';

const Chat = () => {
  const { currentConversation, fetchConversations } = useConversationStore();

  // Fetch conversations on mount
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  return (
    <div className="h-screen flex bg-surface-50 dark:bg-surface-950 dark-gradient-bg">
      {/* Sidebar - hidden on mobile when a conversation is selected */}
      <div className={`${currentConversation ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 flex-shrink-0`}>
        <Sidebar />
      </div>

      {/* Chat Area - hidden on mobile when no conversation is selected */}
      <div className={`${currentConversation ? 'flex' : 'hidden lg:flex'} flex-1`}>
        {currentConversation ? (
          <ChatArea />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
};

export default Chat;
