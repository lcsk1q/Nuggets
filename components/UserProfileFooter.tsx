import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Headphones, Settings, Circle, Check, LogOut } from 'lucide-react';
import { User, UserStatus } from '../types';

interface UserProfileFooterProps {
  currentUser: User;
  onOpenSettings: () => void;
  onUpdateStatus: (status: UserStatus) => void;
  onOpenProfile: () => void;
  onLogout?: () => void;
}

export const UserProfileFooter: React.FC<UserProfileFooterProps> = ({
  currentUser,
  onOpenSettings,
  onUpdateStatus,
  onOpenProfile,
  onLogout
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  // Close status menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    if (showStatusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStatusMenu]);

  const toggleMute = () => setIsMuted(prev => !prev);
  const toggleDeafen = () => {
    setIsDeafened(prev => {
      const next = !prev;
      if (next) setIsMuted(true);
      return next;
    });
  };

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
      id="user-profile-footer"
      className="h-[52px] bg-[#232428] px-2 flex items-center justify-between shrink-0 select-none relative"
    >
      {/* User Info (Clickable for Status Picker & Profile) */}
      <div className="relative" ref={statusMenuRef}>
        <button
          id="btn-user-status-menu"
          onClick={() => setShowStatusMenu(!showStatusMenu)}
          className="flex items-center gap-2 p-1 -ml-1 rounded-md hover:bg-[#35373c] transition-colors text-left group"
        >
          <div className="relative">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-8 h-8 rounded-full object-cover bg-[#1e1f22]"
            />
            {/* Status dot */}
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-[#232428] ${getStatusColor(
                currentUser.status
              )}`}
            />
          </div>
          <div className="flex flex-col min-w-0 max-w-[90px]">
            <span className="text-[13px] font-semibold text-[#f2f3f5] truncate leading-tight group-hover:underline">
              {currentUser.name}
            </span>
            <span className="text-[11px] text-[#949ba4] truncate leading-tight">
              #{currentUser.username}
            </span>
          </div>
        </button>

        {/* Status Dropdown Menu */}
        {showStatusMenu && (
          <div className="absolute bottom-[56px] left-0 w-52 bg-[#111214] border border-[#232428] rounded-lg shadow-2xl p-1.5 z-50 flex flex-col gap-0.5">
            <div className="px-2 py-1 text-[11px] font-bold text-[#949ba4] uppercase tracking-wider">
              Definir Status
            </div>

            <button
              onClick={() => { onUpdateStatus('online'); setShowStatusMenu(false); }}
              className="flex items-center justify-between px-2.5 py-1.5 rounded text-sm text-[#dbdee1] hover:bg-[#5865F2] hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#23a55a]" />
                <span>Disponível</span>
              </div>
              {currentUser.status === 'online' && <Check size={14} />}
            </button>

            <button
              onClick={() => { onUpdateStatus('idle'); setShowStatusMenu(false); }}
              className="flex items-center justify-between px-2.5 py-1.5 rounded text-sm text-[#dbdee1] hover:bg-[#5865F2] hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f0b232]" />
                <span>Ausente</span>
              </div>
              {currentUser.status === 'idle' && <Check size={14} />}
            </button>

            <button
              onClick={() => { onUpdateStatus('dnd'); setShowStatusMenu(false); }}
              className="flex items-center justify-between px-2.5 py-1.5 rounded text-sm text-[#dbdee1] hover:bg-[#5865F2] hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f23f43]" />
                <span>Não perturbe</span>
              </div>
              {currentUser.status === 'dnd' && <Check size={14} />}
            </button>

            <button
              onClick={() => { onUpdateStatus('offline'); setShowStatusMenu(false); }}
              className="flex items-center justify-between px-2.5 py-1.5 rounded text-sm text-[#dbdee1] hover:bg-[#5865F2] hover:text-white transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#80848e]" />
                <span>Invisível</span>
              </div>
              {currentUser.status === 'offline' && <Check size={14} />}
            </button>

            <div className="h-[1px] bg-[#232428] my-1" />

            <button
              onClick={() => { onOpenProfile(); setShowStatusMenu(false); }}
              className="px-2.5 py-1.5 text-left rounded text-xs text-[#949ba4] hover:text-white hover:bg-[#35373c]"
            >
              Editar Perfil
            </button>

            {onLogout && (
              <button
                id="btn-status-logout"
                onClick={() => { setShowStatusMenu(false); onLogout(); }}
                className="flex items-center gap-2 px-2.5 py-1.5 text-left rounded text-xs text-[#f23f43] hover:bg-[#f23f43]/15 transition-colors font-medium"
              >
                <LogOut size={14} />
                <span>Sair da conta</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center">
        {/* Mic Toggle */}
        <button
          id="btn-toggle-mic"
          onClick={toggleMute}
          aria-label={isMuted ? 'Desmutar microfone' : 'Mutar microfone'}
          className={`w-8 h-8 flex items-center justify-center rounded hover:bg-[#35373c] transition-colors ${
            isMuted ? 'text-[#f23f43]' : 'text-[#b5bac1] hover:text-[#dbdee1]'
          }`}
          title={isMuted ? 'Desmutar' : 'Mutar'}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* Deafen Toggle */}
        <button
          id="btn-toggle-deafen"
          onClick={toggleDeafen}
          aria-label={isDeafened ? 'Ativar áudio' : 'Desativar áudio'}
          className={`w-8 h-8 flex items-center justify-center rounded hover:bg-[#35373c] transition-colors ${
            isDeafened ? 'text-[#f23f43]' : 'text-[#b5bac1] hover:text-[#dbdee1]'
          }`}
          title={isDeafened ? 'Ativar som' : 'Desativar som'}
        >
          <Headphones size={18} />
        </button>

        {/* Settings Button */}
        <button
          id="btn-user-settings"
          onClick={onOpenSettings}
          aria-label="Configurações de Usuário"
          className="w-8 h-8 flex items-center justify-center rounded text-[#b5bac1] hover:text-[#dbdee1] hover:bg-[#35373c] transition-colors"
          title="Configurações"
        >
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
};
