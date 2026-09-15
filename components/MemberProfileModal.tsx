import React from 'react';
import { X, MessageSquare, Calendar, Shield, Sparkles } from 'lucide-react';
import { User, UserStatus } from '../types';

interface MemberProfileModalProps {
  member: User;
  onClose: () => void;
  onSendMessage: (user: User) => void;
}

export const MemberProfileModal: React.FC<MemberProfileModalProps> = ({
  member,
  onClose,
  onSendMessage
}) => {
  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'online': return 'bg-[#23a55a]';
      case 'idle': return 'bg-[#f0b232]';
      case 'dnd': return 'bg-[#f23f43]';
      case 'offline': return 'bg-[#80848e]';
    }
  };

  return (
    <div
      id="member-profile-modal"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div className="w-full max-w-sm bg-[#232428] rounded-2xl shadow-2xl overflow-hidden border border-[#313338] relative">
        {/* Banner */}
        <div
          className="h-28 w-full relative"
          style={{
            background: member.roleColor
              ? `linear-gradient(135deg, ${member.roleColor}99, #1e1f22)`
              : 'linear-gradient(135deg, #5865F2, #1e1f22)'
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Avatar & Badges */}
        <div className="px-5 pb-5 relative">
          <div className="flex justify-between items-end -mt-12 mb-3">
            <div className="relative">
              <img
                src={member.avatar}
                alt={member.name}
                className="w-20 h-20 rounded-full object-cover ring-8 ring-[#232428] shadow-lg"
              />
              <span
                className={`absolute bottom-0 right-0 w-5 h-5 rounded-full ring-4 ring-[#232428] ${getStatusColor(
                  member.status
                )}`}
              />
            </div>

            <button
              onClick={() => {
                onSendMessage(member);
                onClose();
              }}
              className="px-4 py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors shadow"
            >
              <MessageSquare size={14} />
              <span>Message</span>
            </button>
          </div>

          {/* User Names */}
          <div className="bg-[#111214] rounded-xl p-4 space-y-3">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-lg font-bold text-white">{member.name}</h3>
                {member.isBot && (
                  <span className="px-1.5 py-0.5 bg-[#5865F2] text-white text-[10px] font-bold rounded">
                    BOT
                  </span>
                )}
              </div>
              <p className="text-xs text-[#949ba4]">@{member.username}</p>
            </div>

            {member.customStatus && (
              <div className="text-xs text-[#dbdee1] border-t border-[#1e1f22] pt-2">
                {member.customStatus}
              </div>
            )}

            {/* About Me */}
            {member.aboutMe && (
              <div className="space-y-1 border-t border-[#1e1f22] pt-2">
                <div className="text-[10px] font-bold text-[#b5bac1] uppercase">About Me</div>
                <p className="text-xs text-[#dbdee1] leading-relaxed">{member.aboutMe}</p>
              </div>
            )}

            {/* Activity */}
            {member.activity && (
              <div className="space-y-1 border-t border-[#1e1f22] pt-2">
                <div className="text-[10px] font-bold text-[#b5bac1] uppercase">Activity</div>
                <div className="text-xs text-[#23a55a] font-medium flex items-center gap-1.5">
                  <Sparkles size={14} />
                  <span>
                    {member.activity.type === 'playing' ? 'Playing ' : member.activity.type === 'listening' ? 'Listening to ' : ''}
                    {member.activity.name}
                  </span>
                </div>
                {member.activity.details && (
                  <div className="text-[11px] text-[#949ba4]">{member.activity.details}</div>
                )}
              </div>
            )}

            {/* Roles */}
            <div className="space-y-1 border-t border-[#1e1f22] pt-2">
              <div className="text-[10px] font-bold text-[#b5bac1] uppercase">Roles</div>
              <div className="flex flex-wrap gap-1.5">
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1"
                  style={{
                    backgroundColor: `${member.roleColor || '#5865F2'}20`,
                    color: member.roleColor || '#5865F2',
                    border: `1px solid ${member.roleColor || '#5865F2'}50`
                  }}
                >
                  <Shield size={12} />
                  <span>{member.role}</span>
                </span>
              </div>
            </div>

            {/* Member Since */}
            <div className="text-[11px] text-[#949ba4] flex items-center gap-1 border-t border-[#1e1f22] pt-2">
              <Calendar size={12} />
              <span>Member since {member.joinedAt || 'March 2026'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
