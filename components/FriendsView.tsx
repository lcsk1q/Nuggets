import React, { useState } from 'react';
import {
  Users,
  MessageSquare,
  Check,
  X,
  Search,
  UserPlus,
  Clock,
  Circle,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Phone
} from 'lucide-react';
import { Friend, User, UserStatus } from '../types';

interface FriendsViewProps {
  friends: Friend[];
  onStartDirectMessage: (userId: string) => void;
  onSendFriendRequest: (username: string) => Promise<{ success: boolean; error?: string }>;
  onAcceptRequest: (requestId?: string, senderId?: string) => void;
  onRejectRequest: (requestId?: string, senderId?: string) => void;
  onStartVoiceCall?: (user: User) => void;
}

export const FriendsView: React.FC<FriendsViewProps> = ({
  friends,
  onStartDirectMessage,
  onSendFriendRequest,
  onAcceptRequest,
  onRejectRequest,
  onStartVoiceCall
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'online' | 'all' | 'pending' | 'add'>('online');
  const [searchFilter, setSearchFilter] = useState('');
  const [addFriendInput, setAddFriendInput] = useState('');
  const [addStatus, setAddStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'online': return 'bg-[#23a55a]';
      case 'idle': return 'bg-[#f0b232]';
      case 'dnd': return 'bg-[#f23f43]';
      case 'offline': return 'bg-[#80848e]';
    }
  };

  const getStatusLabel = (status: UserStatus) => {
    switch (status) {
      case 'online': return 'Online';
      case 'idle': return 'Ausente';
      case 'dnd': return 'Não perturbe';
      case 'offline': return 'Offline';
    }
  };

  // Filtered lists
  const safeFriends = Array.isArray(friends) ? friends : [];
  const actualFriends = safeFriends.filter(f => f && f.relationship === 'friend' && f.user);
  const onlineFriends = actualFriends.filter(f => f.user?.status && f.user.status !== 'offline');
  const pendingIncoming = safeFriends.filter(f => f && f.relationship === 'pending_incoming' && f.user);
  const pendingOutgoing = safeFriends.filter(f => f && f.relationship === 'pending_outgoing' && f.user);
  const pendingTotal = pendingIncoming.length + pendingOutgoing.length;

  const getDisplayedFriends = () => {
    let list: Friend[] = [];
    if (activeSubTab === 'online') list = onlineFriends;
    else if (activeSubTab === 'all') list = actualFriends;
    else if (activeSubTab === 'pending') list = [...pendingIncoming, ...pendingOutgoing];

    if (!searchFilter.trim()) return list;

    const q = searchFilter.toLowerCase();
    return list.filter(
      f =>
        f.user.name.toLowerCase().includes(q) ||
        f.user.username.toLowerCase().includes(q)
    );
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = addFriendInput.trim();
    if (!clean) return;

    setIsSubmitting(true);
    setAddStatus(null);

    const res = await onSendFriendRequest(clean);
    setIsSubmitting(false);

    if (res.success) {
      setAddStatus({
        type: 'success',
        message: `Solicitação de amizade enviada com sucesso para ${clean}!`
      });
      setAddFriendInput('');
    } else {
      setAddStatus({
        type: 'error',
        message: res.error || 'Não foi possível encontrar ou adicionar este usuário.'
      });
    }
  };

  const displayedFriends = getDisplayedFriends();

  return (
    <main
      id="friends-view"
      className="flex-1 flex flex-col h-full bg-[#313338] min-w-0 select-none overflow-hidden"
    >
      {/* Friends Header Bar */}
      <header
        id="friends-header"
        className="h-12 px-6 border-b border-[#1f2023] flex items-center justify-between shrink-0 bg-[#313338] shadow-sm z-10"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-[#949ba4] font-semibold text-sm">
            <Users size={20} />
            <span className="text-white font-bold">Amigos</span>
          </div>

          <div className="h-4 w-[1px] bg-[#4e5058]" />

          {/* Sub Navigation Tabs */}
          <nav className="flex items-center gap-1">
            <button
              id="tab-friends-online"
              onClick={() => { setActiveSubTab('online'); setAddStatus(null); }}
              className={`px-2.5 py-1 rounded-md text-sm font-medium transition-colors ${
                activeSubTab === 'online'
                  ? 'bg-[#404249] text-white'
                  : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
              }`}
            >
              Disponível ({onlineFriends.length})
            </button>

            <button
              id="tab-friends-all"
              onClick={() => { setActiveSubTab('all'); setAddStatus(null); }}
              className={`px-2.5 py-1 rounded-md text-sm font-medium transition-colors ${
                activeSubTab === 'all'
                  ? 'bg-[#404249] text-white'
                  : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
              }`}
            >
              Todos ({actualFriends.length})
            </button>

            <button
              id="tab-friends-pending"
              onClick={() => { setActiveSubTab('pending'); setAddStatus(null); }}
              className={`px-2.5 py-1 rounded-md text-sm font-medium transition-colors relative ${
                activeSubTab === 'pending'
                  ? 'bg-[#404249] text-white'
                  : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
              }`}
            >
              <span>Pendentes</span>
              {pendingIncoming.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-[#f23f43] text-white text-[10px] font-bold">
                  {pendingIncoming.length}
                </span>
              )}
            </button>

            <button
              id="tab-friends-add"
              onClick={() => { setActiveSubTab('add'); setAddStatus(null); }}
              className={`px-2.5 py-1 rounded-md text-sm font-medium transition-colors ${
                activeSubTab === 'add'
                  ? 'bg-transparent text-[#23a55a] font-bold'
                  : 'bg-[#23a55a] text-white hover:bg-[#1a8346]'
              }`}
            >
              Adicionar amigo
            </button>
          </nav>
        </div>
      </header>

      {/* Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Main List Column */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto [scrollbar-width:thin]">
          {activeSubTab === 'add' ? (
            /* ADD FRIEND TAB */
            <div className="max-w-2xl space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white uppercase tracking-wider text-sm">
                  Adicionar Amigo
                </h2>
                <p className="text-xs text-[#949ba4]">
                  Você pode adicionar amigos usando o nome de usuário deles (ex: @amigo123 ou amigo123).
                </p>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-3">
                <div className="relative bg-[#1e1f22] rounded-lg p-3 border border-[#2b2d31] flex items-center justify-between focus-within:border-[#5865F2] transition-colors">
                  <input
                    id="input-add-friend"
                    type="text"
                    value={addFriendInput}
                    onChange={(e) => setAddFriendInput(e.target.value)}
                    placeholder="Você pode adicionar amigos com o nome de usuário"
                    className="bg-transparent text-sm text-[#dbdee1] placeholder-[#5c5f66] flex-1 outline-none mr-2"
                  />
                  <button
                    id="btn-send-friend-request"
                    type="submit"
                    disabled={!addFriendInput.trim() || isSubmitting}
                    className="px-4 py-1.5 bg-[#5865F2] hover:bg-[#4752c4] disabled:opacity-50 text-white text-xs font-semibold rounded transition-colors cursor-pointer shrink-0"
                  >
                    {isSubmitting ? 'Enviando...' : 'Enviar solicitação de amizade'}
                  </button>
                </div>

                {/* Status Messages */}
                {addStatus?.type === 'success' && (
                  <div className="p-3 rounded-md bg-[#23a55a]/15 border border-[#23a55a]/30 flex items-center gap-2 text-xs text-[#23a55a]">
                    <CheckCircle2 size={16} />
                    <span>{addStatus.message}</span>
                  </div>
                )}

                {addStatus?.type === 'error' && (
                  <div className="p-3 rounded-md bg-[#f23f43]/15 border border-[#f23f43]/30 flex items-center gap-2 text-xs text-[#f67175]">
                    <AlertCircle size={16} />
                    <span>{addStatus.message}</span>
                  </div>
                )}
              </form>

              <div className="pt-8 border-t border-[#35373c] text-center">
                <div className="w-16 h-16 rounded-full bg-[#2b2d31] flex items-center justify-center mx-auto mb-3 text-[#949ba4]">
                  <UserPlus size={32} />
                </div>
                <h3 className="text-sm font-semibold text-white">Nenhum amigo ainda?</h3>
                <p className="text-xs text-[#949ba4] max-w-sm mx-auto mt-1">
                  Peça para seu colega criar uma conta no outro computador e adicione-o pelo nome de usuário dele!
                </p>
              </div>
            </div>
          ) : (
            /* ONLINE / ALL / PENDING TABS */
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative mb-2">
                <input
                  id="input-friends-search"
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Buscar"
                  className="w-full bg-[#1e1f22] text-sm text-[#dbdee1] placeholder-[#80848e] rounded px-3 py-1.5 pr-8 border border-transparent focus:border-[#5865F2] outline-none transition-colors"
                />
                <Search size={16} className="absolute right-2.5 top-2 text-[#949ba4]" />
              </div>

              {/* Title count */}
              <div className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider">
                {activeSubTab === 'online' && `Disponível — ${displayedFriends.length}`}
                {activeSubTab === 'all' && `Todos os Amigos — ${displayedFriends.length}`}
                {activeSubTab === 'pending' && `Pendentes — ${displayedFriends.length}`}
              </div>

              {/* Empty state */}
              {displayedFriends.length === 0 && (
                <div className="text-center py-16 px-4">
                  <div className="w-16 h-16 rounded-full bg-[#2b2d31] flex items-center justify-center mx-auto mb-3 text-[#949ba4]">
                    <Users size={30} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">
                    {activeSubTab === 'pending'
                      ? 'Nenhuma solicitação de amizade pendente.'
                      : activeSubTab === 'online'
                      ? 'Nenhum amigo online no momento.'
                      : 'Nenhum amigo ainda.'}
                  </h3>
                  <p className="text-xs text-[#949ba4] mt-1 mb-4">
                    {activeSubTab === 'pending'
                      ? 'Quando alguém te adicionar pelo seu nome de usuário, a solicitação aparecerá aqui.'
                      : 'Adicione amigos para começar a conversar em tempo real.'}
                  </p>
                  {activeSubTab !== 'pending' && (
                    <button
                      onClick={() => setActiveSubTab('add')}
                      className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-semibold rounded-md transition-colors shadow"
                    >
                      Adicionar amigo
                    </button>
                  )}
                </div>
              )}

              {/* Friends list */}
              <div className="divide-y divide-[#35373c]/50">
                {displayedFriends.map((f) => {
                  const isIncoming = f.relationship === 'pending_incoming';
                  const isOutgoing = f.relationship === 'pending_outgoing';

                  return (
                    <div
                      key={f.user.id}
                      id={`friend-row-${f.user.id}`}
                      className="py-2.5 px-2.5 rounded-lg hover:bg-[#35373c]/50 flex items-center justify-between group transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <img
                            src={f.user.avatar}
                            alt={f.user.name}
                            className="w-10 h-10 rounded-full object-cover bg-[#2b2d31]"
                          />
                          {!isIncoming && !isOutgoing && (
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-[#313338] ${getStatusColor(
                                f.user.status
                              )}`}
                            />
                          )}
                        </div>

                        {/* Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-white truncate">
                              {f.user.name}
                            </span>
                            <span className="text-xs text-[#949ba4]">
                              #{f.user.username}
                            </span>
                          </div>

                          <div className="text-xs text-[#949ba4] truncate">
                            {isIncoming && 'Solicitação de amizade recebida'}
                            {isOutgoing && 'Solicitação de amizade enviada'}
                            {!isIncoming && !isOutgoing && (f.user.customStatus || getStatusLabel(f.user.status))}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isIncoming && (
                          <>
                            <button
                              id={`btn-accept-${f.user.id}`}
                              onClick={() => onAcceptRequest(f.requestId, f.user.id)}
                              className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#23a55a] text-[#b5bac1] hover:text-white flex items-center justify-center transition-colors"
                              title="Aceitar solicitação"
                            >
                              <Check size={18} />
                            </button>
                            <button
                              id={`btn-reject-${f.user.id}`}
                              onClick={() => onRejectRequest(f.requestId, f.user.id)}
                              className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#f23f43] text-[#b5bac1] hover:text-white flex items-center justify-center transition-colors"
                              title="Recusar solicitação"
                            >
                              <X size={18} />
                            </button>
                          </>
                        )}

                        {isOutgoing && (
                          <span className="text-xs text-[#949ba4] bg-[#2b2d31] px-2.5 py-1 rounded">
                            Pendente
                          </span>
                        )}

                        {!isIncoming && !isOutgoing && (
                          <div className="flex items-center gap-1.5">
                            {onStartVoiceCall && f.user.status !== 'offline' && (
                              <button
                                id={`btn-call-${f.user.id}`}
                                onClick={() => onStartVoiceCall(f.user)}
                                className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-emerald-600 text-[#b5bac1] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                title="Iniciar chamada de voz"
                              >
                                <Phone size={16} />
                              </button>
                            )}
                            <button
                              id={`btn-dm-${f.user.id}`}
                              onClick={() => onStartDirectMessage(f.user.id)}
                              className="w-9 h-9 rounded-full bg-[#2b2d31] hover:bg-[#35373c] text-[#b5bac1] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                              title="Conversar"
                            >
                              <MessageSquare size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};
