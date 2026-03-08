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

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'application/x-rar-compressed',
  'text/plain', 'text/csv',
];

const MAX_SIZES = {
  image: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  document: 25 * 1024 * 1024,
};

const getFileCategory = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const ChatArea = () => {
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [fileError, setFileError] = useState(null);
  
  const { user } = useAuthStore();
  const { currentConversation, clearCurrentConversation } = useConversationStore();
  const { messages, fetchMessages, addMessage, uploadMedia } = useMessageStore();
  const { isUserOnline } = useOnlineStore();
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  
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

  // Reconnect catch-up: re-fetch messages when socket reconnects
  useEffect(() => {
    if (!conversationId || !socketService.socket) return;
    const handler = () => {
      fetchMessages(conversationId);
      socketService.markAsSeen(conversationId);
    };
    socketService.socket.on('connect', handler);
    return () => {
      socketService.socket?.off('connect', handler);
    };
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

  // Retry a failed message
  const handleRetry = (failedMessage) => {
    useMessageStore.getState().removeMessage(conversationId, failedMessage.id);
    setInputValue(failedMessage.content);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // File attachment handlers
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be selected again
    e.target.value = '';

    setFileError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('Unsupported file type');
      return;
    }

    const category = getFileCategory(file.type);
    const maxSize = MAX_SIZES[category];
    if (file.size > maxSize) {
      setFileError(`File too large. Max: ${formatFileSize(maxSize)}`);
      return;
    }

    setSelectedFile(file);

    // Generate preview for images/videos
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    } else if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
  };

  const clearFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setSelectedFile(null);
    setFilePreview(null);
    setFileError(null);
  };

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const handleSendMedia = async () => {
    if (!selectedFile || !conversationId) return;

    setUploadProgress(true);
    const caption = inputValue.trim() || null;

    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const category = getFileCategory(selectedFile.type);
    const optimisticMessage = {
      id: tempId,
      conversationId,
      senderId: user.id,
      senderUsername: user.username,
      content: caption,
      status: 'sending',
      createdAt: new Date().toISOString(),
      messageType: category,
      mediaUrl: filePreview,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      mimeType: selectedFile.type,
    };

    addMessage(conversationId, optimisticMessage);
    clearFile();
    setInputValue('');

    const result = await uploadMedia(conversationId, selectedFile, caption);
    setUploadProgress(false);

    if (result.success && result.message) {
      useMessageStore.getState().replaceTempMessage(conversationId, tempId, result.message);
      useConversationStore.getState().updateConversationWithMessage(conversationId, result.message);
    } else {
      useMessageStore.getState().updateMessageStatus(conversationId, tempId, 'error');
    }
  };

  const otherUser = currentConversation?.otherUser;
  const isOnline = isUserOnline(otherUser?.id);

  return (
    <div className="flex-1 flex flex-col bg-surface-50 dark:bg-surface-950 dark-gradient-bg">
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between bg-white dark:bg-surface-900/95 border-b border-surface-200 dark:border-surface-700/40 backdrop-blur-sm">
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
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-accent-400 border-2 border-white dark:border-surface-900 rounded-full" />
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
                  onRetry={handleRetry}
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
      <div className="px-4 sm:px-6 lg:px-8 py-4 bg-white dark:bg-surface-900/95 border-t border-surface-200 dark:border-surface-700/40 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto">
          {/* File preview */}
          {selectedFile && (
            <div className="mb-3 p-3 bg-surface-100 dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700/50 flex items-center gap-3">
              {/* Thumbnail or icon */}
              {filePreview && selectedFile.type.startsWith('image/') ? (
                <img src={filePreview} alt="Preview" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
              ) : filePreview && selectedFile.type.startsWith('video/') ? (
                <video src={filePreview} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-surface-200 dark:bg-surface-700 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 dark:text-white truncate">
                  {selectedFile.name}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>

              <button
                onClick={clearFile}
                className="p-1.5 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors flex-shrink-0"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* File error */}
          {fileError && (
            <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {fileError}
            </div>
          )}

          <form onSubmit={selectedFile ? (e) => { e.preventDefault(); handleSendMedia(); } : handleSubmit} className="flex items-end gap-3">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ALLOWED_TYPES.join(',')}
              onChange={handleFileSelect}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500 dark:text-surface-400 transition-colors"
              title="Attach file"
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
                placeholder={selectedFile ? 'Add a caption...' : 'Type a message...'}
                className="w-full px-4 py-3 bg-surface-100 dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/50 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-primary-500/50 dark-glow-focus transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={(!inputValue.trim() && !selectedFile) || isSending || uploadProgress}
              className="p-3 btn-gradient disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
            >
              {isSending || uploadProgress ? (
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
