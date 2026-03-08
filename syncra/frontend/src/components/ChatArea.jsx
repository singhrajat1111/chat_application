import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useConversationStore } from '../store/conversationStore';
import { useMessageStore } from '../store/messageStore';
import { useOnlineStore } from '../store/onlineStore';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import socketService from '../socket/socket';
import { getInitials, getAvatarColor } from '../utils/format';

const ChatArea = () => {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  
  const { user } = useAuthStore();
  const { currentConversation, clearCurrentConversation } = useConversationStore();
  const { messages, fetchMessages, addMessage } = useMessageStore();
  const { isUserOnline } = useOnlineStore();
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  
  const conversationId = currentConversation?.id;
  const conversationMessages = messages[conversationId] || [];
  const typingUsers = useMessageStore.getState().typingUsers[conversationId] || [];
  const otherTypingUsers = typingUsers.filter((id) => id !== user?.id);
  
  const { startTyping, stopTyping } = useTypingIndicator(conversationId);

  // Fetch messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      fetchMessages(conversationId);
      // Mark as seen
      socketService.markAsSeen(conversationId);
    }
  }, [conversationId, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages, typingUsers]);

  // Focus input on conversation change
  useEffect(() => {
    inputRef.current?.focus();
  }, [conversationId]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (e.target.value.trim()) {
      startTyping();
    } else {
      stopTyping();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const content = inputValue.trim();
    if (!content || !conversationId) return;

    setIsSending(true);
    stopTyping();

    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      conversationId,
      senderId: user.id,
      senderUsername: user.username,
      content,
      status: 'sending',
      createdAt: new Date().toISOString(),
    };
    
    addMessage(conversationId, optimisticMessage);
    setInputValue('');

    // Send via socket
    socketService.sendMessage(conversationId, content, (response) => {
      setIsSending(false);
      
      if (response?.error) {
        // Update message to show error
        useMessageStore.getState().updateMessageStatus(conversationId, tempId, 'error');
      } else if (response?.message) {
        // Replace temp message with server-confirmed message
        useMessageStore.getState().replaceTempMessage(conversationId, tempId, response.message);
        useConversationStore.getState().updateConversationWithMessage(
          conversationId,
          response.message
        );
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const otherUser = currentConversation?.otherUser;
  const isOnline = isUserOnline(otherUser?.id);

  return (
    <div className="flex-1 flex flex-col bg-surface-50 dark:bg-surface-950">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between bg-white dark:bg-surface-900 border-b border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-4">
          {/* Back button (mobile) */}
          <button
            onClick={clearCurrentConversation}
            className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
          >
            <svg className="w-5 h-5 text-surface-600 dark:text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* User info */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(
                  otherUser?.username
                )}`}
              >
                {getInitials(otherUser?.username)}
              </div>
              {isOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-surface-900 rounded-full" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-surface-900 dark:text-white">
                {otherUser?.username}
              </h3>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                {isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500 dark:text-surface-400 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6"
      >
        <div className="max-w-3xl mx-auto space-y-4">
          {conversationMessages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-surface-500 dark:text-surface-400">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            conversationMessages.map((message, index) => {
              const isFirstInGroup =
                index === 0 ||
                conversationMessages[index - 1].senderId !== message.senderId;
              const isLastInGroup =
                index === conversationMessages.length - 1 ||
                conversationMessages[index + 1].senderId !== message.senderId;

              return (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isOwn={message.senderId === user?.id}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                />
              );
            })
          )}
          
          {/* Typing indicator */}
          {otherTypingUsers.length > 0 && (
            <TypingIndicator username={otherUser?.username} />
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 bg-white dark:bg-surface-900 border-t border-surface-200 dark:border-surface-800">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="flex items-end gap-3">
            <button
              type="button"
              className="p-3 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500 dark:text-surface-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>

            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onBlur={stopTyping}
                placeholder="Type a message..."
                className="w-full px-4 py-3 bg-surface-100 dark:bg-surface-800 border-0 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={!inputValue.trim() || isSending}
              className="p-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary-600 text-white rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {isSending ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
