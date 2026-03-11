import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChannelStore } from '../store/channelStore';
import { useServerStore } from '../store/serverStore';
import ChannelMessageBubble from './ChannelMessageBubble';
import socketService from '../socket/socket';
import { getInitials, getAvatarColor, formatMessageTime } from '../utils/format';

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

const ChannelChatArea = ({ showMembers, onToggleMembers }) => {
  const { currentChannel, messages, typingUsers, fetchMessages, addMessage, uploadMedia } = useChannelStore();
  const { currentServer } = useServerStore();
  const { user } = useAuthStore();

  const serverId = currentServer?.id;

  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [fileError, setFileError] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const channelId = currentChannel?.id;
  const channelMessages = messages[channelId] || [];
  const channelTyping = typingUsers[channelId] || [];
  const otherTyping = channelTyping.filter(t => t.userId !== user?.id);

  // Fetch messages on channel change
  useEffect(() => {
    if (channelId && serverId) {
      fetchMessages(serverId, channelId);
      // Join channel room
      socketService.socket?.emit('channel:join', { channelId });
    }
    return () => {
      if (channelId) {
        socketService.socket?.emit('channel:leave', { channelId });
      }
    };
  }, [channelId, serverId, fetchMessages]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [channelId]);

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    if (e.target.value.trim()) {
      socketService.socket?.emit('channel:typing:start', { channelId });
    } else {
      socketService.socket?.emit('channel:typing:stop', { channelId });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const content = inputValue.trim();
    if (!content || !channelId) return;

    // If editing
    if (editingMessage) {
      socketService.socket?.emit('message:edit', {
        messageId: editingMessage.id,
        channelId,
        content,
      });
      useChannelStore.getState().updateMessage(channelId, editingMessage.id, { content, isEdited: true, is_edited: true });
      setEditingMessage(null);
      setInputValue('');
      return;
    }

    setIsSending(true);
    socketService.socket?.emit('channel:typing:stop', { channelId });

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      id: tempId,
      channelId,
      senderId: user.id,
      senderUsername: user.username,
      content,
      status: 'sending',
      createdAt: new Date().toISOString(),
      replyToId: replyTo?.id || null,
      replyTo: replyTo ? { id: replyTo.id, content: replyTo.content, senderUsername: replyTo.senderUsername } : null,
    };

    addMessage(channelId, optimisticMessage);
    setInputValue('');
    setReplyTo(null);

    socketService.socket?.emit('channel:message:send', {
      channelId,
      content,
      replyToId: replyTo?.id || null,
    }, (response) => {
      setIsSending(false);
      if (response?.error) {
        useChannelStore.getState().updateMessage(channelId, tempId, { status: 'error' });
      } else if (response?.message) {
        useChannelStore.getState().replaceTempMessage(channelId, tempId, response.message);
      }
    });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (selectedFile) {
        handleSendMedia();
      } else {
        handleSubmit(e);
      }
    }
    if (e.key === 'Escape') {
      if (editingMessage) { setEditingMessage(null); setInputValue(''); }
      if (replyTo) setReplyTo(null);
    }
  };

  const handleReply = useCallback((message) => {
    setReplyTo(message);
    setEditingMessage(null);
    inputRef.current?.focus();
  }, []);

  const handleEdit = useCallback((message) => {
    setEditingMessage(message);
    setInputValue(message.content || '');
    setReplyTo(null);
    inputRef.current?.focus();
  }, []);

  const handleDelete = useCallback((messageId) => {
    socketService.socket?.emit('message:delete', { messageId, channelId });
    useChannelStore.getState().markMessageDeleted(channelId, messageId);
  }, [channelId]);

  const handleReaction = useCallback((messageId, emoji) => {
    socketService.socket?.emit('message:reaction:add', { messageId, emoji, channelId });
    useChannelStore.getState().addReaction(channelId, messageId, { emoji, userId: user.id, username: user.username });
  }, [channelId, user]);

  // File handling
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setFileError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('Unsupported file type');
      return;
    }
    const category = getFileCategory(file.type);
    if (file.size > MAX_SIZES[category]) {
      setFileError(`File too large. Max: ${formatFileSize(MAX_SIZES[category])}`);
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setFilePreview(URL.createObjectURL(file));
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

  useEffect(() => {
    return () => { if (filePreview) URL.revokeObjectURL(filePreview); };
  }, [filePreview]);

  const handleSendMedia = async () => {
    if (!selectedFile || !channelId || !serverId) return;
    setUploadProgress(true);
    const caption = inputValue.trim() || null;
    const tempId = `temp-${Date.now()}`;
    const category = getFileCategory(selectedFile.type);

    addMessage(channelId, {
      id: tempId, channelId, senderId: user.id, senderUsername: user.username,
      content: caption, status: 'sending', createdAt: new Date().toISOString(),
      messageType: category, mediaUrl: filePreview, fileName: selectedFile.name,
      fileSize: selectedFile.size, mimeType: selectedFile.type,
    });
    clearFile();
    setInputValue('');

    const result = await uploadMedia(serverId, channelId, selectedFile, caption);
    setUploadProgress(false);
    if (result.success && result.message) {
      useChannelStore.getState().replaceTempMessage(channelId, tempId, result.message);
    } else {
      useChannelStore.getState().updateMessage(channelId, tempId, { status: 'error' });
    }
  };

  if (!currentChannel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-50 dark:bg-surface-950 dark-gradient-bg">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
          </div>
          <p className="text-surface-500 dark:text-surface-400">Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-surface-50 dark:bg-surface-950 dark-gradient-bg min-w-0">
      {/* Channel header */}
      <div className="h-12 px-4 flex items-center justify-between bg-white dark:bg-surface-900/95 border-b border-surface-200 dark:border-surface-700/40 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-5 h-5 text-surface-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
          <h3 className="font-semibold text-surface-900 dark:text-white text-sm truncate">
            {currentChannel.name}
          </h3>
          {currentChannel.topic && (
            <>
              <span className="text-surface-300 dark:text-surface-600">|</span>
              <span className="text-xs text-surface-500 dark:text-surface-400 truncate">{currentChannel.topic}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleMembers}
            className={`p-1.5 rounded-md transition-colors ${
              showMembers
                ? 'bg-surface-200 dark:bg-surface-700 text-surface-900 dark:text-white'
                : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
            }`}
            title="Members"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-4xl mx-auto space-y-1">
          {channelMessages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 dark:bg-surface-800 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white mb-1">
                Welcome to #{currentChannel.name}!
              </h3>
              <p className="text-surface-500 dark:text-surface-400 text-sm">
                This is the beginning of the #{currentChannel.name} channel.
              </p>
            </div>
          ) : (
            channelMessages.map((message) => (
              <ChannelMessageBubble
                key={message.id}
                message={message}
                isOwn={message.senderId === user?.id}
                currentUserId={user?.id}
                onReply={handleReply}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onReaction={handleReaction}
              />
            ))
          )}

          {otherTyping.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-1 text-sm text-surface-500 dark:text-surface-400">
              <div className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>{otherTyping.map(t => t.username).join(', ')} {otherTyping.length === 1 ? 'is' : 'are'} typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-white dark:bg-surface-900/95 border-t border-surface-200 dark:border-surface-700/40 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto">
          {/* Reply preview */}
          {replyTo && (
            <div className="mb-2 px-3 py-2 bg-surface-100 dark:bg-surface-800 rounded-lg border-l-2 border-primary-500 flex items-center justify-between text-sm">
              <div className="min-w-0">
                <span className="text-primary-500 font-medium text-xs">Replying to {replyTo.senderUsername}</span>
                <p className="text-surface-600 dark:text-surface-400 truncate text-xs">{replyTo.content}</p>
              </div>
              <button onClick={() => setReplyTo(null)} className="ml-2 p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Edit indicator */}
          {editingMessage && (
            <div className="mb-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-l-2 border-yellow-500 flex items-center justify-between text-sm">
              <span className="text-yellow-700 dark:text-yellow-400 text-xs font-medium">Editing message</span>
              <button onClick={() => { setEditingMessage(null); setInputValue(''); }} className="ml-2 p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* File preview */}
          {selectedFile && (
            <div className="mb-2 p-3 bg-surface-100 dark:bg-surface-800 rounded-lg flex items-center gap-3">
              {filePreview && selectedFile.type.startsWith('image/') ? (
                <img src={filePreview} alt="Preview" className="w-14 h-14 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-surface-200 dark:bg-surface-700 flex items-center justify-center">
                  <svg className="w-5 h-5 text-surface-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900 dark:text-white truncate">{selectedFile.name}</p>
                <p className="text-xs text-surface-500">{formatFileSize(selectedFile.size)}</p>
              </div>
              <button onClick={clearFile} className="p-1 text-surface-400 hover:text-surface-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {fileError && (
            <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm text-red-600 dark:text-red-400">
              {fileError}
            </div>
          )}

          <form onSubmit={selectedFile ? (e) => { e.preventDefault(); handleSendMedia(); } : handleSubmit} className="flex items-end gap-2">
            <input ref={fileInputRef} type="file" className="hidden" accept={ALLOWED_TYPES.join(',')} onChange={handleFileSelect} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500 dark:text-surface-400 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <div className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={editingMessage ? 'Edit your message...' : `Message #${currentChannel.name}`}
                className="w-full px-4 py-2.5 bg-surface-100 dark:bg-surface-800 border border-surface-200/60 dark:border-surface-700/50 rounded-lg text-surface-900 dark:text-white placeholder-surface-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all"
              />
            </div>
            <button
              type="submit"
              disabled={(!inputValue.trim() && !selectedFile) || isSending || uploadProgress}
              className="p-2.5 btn-gradient disabled:opacity-50 text-white rounded-lg transition-all"
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

export default ChannelChatArea;
