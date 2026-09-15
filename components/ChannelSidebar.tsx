import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Hash,
  Volume2,
  Megaphone,
  Plus,
  Settings,
  UserPlus,
  Bell,
  LogOut,
  PhoneOff,
  Radio,
  Share2,
  Video
} from 'lucide-react';
import { Server, Channel, User, UserStatus, VoiceChannelState } from '../types';
import { UserProfileFooter } from './UserProfileFooter';

interface ChannelSidebarProps {
  server: Server;
  activeChannelId: string;
  onSelectChannel: (channel: Channel) => void;
  onOpenCreateChannel: (categoryId?: string) => void;
  voiceState: VoiceChannelState;
  onJoinVoiceChannel: (channel: Channel) => void;
  onDisconnectVoice: () => void;
  currentUser: User;
  onOpenSettings: () => void;
  onUpdateStatus: (status: UserStatus) => void;
  onOpenProfile: () => void;
  onLogout?: () => void;
}

export const ChannelSidebar: React.FC<ChannelSidebarProps> = ({
  server,
  activeChannelId,
  onSelectChannel,
  onOpenCreateChannel,
  voiceState,
  onJoinVoiceChannel,
  onDisconnectVoice,
  currentUser,
  onOpenSettings,
  onUpdateStatus,
  onOpenProfile,
  onLogout
}) => {
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [showServerMenu, setShowServerMenu] = useState(false);
  const serverMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (serverMenuRef.current && !serverMenuRef.current.contains(e.target as Node)) {
        setShowServerMenu(false);
      }
    };
    if (showServerMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showServerMenu]);

  const toggleCategory = (catId: string) => {
    setCollapsedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const getChannelIcon = (type: Channel['type']) => {
    switch (type) {
      case 'voice':
        return <Volume2 size={18} className="shrink-0 text-[#949ba4]" />;
      case 'announcement':
        return <Megaphone size={18} className="shrink-0 text-[#949ba4]" />;
      case 'text':
      default:
        return <Hash size={18} className="shrink-0 text-[#949ba4]" />;
    }
  };

  return (
    <div
      id="channel-sidebar"
      className="w-60 bg-[#2b2d31] flex flex-col h-full shrink-0 select-none relative border-r border-[#1f2023]/40"
    >
      {/* Server Header */}
      <div className="relative" ref={serverMenuRef}>
        <button
          id="btn-server-header-menu"
          onClick={() => setShowServerMenu(!showServerMenu)}
          className="w-full h-12 px-4 flex items-center justify-between font-bold text-[15px] text-[#f2f3f5] border-b border-[#1f2023] hover:bg-[#35373c]/60 transition-colors shadow-sm"
        >
          <span className="truncate">{server.name}</span>
          <ChevronDown
            size={18}
            className={`text-[#b5bac1] transition-transform duration-200 ${
              showServerMenu ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* Server Dropdown Menu */}
        {showServerMenu && (
          <div className="absolute top-[52px] left-2 right-2 bg-[#111214] border border-[#232428] rounded-lg shadow-2xl p-1.5 z-50 flex flex-col gap-0.5">
            <button
              onClick={() => { onOpenCreateChannel(); setShowServerMenu(false); }}
              className="flex items-center justify-between px-2.5 py-1.5 rounded text-sm text-[#5865F2] hover:bg-[#5865F2] hover:text-white transition-colors"
            >
              <span>Create Channel</span>
              <Plus size={16} />
            </button>
            <button
              onClick={() => { alert(`Invite link copied to clipboard: https://nuggets.chat/invite/${server.id}`); setShowServerMenu(false); }}
              className="flex items-center justify-between px-2.5 py-1.5 rounded text-sm text-[#dbdee1] hover:bg-[#35373c] transition-colors"
            >
              <span>Invite People</span>
              <UserPlus size={16} />
            </button>
            <button
              onClick={() => { onOpenSettings(); setShowServerMenu(false); }}
              className="flex items-center justify-between px-2.5 py-1.5 rounded text-sm text-[#dbdee1] hover:bg-[#35373c] transition-colors"
            >
              <span>Server Settings</span>
              <Settings size={16} />
            </button>
            <div className="h-[1px] bg-[#232428] my-1" />
            <button
              onClick={() => { alert("Notification settings saved!"); setShowServerMenu(false); }}
              className="flex items-center justify-between px-2.5 py-1.5 rounded text-sm text-[#dbdee1] hover:bg-[#35373c] transition-colors"
            >
              <span>Notification Settings</span>
              <Bell size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 [scrollbar-width:thin]">
        {server.categories.map((category) => {
          const isCollapsed = collapsedCategories[category.id];
          const categoryChannels = server.channels.filter(c => c.categoryId === category.id);

          return (
            <div key={category.id} className="space-y-0.5">
              {/* Category Header */}
              <div className="flex items-center justify-between px-1 py-1 text-[12px] font-bold text-[#949ba4] tracking-wider uppercase group">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex items-center gap-1 hover:text-[#dbdee1] transition-colors"
                >
                  <ChevronDown
                    size={12}
                    className={`transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                  />
                  <span>{category.name}</span>
                </button>
                <button
                  onClick={() => onOpenCreateChannel(category.id)}
                  aria-label={`Add channel in ${category.name}`}
                  className="opacity-0 group-hover:opacity-100 hover:text-[#dbdee1] transition-opacity p-0.5"
                  title="Create Channel"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Channels in Category */}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {categoryChannels.map((channel) => {
                    const isVoice = channel.type === 'voice';
                    const isActiveText = activeChannelId === channel.id;
                    const isConnectedVoice = isVoice && voiceState.connected && voiceState.channelId === channel.id;

                    return (
                      <div key={channel.id}>
                        <button
                          id={`channel-${channel.id}`}
                          onClick={() => {
                            if (isVoice) {
                              onJoinVoiceChannel(channel);
                            } else {
                              onSelectChannel(channel);
                            }
                          }}
                          className={`w-full px-2 py-1.5 rounded-[4px] flex items-center gap-2 group text-left transition-colors ${
                            isActiveText && !isVoice
                              ? 'bg-[#404249] text-white font-medium'
                              : isConnectedVoice
                              ? 'bg-[#23a55a]/15 text-[#23a55a] font-medium'
                              : 'text-[#949ba4] hover:bg-[#35373c]/50 hover:text-[#dbdee1]'
                          }`}
                        >
                          <span className={isConnectedVoice ? 'text-[#23a55a]' : ''}>
                            {getChannelIcon(channel.type)}
                          </span>
                          <span className="text-[14px] truncate flex-1">
                            {channel.name}
                          </span>

                          {isVoice && (
                            <span className="text-[11px] px-1.5 py-0.2 rounded bg-[#1e1f22] text-[#949ba4]">
                              {isConnectedVoice ? 'Connected' : 'Voice'}
                            </span>
                          )}
                        </button>

                        {/* Connected users under voice channel */}
                        {isVoice && isConnectedVoice && (
                          <div className="ml-6 my-1 pl-2 border-l border-[#23a55a]/30 space-y-1">
                            <div className="flex items-center gap-2 text-xs text-[#dbdee1] py-0.5">
                              <div className="relative">
                                <img
                                  src={currentUser.avatar}
                                  alt={currentUser.name}
                                  className="w-5 h-5 rounded-full object-cover ring-2 ring-[#23a55a]"
                                />
                              </div>
                              <span className="truncate">{currentUser.name}</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-[#23a55a] animate-ping" />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[#949ba4] py-0.5">
                              <img
                                src={server.members[1]?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'}
                                alt="Sarah"
                                className="w-5 h-5 rounded-full object-cover"
                              />
                              <span className="truncate">Sarah Connor</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Voice Connection Bar (if connected) */}
      {voiceState.connected && (
        <div
          id="active-voice-bar"
          className="bg-[#111214] border-t border-[#1f2023] px-3 py-2 flex flex-col gap-1.5 shrink-0"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full bg-[#23a55a] animate-pulse" />
              <div className="flex flex-col min-w-0">
                <span className="text-[12px] font-bold text-[#23a55a] leading-tight">
                  Voice Connected
                </span>
                <span className="text-[11px] text-[#949ba4] truncate leading-tight">
                  {voiceState.channelName || 'General Voice'} / {voiceState.serverName || server.name}
                </span>
              </div>
            </div>

            <button
              onClick={onDisconnectVoice}
              aria-label="Disconnect from voice channel"
              className="p-1.5 text-[#f23f43] hover:bg-[#f23f43]/10 rounded-md transition-colors"
              title="Disconnect"
            >
              <PhoneOff size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#949ba4] pt-1 border-t border-[#232428]">
            <span className="flex items-center gap-1">
              <Radio size={12} className="text-[#23a55a]" /> RTC 18ms
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => alert("Simulated screen sharing active!")}
                className="hover:text-white transition-colors"
                title="Share Screen"
              >
                <Share2 size={13} />
              </button>
              <button
                onClick={() => alert("Camera toggled!")}
                className="hover:text-white transition-colors"
                title="Camera"
              >
                <Video size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

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
