import React from 'react';
import { Users, Plus, X } from 'lucide-react';
import { DirectMessageConversation, User, UserStatus } from '../types';
import { UserProfileFooter } from './UserProfileFooter';

interface DirectMessagesSidebarProps {
  conversations: DirectMessageConversation[];
  activeDmId: string | null;
  onSelectDm: (dmId: string) => void;
  onCloseDm: (dmId: string) => void;
  onSelectFriendsTab: () => void;
  isFriendsTabActive: boolean;
  currentUser: User;
  onOpenSettings: () => void;
  onUpdateStatus: (status: UserStatus) => void;
  onOpenProfile: () => void;
  onlineFriendsCount: number;
  onLogout?: () => void;
}

export const DirectMessagesSidebar: React.FC<DirectMessagesSidebarProps> = ({
  conversations = [],
  activeDmId,
  onSelectDm,
  onCloseDm,
  onSelectFriendsTab,
  isFriendsTabActive,
  currentUser,
  onOpenSettings,
  onUpdateStatus,
  onOpenProfile,
  onlineFriendsCount,
  onLogout
}) => {
  const safeConversations = Array.isArray(conversations) ? conversations : [];

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
      id="dm-sidebar"
      className="w-60 bg-[#2b2d31] flex flex-col h-full shrink-0 select-none relative border-r border-[#1f2023]/40"
    >
      {/* Search Header */}
      <div className="h-12 px-3 flex items-center border-b border-[#1f2023] shadow-sm">
        <button
          onClick={onSelectFriendsTab}
          className="w-full h-7 px-2 bg-[#1e1f22] text-[#949ba4] text-[13px] rounded flex items-center justify-between hover:text-[#dbdee1] transition-colors"
        >
          <span>Encontrar ou iniciar conversa</span>
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-3 [scrollbar-width:thin]">
        {/* Friends Item */}
        <button
          id="btn-nav-friends"
          onClick={onSelectFriendsTab}
          className={`w-full px-3 py-2.5 rounded-[4px] flex items-center justify-between text-left transition-colors ${
            isFriendsTabActive
              ? 'bg-[#404249] text-white font-medium'
              : 'text-[#949ba4] hover:bg-[#35373c]/60 hover:text-[#dbdee1]'
          }`}
        >
          <div className="flex items-center gap-3">
            <Users size={20} className={isFriendsTabActive ? 'text-white' : 'text-[#b5bac1]'} />
            <span className="text-[14px]">Amigos</span>
          </div>
          {onlineFriendsCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#35373c] text-[#dbdee1]">
              {onlineFriendsCount}
            </span>
          )}
        </button>

        {/* Direct Messages Header */}
        <div className="pt-2">
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider group">
            <span>Mensagens Diretas</span>
            <button
              onClick={onSelectFriendsTab}
              aria-label="Nova conversa"
              className="hover:text-[#dbdee1] transition-colors"
              title="Nova conversa"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* DM Conversation List */}
          <div className="mt-1 space-y-0.5">
            {safeConversations.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-[#80848e]">
                Nenhuma conversa ainda
              </div>
            ) : (
              safeConversations.map((dm) => {
                const isActive = !isFriendsTabActive && activeDmId === dm.id;
                const { recipient } = dm;

                return (
                  <div key={dm.id} className="relative group">
                    <button
                      id={`dm-${dm.id}`}
                      onClick={() => onSelectDm(dm.id)}
                      className={`w-full px-2 py-2 rounded-[4px] flex items-center gap-3 text-left transition-colors ${
                        isActive
                          ? 'bg-[#404249] text-white'
                          : 'text-[#949ba4] hover:bg-[#35373c]/60 hover:text-[#dbdee1]'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <img
                          src={recipient.avatar}
                          alt={recipient.name}
                          className="w-8 h-8 rounded-full object-cover bg-[#1e1f22]"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[#2b2d31] ${getStatusColor(
                            recipient.status
                          )}`}
                        />
                      </div>

                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[14px] font-medium truncate text-[#f2f3f5]">
                            {recipient.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#949ba4] truncate">
                          {recipient.customStatus || `@${recipient.username}`}
                        </span>
                      </div>

                      {dm.unreadCount > 0 && (
                        <span className="w-2 h-2 rounded-full bg-[#f23f43] shrink-0" />
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseDm(dm.id);
                      }}
                      aria-label={`Fechar conversa com ${recipient.name}`}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-[#949ba4] hover:text-white transition-opacity"
                      title="Fechar conversa"
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* User Profile Footer */}
      <UserProfileFooter
        currentUser={currentUser}
        onOpenSettings={onOpenSettings}
        onUpdateStatus={onUpdateStatus}
        onOpenProfile={onOpenProfile}
        onLogout={onLogout}
      />
    </div>
  );
};
