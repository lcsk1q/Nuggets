import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Server } from '../types';

interface ServerSidebarProps {
  servers: Server[];
  activeServerId: string | null; // null means DMs view
  onSelectServer: (serverId: string | null) => void;
  onOpenCreateServer: () => void;
  unreadDmCount: number;
}

export const ServerSidebar: React.FC<ServerSidebarProps> = ({
  servers = [],
  activeServerId,
  onSelectServer,
  onOpenCreateServer,
  unreadDmCount
}) => {
  const safeServers = Array.isArray(servers) ? servers : [];
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <nav
      id="server-sidebar"
      aria-label="Navegação de servidores"
      className="w-[72px] bg-[#1e1f22] flex flex-col items-center py-3 gap-2 shrink-0 z-20 select-none h-full"
    >
      {/* Direct Messages / Home Button */}
      <div className="relative group flex items-center justify-center w-full">
        {/* Left Indicator Pill */}
        <div
          className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 ${
            activeServerId === null
              ? 'h-10'
              : hoveredId === 'home'
              ? 'h-5'
              : 'h-0'
          }`}
        />

        <button
          id="btn-nav-dms"
          onClick={() => onSelectServer(null)}
          onMouseEnter={() => setHoveredId('home')}
          onMouseLeave={() => setHoveredId(null)}
          aria-label="Mensagens Diretas"
          className={`relative w-12 h-12 flex items-center justify-center transition-all duration-200 ${
            activeServerId === null
              ? 'rounded-[16px] bg-[#5865F2] text-white shadow-lg'
              : 'rounded-[24px] bg-[#313338] text-[#dbdee1] hover:rounded-[16px] hover:bg-[#5865F2] hover:text-white'
          }`}
        >
          {/* Nuggets Logo Badge */}
          <span className="text-2xl" role="img" aria-label="Logo Nuggets">🍗</span>

          {unreadDmCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#f23f43] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full ring-4 ring-[#1e1f22]">
              {unreadDmCount}
            </span>
          )}
        </button>

        {/* Tooltip */}
        <div className="absolute left-[80px] hidden group-hover:flex items-center z-50 pointer-events-none">
          <div className="bg-[#111214] text-[#dbdee1] text-xs font-semibold px-3 py-1.5 rounded-md shadow-xl whitespace-nowrap border border-[#232428]">
            Mensagens Diretas
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="w-8 h-[2px] bg-[#35363c] rounded-full my-1" />

      {/* Server List */}
      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center gap-2 [scrollbar-width:none]">
        {safeServers.map((server) => {
          const isActive = activeServerId === server.id;
          const isHovered = hoveredId === server.id;

          return (
            <div key={server.id} className="relative group flex items-center justify-center w-full">
              {/* Left Indicator Pill */}
              <div
                className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 ${
                  isActive ? 'h-10' : isHovered ? 'h-5' : 'h-0'
                }`}
              />

              <button
                id={`btn-server-${server.id}`}
                onClick={() => onSelectServer(server.id)}
                onMouseEnter={() => setHoveredId(server.id)}
                onMouseLeave={() => setHoveredId(null)}
                aria-label={server.name}
                className={`relative w-12 h-12 flex items-center justify-center font-bold text-sm text-white transition-all duration-200 overflow-hidden ${
                  isActive
                    ? `rounded-[16px] ${server.iconBg || 'bg-[#5865F2]'} ring-2 ring-white/20 shadow-md`
                    : `rounded-[24px] ${server.iconBg || 'bg-[#313338]'} hover:rounded-[16px] hover:shadow-lg opacity-90 hover:opacity-100`
                }`}
              >
                {server.icon ? (
                  <img src={server.icon} alt={server.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{server.initials || server.name.slice(0, 2).toUpperCase()}</span>
                )}
              </button>

              {/* Server Name Tooltip */}
              <div className="absolute left-[80px] hidden group-hover:flex items-center z-50 pointer-events-none">
                <div className="bg-[#111214] text-[#dbdee1] text-xs font-semibold px-3 py-1.5 rounded-md shadow-xl whitespace-nowrap border border-[#232428]">
                  {server.name}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add / Join Server Button */}
        <div className="relative group flex items-center justify-center w-full mt-1">
          <div
            className={`absolute left-0 w-1 bg-white rounded-r-full transition-all duration-200 ${
              hoveredId === 'add' ? 'h-5' : 'h-0'
            }`}
          />
          <button
            id="btn-add-server"
            onClick={onOpenCreateServer}
            onMouseEnter={() => setHoveredId('add')}
            onMouseLeave={() => setHoveredId(null)}
            aria-label="Adicionar Servidor"
            className="w-12 h-12 rounded-[24px] bg-[#313338] text-[#23a55a] hover:bg-[#23a55a] hover:text-white hover:rounded-[16px] flex items-center justify-center transition-all duration-200 group"
          >
            <Plus size={22} />
          </button>

          <div className="absolute left-[80px] hidden group-hover:flex items-center z-50 pointer-events-none">
            <div className="bg-[#111214] text-[#dbdee1] text-xs font-semibold px-3 py-1.5 rounded-md shadow-xl whitespace-nowrap border border-[#232428]">
              Adicionar ou Entrar em um Servidor
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
