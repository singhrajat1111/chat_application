import { getInitials, getAvatarColor } from '../utils/format';

const UserSearchItem = ({ user, onClick, isOnline }) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-800/50 transition-all duration-200 text-left"
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium ${getAvatarColor(
            user.username
          )}`}
        >
          {getInitials(user.username)}
        </div>
        {isOnline && <span className="online-indicator" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-surface-900 dark:text-white truncate">
          {user.username}
        </h4>
        <p className="text-sm text-surface-500 dark:text-surface-400 truncate">
          {user.email}
        </p>
      </div>

      {/* Action icon */}
      <div className="flex-shrink-0 text-surface-400 dark:text-surface-500">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </div>
    </button>
  );
};

export default UserSearchItem;
