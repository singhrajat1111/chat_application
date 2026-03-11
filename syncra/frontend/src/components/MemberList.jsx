import { useServerStore } from '../store/serverStore';
import { useOnlineStore } from '../store/onlineStore';
import { getInitials, getAvatarColor } from '../utils/format';

const ROLE_ORDER = ['owner', 'admin', 'moderator', 'member'];
const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  moderator: 'Moderator',
  member: 'Members',
};

const MemberList = () => {
  const { members } = useServerStore();
  const { isUserOnline } = useOnlineStore();

  // Group by role
  const grouped = ROLE_ORDER.reduce((acc, role) => {
    const roleMembers = members.filter(m => (m.serverRole || m.server_role) === role);
    if (roleMembers.length > 0) acc.push({ role, label: ROLE_LABELS[role], members: roleMembers });
    return acc;
  }, []);

  return (
    <div className="w-60 h-full bg-surface-50 dark:bg-surface-900 border-l border-surface-200 dark:border-surface-700/40 flex flex-col flex-shrink-0">
      <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700/40">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
          Members — {members.length}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {grouped.map(({ role, label, members: roleMembers }) => (
          <div key={role} className="mb-3">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-surface-500 dark:text-surface-400">
              {label} — {roleMembers.length}
            </p>
            <div className="space-y-0.5">
              {roleMembers.map((member) => {
                const online = isUserOnline(member.userId || member.user_id);
                const username = member.username;
                return (
                  <div
                    key={member.userId || member.user_id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors cursor-default"
                  >
                    <div className="relative">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${getAvatarColor(username)} ${!online ? 'opacity-50' : ''}`}>
                        {getInitials(username)}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-50 dark:border-surface-900 ${online ? 'bg-accent-400' : 'bg-surface-400'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm truncate ${online ? 'text-surface-900 dark:text-white' : 'text-surface-500 dark:text-surface-500'}`}>
                        {username}
                      </p>
                      {role !== 'member' && (
                        <p className="text-xs text-primary-500">{ROLE_LABELS[role]}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MemberList;
