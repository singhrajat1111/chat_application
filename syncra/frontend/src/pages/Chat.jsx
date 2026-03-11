import { useState, useEffect } from 'react';
import { useServerStore } from '../store/serverStore';
import { useChannelStore } from '../store/channelStore';
import { useConversationStore } from '../store/conversationStore';
import ServerStrip from '../components/ServerStrip';
import ChannelSidebar from '../components/ChannelSidebar';
import ChannelChatArea from '../components/ChannelChatArea';
import MemberList from '../components/MemberList';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import EmptyState from '../components/EmptyState';

const Chat = () => {
  const { currentConversation, fetchConversations } = useConversationStore();
  const { fetchServers } = useServerStore();
  const { setCurrentChannel } = useChannelStore();

  const [activeServerId, setActiveServerId] = useState(null);
  const [showMembers, setShowMembers] = useState(false);
  const [isDMActive, setIsDMActive] = useState(true);

  useEffect(() => {
    fetchConversations();
    fetchServers();
  }, [fetchConversations, fetchServers]);

  const handleSelectServer = (serverId) => {
    setActiveServerId(serverId);
    setIsDMActive(false);
    setCurrentChannel(null);
  };

  const handleDMClick = () => {
    setActiveServerId(null);
    setIsDMActive(true);
    setCurrentChannel(null);
  };

  const handleBackToServers = () => {
    setActiveServerId(null);
    setIsDMActive(true);
  };

  return (
    <div className="h-screen flex bg-surface-50 dark:bg-surface-950 dark-gradient-bg">
      {/* Server strip - always visible */}
      <ServerStrip
        onSelectServer={handleSelectServer}
        activeServerId={activeServerId}
        onDMClick={handleDMClick}
        isDMActive={isDMActive}
      />

      {/* DM mode: Sidebar + Chat */}
      {isDMActive && (
        <>
          <div className={`${currentConversation ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 flex-shrink-0`}>
            <Sidebar />
          </div>
          <div className={`${currentConversation ? 'flex' : 'hidden lg:flex'} flex-1`}>
            {currentConversation ? <ChatArea /> : <EmptyState />}
          </div>
        </>
      )}

      {/* Server mode: Channel sidebar + Chat + Members */}
      {!isDMActive && activeServerId && (
        <>
          <ChannelSidebar
            serverId={activeServerId}
            onBack={handleBackToServers}
          />
          <ChannelChatArea
            showMembers={showMembers}
            onToggleMembers={() => setShowMembers(!showMembers)}
          />
          {showMembers && <MemberList />}
        </>
      )}
    </div>
  );
};

export default Chat;
