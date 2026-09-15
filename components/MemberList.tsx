import React from 'react';
import { User, UserStatus } from '../types';

interface MemberListProps {
  members: User[];
  onSelectMember: (member: User) => void;
}

export const MemberList: React.FC<MemberListProps> = ({ members, onSelectMember }) => {
  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'online': return 'bg-[#23a55a]';
      case 'idle': return 'bg-[#f0b232]';
      case 'dnd': return 'bg-[#f23f43]';
      case 'offline': return 'bg-[#80848e]';
    }
  };

  // Group members
  const owner = members.filter(m => m.role === 'Owner');
  const admins = members.filter(m => m.role === 'Admin');
  const bots = members.filter(m => m.isBot);
  const onlineMembers = members.filter(m => m.role !== 'Owner' && m.role !== 'Admin' && !m.isBot && m.status !== 'offline');
  const offlineMembers = members.filter(m => m.status === 'offline' && !m.isBot && m.role !== 'Owner');

  const renderGroup = (title: string, groupMembers: User[]) => {
    if (groupMembers.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="px-2 mb-1 text-[11px] font-bold text-[#949ba4] tracking-wider uppercase">
          {title} — {groupMembers.length}
        </div>
        <div className="space-y-0.5">
          {groupMembers.map((member) => (
            <button
              key={member.id}
              id={`member-${member.id}`}
              onClick={() => onSelectMember(member)}
              className="w-full px-2 py-1.5 rounded-[4px] flex items-center gap-3 hover:bg-[#35373c]/50 text-left transition-colors group"
            >
              <div className="relative shrink-0">
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-8 h-8 rounded-full object-cover"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#2b2d31] ${getStatusColor(
                    member.status
                  )}`}
                />
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[14px] font-medium truncate"
                    style={{ color: member.roleColor || '#dbdee1' }}
                  >
                    {member.name}
                  </span>
                  {member.isBot && (
                    <span className="px-1 py-0.2 bg-[#5865F2] text-white text-[9px] font-bold rounded">
                      BOT
                    </span>
                  )}
                </div>

                {member.activity ? (
                  <span className="text-[11px] text-[#949ba4] truncate">
                    {member.activity.type === 'playing' ? 'Playing ' : member.activity.type === 'listening' ? 'Listening to ' : ''}
                    {member.activity.name}
                  </span>
                ) : member.customStatus ? (
                  <span className="text-[11px] text-[#949ba4] truncate">
                    {member.customStatus}
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <aside
      id="member-sidebar"
      aria-label="Server members"
      className="w-60 bg-[#2b2d31] flex flex-col h-full shrink-0 select-none border-l border-[#1f2023]/40 overflow-y-auto p-3 [scrollbar-width:thin]"
    >
      {renderGroup('Server Owner', owner)}
      {renderGroup('Admins', admins)}
      {renderGroup('Bots', bots)}
      {renderGroup('Online', onlineMembers)}
      {renderGroup('Offline', offlineMembers)}
    </aside>
  );
};
