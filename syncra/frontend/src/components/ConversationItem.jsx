import { formatConversationTime, truncateText, getInitials, getAvatarColor } from '../utils/format';

const ConversationItem = ({ conversation, isActive, onClick, isOnline }) => {
  const { otherUser, lastMessage, unreadCount } = conversation;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${
        isActive
          ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200/50 dark:border-primary-700/30'
          : 'hover:bg-surface-100 dark:hover:bg-surface-800/50'
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium ${getAvatarColor(
            otherUser?.username
          )}`}
        >
          {getInitials(otherUser?.username)}
        </div>
        {isOnline && <span className="online-indicator" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4
            className={`font-medium truncate ${
              isActive
                ? 'text-primary-900 dark:text-primary-100'
                : 'text-surface-900 dark:text-white'
            }`}
          >
            {otherUser?.username}
          </h4>
          {lastMessage && (
            <span className="text-xs text-surface-400 dark:text-surface-500 flex-shrink-0">
              {formatConversationTime(lastMessage.createdAt)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p
            className={`text-sm truncate ${
              unreadCount > 0
                ? 'text-surface-700 dark:text-surface-300 font-medium'
                : 'text-surface-500 dark:text-surface-400'
            }`}
          >
            {lastMessage ? (
              <>
                <span className="text-surface-400 dark:text-surface-500">
                  {lastMessage.senderId === otherUser?.id ? '' : 'You: '}
                </span>
                {lastMessage.messageType === 'image'
                  ? '📷 Photo'
                  : lastMessage.messageType === 'video'
                  ? '🎥 Video'
                  : lastMessage.messageType === 'document'
                  ? '📄 Document'
                  : truncateText(lastMessage.content, 30)}
              </>
            ) : (
              <span className="text-surface-400 dark:text-surface-500 italic">
                No messages yet
              </span>
            )}
          </p>

          {unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-gradient-to-r from-primary-600 to-primary-500 text-white text-xs font-medium rounded-full flex items-center justify-center shadow-sm shadow-primary-600/20">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

export default ConversationItem;
