import { useState, useRef, useEffect } from 'react';
import { formatMessageTime } from '../utils/format';
import { getInitials, getAvatarColor } from '../utils/format';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '👀'];

const ChannelMessageBubble = ({ message, isOwn, currentUserId, onReply, onEdit, onDelete, onReaction }) => {
  const {
    content, createdAt, senderUsername, senderId, status,
    messageType, mediaUrl, fileName, fileSize, mimeType,
    isEdited, is_edited, isDeleted, is_deleted,
    replyTo, reply_to, reactions,
  } = message;

  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiRef = useRef(null);

  const edited = isEdited || is_edited;
  const deleted = isDeleted || is_deleted;
  const replyData = replyTo || reply_to;
  const messageReactions = reactions || [];

  useEffect(() => {
    const handler = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (deleted) {
    return (
      <div className="flex items-start gap-3 px-4 py-1 group">
        <div className="w-10 h-10 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-sm text-surface-400 dark:text-surface-500 italic">This message was deleted</p>
        </div>
      </div>
    );
  }

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  const baseUrl = apiUrl.replace('/api', '');

  const renderMedia = () => {
    if (!messageType || messageType === 'text') return null;
    const url = mediaUrl?.startsWith('http') ? mediaUrl : `${baseUrl}${mediaUrl}`;

    if (messageType === 'image') {
      return (
        <div className="mt-1 max-w-md">
          <img src={url} alt={fileName || 'Image'} className="rounded-lg max-h-80 object-contain" loading="lazy" />
        </div>
      );
    }
    if (messageType === 'video') {
      return (
        <div className="mt-1 max-w-md">
          <video src={url} controls className="rounded-lg max-h-80" />
        </div>
      );
    }
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-2 p-2 bg-surface-100 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors max-w-xs">
        <svg className="w-8 h-8 text-surface-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-primary-500 hover:underline truncate">{fileName || 'Download'}</p>
          {fileSize && <p className="text-xs text-surface-400">{formatBytes(fileSize)}</p>}
        </div>
      </a>
    );
  };

  // Group reactions by emoji
  const groupedReactions = messageReactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { emoji: r.emoji, users: [], count: 0 };
    acc[r.emoji].users.push(r.userId || r.user_id);
    acc[r.emoji].count++;
    return acc;
  }, {});

  return (
    <div
      className="flex items-start gap-3 px-4 py-1 hover:bg-surface-100/50 dark:hover:bg-surface-800/30 group relative rounded-md transition-colors"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
    >
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${getAvatarColor(senderUsername)}`}>
        {getInitials(senderUsername)}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        {/* Header */}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-surface-900 dark:text-white">
            {senderUsername}
          </span>
          <span className="text-xs text-surface-400 dark:text-surface-500">
            {formatMessageTime(createdAt)}
          </span>
          {edited && <span className="text-xs text-surface-400 dark:text-surface-500">(edited)</span>}
          {status === 'error' && <span className="text-xs text-red-500">Failed</span>}
        </div>

        {/* Reply reference */}
        {replyData && (
          <div className="flex items-center gap-1.5 mt-0.5 mb-0.5">
            <div className="w-0.5 h-4 bg-primary-500 rounded-full flex-shrink-0" />
            <span className="text-xs text-primary-500 font-medium">{replyData.senderUsername || replyData.sender_username}</span>
            <span className="text-xs text-surface-500 dark:text-surface-400 truncate max-w-xs">{replyData.content}</span>
          </div>
        )}

        {/* Message text */}
        {content && (
          <p className="text-sm text-surface-800 dark:text-surface-200 break-words whitespace-pre-wrap">
            {content}
          </p>
        )}

        {/* Media */}
        {renderMedia()}

        {/* Reactions */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.values(groupedReactions).map((reaction) => {
              const hasReacted = reaction.users.includes(currentUserId);
              return (
                <button
                  key={reaction.emoji}
                  onClick={() => onReaction(message.id, reaction.emoji)}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs border transition-colors ${
                    hasReacted
                      ? 'bg-primary-500/10 border-primary-500/30 text-primary-600 dark:text-primary-400'
                      : 'bg-surface-100 dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                  }`}
                >
                  <span>{reaction.emoji}</span>
                  <span>{reaction.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {showActions && (
        <div className="absolute -top-3 right-4 flex items-center bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg overflow-hidden z-10">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-500 dark:text-surface-400 transition-colors"
            title="Add Reaction"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={() => onReply(message)}
            className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-500 dark:text-surface-400 transition-colors"
            title="Reply"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          {isOwn && (
            <>
              <button
                onClick={() => onEdit(message)}
                className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-700 text-surface-500 dark:text-surface-400 transition-colors"
                title="Edit"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(message.id)}
                className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-surface-500 dark:text-surface-400 hover:text-red-500 transition-colors"
                title="Delete"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div ref={emojiRef} className="absolute -top-12 right-4 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg p-2 flex gap-1 z-20">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onReaction(message.id, emoji); setShowEmojiPicker(false); }}
              className="w-7 h-7 flex items-center justify-center hover:bg-surface-100 dark:hover:bg-surface-700 rounded transition-colors text-sm"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const formatBytes = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default ChannelMessageBubble;
