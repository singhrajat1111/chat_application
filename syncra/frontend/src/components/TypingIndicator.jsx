import { getInitials, getAvatarColor } from '../utils/format';

const TypingIndicator = ({ username }) => {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="flex items-end gap-2">
        {/* Avatar */}
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-medium ${getAvatarColor(
            username
          )}`}
        >
          {getInitials(username)}
        </div>

        {/* Typing dots */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-1">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
