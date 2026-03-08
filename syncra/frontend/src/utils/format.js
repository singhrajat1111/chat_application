import { format, isToday, isYesterday, isThisWeek, isThisYear } from 'date-fns';

// Format message timestamp
export const formatMessageTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return format(d, 'h:mm a');
};

// Format conversation list timestamp
export const formatConversationTime = (date) => {
  if (!date) return '';
  const d = new Date(date);

  if (isToday(d)) {
    return format(d, 'h:mm a');
  }

  if (isYesterday(d)) {
    return 'Yesterday';
  }

  if (isThisWeek(d)) {
    return format(d, 'EEE');
  }

  if (isThisYear(d)) {
    return format(d, 'MMM d');
  }

  return format(d, 'MM/dd/yy');
};

// Format full date
export const formatFullDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return format(d, 'MMM d, yyyy h:mm a');
};

// Truncate text
export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

// Get initials from username
export const getInitials = (username) => {
  if (!username) return '?';
  return username
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

// Generate avatar color based on username
export const getAvatarColor = (username) => {
  if (!username) return 'bg-surface-400';
  
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
  ];

  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
};
