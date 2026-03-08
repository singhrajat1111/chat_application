import { useState } from 'react';
import { formatMessageTime } from '../utils/format';
import { useMessageStore } from '../store/messageStore';

const MessageBubble = ({ message, isOwn, isFirstInGroup, isLastInGroup, onRetry }) => {
  const { content, createdAt, status, messageType, mediaUrl, fileName, fileSize, mimeType } = message;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  // WhatsApp-style status ticks
  const StatusIcon = () => {
    if (status === 'sending') {
      // Clock icon — message being sent
      return (
        <svg className="w-4 h-4 text-white/50" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 3.5a.5.5 0 0 1 .5.5v4l2.15 1.29a.5.5 0 1 1-.52.86l-2.37-1.43A.5.5 0 0 1 7.5 8V4a.5.5 0 0 1 .5-.5z"/>
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8z"/>
        </svg>
      );
    }
    if (status === 'sent') {
      // Single grey tick
      return (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 20 20" fill="none">
          <path d="M5 10.5l3.5 3.5L15 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60"/>
        </svg>
      );
    }
    if (status === 'delivered') {
      // Double grey ticks
      return (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 20" fill="none">
          <path d="M3 10.5l3.5 3.5L13 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60"/>
          <path d="M8 10.5l3.5 3.5L18 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60"/>
        </svg>
      );
    }
    if (status === 'seen') {
      // Double blue ticks
      return (
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 20" fill="none">
          <path d="M3 10.5l3.5 3.5L13 7" stroke="#34B7F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8 10.5l3.5 3.5L18 7" stroke="#34B7F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    if (status === 'error') {
      return (
        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    return null;
  };

  // Format file size for display
  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get file extension icon
  const getFileIcon = (mime) => {
    if (mime?.startsWith('application/pdf')) return '📄';
    if (mime?.includes('word') || mime?.includes('document')) return '📝';
    if (mime?.includes('sheet') || mime?.includes('excel')) return '📊';
    if (mime?.includes('presentation') || mime?.includes('powerpoint')) return '📑';
    if (mime?.includes('zip') || mime?.includes('rar') || mime?.includes('archive')) return '📦';
    return '📎';
  };

  // Render media content based on type
  const renderMedia = () => {
    if (!messageType || messageType === 'text') return null;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const baseUrl = apiUrl.replace('/api', '');
    const fullUrl = mediaUrl?.startsWith('http') ? mediaUrl : `${baseUrl}${mediaUrl}`;

    if (messageType === 'image') {
      return (
        <>
          <div
            className={`relative cursor-pointer rounded-lg overflow-hidden ${!imageLoaded ? 'bg-surface-200 dark:bg-surface-700 min-h-[200px] animate-pulse' : ''}`}
            onClick={() => setShowFullImage(true)}
          >
            <img
              src={fullUrl}
              alt={fileName || 'Image'}
              className={`max-w-full rounded-lg transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              style={{ maxHeight: '300px', objectFit: 'cover' }}
              onLoad={() => setImageLoaded(true)}
              loading="lazy"
            />
          </div>

          {/* Full-screen overlay */}
          {showFullImage && (
            <div
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
              onClick={() => setShowFullImage(false)}
            >
              <button
                onClick={() => setShowFullImage(false)}
                className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-50"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <img
                src={fullUrl}
                alt={fileName || 'Image'}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </>
      );
    }

    if (messageType === 'video') {
      return (
        <div className="rounded-lg overflow-hidden">
          <video
            src={fullUrl}
            controls
            className="max-w-full rounded-lg"
            style={{ maxHeight: '300px' }}
            preload="metadata"
          />
        </div>
      );
    }

    if (messageType === 'document') {
      return (
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
            isOwn
              ? 'bg-white/10 hover:bg-white/20'
              : 'bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600'
          }`}
        >
          <span className="text-2xl flex-shrink-0">{getFileIcon(mimeType)}</span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium truncate ${isOwn ? 'text-white' : 'text-surface-900 dark:text-white'}`}>
              {fileName || 'Document'}
            </p>
            {fileSize && (
              <p className={`text-xs ${isOwn ? 'text-white/60' : 'text-surface-400 dark:text-surface-500'}`}>
                {formatFileSize(fileSize)}
              </p>
            )}
          </div>
          <svg className={`w-5 h-5 flex-shrink-0 ${isOwn ? 'text-white/70' : 'text-surface-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
      );
    }

    return null;
  };

  const hasMedia = messageType && messageType !== 'text';

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-message-in`}
      style={{
        marginTop: isFirstInGroup ? '0.75rem' : '0.125rem',
      }}
    >
      <div
        className={`relative ${hasMedia ? 'max-w-[80%] sm:max-w-[70%]' : 'max-w-[75%] sm:max-w-[65%]'} ${hasMedia ? 'p-1.5' : 'px-4 py-2.5'} ${
          isOwn
            ? 'message-bubble-sent'
            : 'bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-message-received shadow-sm dark:shadow-none border border-surface-200/60 dark:border-surface-700/50'
        } ${isLastInGroup ? 'pb-2' : ''}`}
      >
        {/* Media content */}
        {renderMedia()}

        {/* Text content */}
        {content && (
          <p className={`text-[15px] leading-relaxed whitespace-pre-wrap break-words ${hasMedia ? 'px-2.5 pt-1.5 pb-0.5' : ''}`}>
            {content}
          </p>
        )}

        {/* Timestamp and status */}
        <div
          className={`flex items-center gap-1 mt-0.5 ${hasMedia ? 'px-2.5 pb-1' : ''} ${
            isOwn ? 'justify-end' : 'justify-start'
          }`}
        >
          <span
            className={`text-[11px] ${
              isOwn
                ? 'text-primary-200'
                : 'text-surface-400 dark:text-surface-500'
            }`}
          >
            {formatMessageTime(createdAt)}
          </span>
          
          {isOwn && <StatusIcon />}
        </div>

        {/* Error state: show failed label with retry/dismiss */}
        {isOwn && status === 'error' && (
          <div className={`flex items-center gap-2 mt-1 justify-end ${hasMedia ? 'px-2.5' : ''}`}>
            <span className="text-[11px] text-red-400">Failed to send</span>
            {onRetry && (
              <button
                onClick={() => onRetry(message)}
                className="text-[11px] text-primary-400 hover:text-primary-300 underline cursor-pointer"
              >
                Retry
              </button>
            )}
            <button
              onClick={() => useMessageStore.getState().removeMessage(message.conversationId, message.id)}
              className="text-[11px] text-surface-400 hover:text-surface-300 underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
