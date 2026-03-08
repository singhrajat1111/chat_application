import { formatMessageTime } from '../utils/format';

const MessageBubble = ({ message, isOwn, isFirstInGroup, isLastInGroup }) => {
  const { content, createdAt, status } = message;

  // Status icon
  const StatusIcon = () => {
    if (status === 'sending' || status === 'sent') {
      return (
        <svg className="w-3.5 h-3.5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (status === 'delivered') {
      return (
        <svg className="w-3.5 h-3.5 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (status === 'seen') {
      return (
        <svg className="w-3.5 h-3.5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (status === 'error') {
      return (
        <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-message-in`}
      style={{
        marginTop: isFirstInGroup ? '0.75rem' : '0.125rem',
      }}
    >
      <div
        className={`relative max-w-[75%] sm:max-w-[65%] px-4 py-2.5 ${
          isOwn
            ? 'bg-primary-600 text-white rounded-message-sent'
            : 'bg-white dark:bg-surface-800 text-surface-900 dark:text-surface-100 rounded-message-received shadow-sm dark:shadow-none'
        } ${isLastInGroup ? 'pb-2' : ''}`}
      >
        {/* Message content */}
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {content}
        </p>

        {/* Timestamp and status */}
        <div
          className={`flex items-center gap-1.5 mt-1 ${
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
      </div>
    </div>
  );
};

export default MessageBubble;
