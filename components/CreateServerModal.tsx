import React, { useState } from 'react';
import { X, Plus, LogIn } from 'lucide-react';

interface CreateServerModalProps {
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
  onJoin?: (inviteCode: string) => void;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({ onClose, onCreate, onJoin }) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim());
    onClose();
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !onJoin) return;
    onJoin(inviteCode.trim().toUpperCase());
    onClose();
  };

  return (
    <div
      id="create-server-modal"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 select-none"
    >
      <div className="w-full max-w-md bg-[#313338] rounded-2xl shadow-2xl border border-[#232428] overflow-hidden">
        {/* Header */}
        <div className="p-6 text-center relative border-b border-[#232428]">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-[#b5bac1] hover:text-white p-1"
          >
            <X size={20} />
          </button>
          <h2 className="text-xl font-bold text-white">
            {tab === 'create' ? 'Criar seu servidor' : 'Entrar em um servidor'}
          </h2>
          <p className="text-xs text-[#949ba4] mt-1">
            {tab === 'create'
              ? 'Seu servidor é onde você e seus amigos conversam em canais de texto e voz.'
              : 'Insira o código de convite recebido de um amigo para entrar em um servidor existente.'}
          </p>

          {/* Tab Switch */}
          {onJoin && (
            <div className="flex bg-[#1e1f22] p-1 rounded-lg mt-4 max-w-xs mx-auto border border-[#2b2d31]">
              <button
                type="button"
                onClick={() => setTab('create')}
                className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors ${
                  tab === 'create' ? 'bg-[#5865F2] text-white' : 'text-[#949ba4] hover:text-white'
                }`}
              >
                Criar Servidor
              </button>
              <button
                type="button"
                onClick={() => setTab('join')}
                className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors ${
                  tab === 'join' ? 'bg-[#5865F2] text-white' : 'text-[#949ba4] hover:text-white'
                }`}
              >
                Entrar com Código
              </button>
            </div>
          )}
        </div>

        {tab === 'create' ? (
          /* Create Form */
          <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider">
                Nome do Servidor
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Comunidade Gamer, Clube de Devs..."
                className="w-full bg-[#1e1f22] text-white p-2.5 rounded-md border border-[#2b2d31] text-sm focus:outline-none focus:border-[#5865F2]"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider">
                Tópico / Descrição
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sobre o que é este servidor?"
                className="w-full bg-[#1e1f22] text-white p-2.5 rounded-md border border-[#2b2d31] text-sm focus:outline-none focus:border-[#5865F2]"
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-semibold text-[#949ba4] hover:text-white"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="px-6 py-2.5 bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold rounded-md text-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                Criar Servidor
              </button>
            </div>
          </form>
        ) : (
          /* Join Form */
          <form onSubmit={handleJoinSubmit} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider">
                Código de Convite
              </label>
              <input
                type="text"
                required
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Ex: ABC123"
                className="w-full bg-[#1e1f22] text-white p-2.5 rounded-md border border-[#2b2d31] text-sm font-mono focus:outline-none focus:border-[#5865F2] uppercase"
                autoFocus
              />
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={onClose}
                className="text-sm font-semibold text-[#949ba4] hover:text-white"
              >
                Voltar
              </button>
              <button
                type="submit"
                disabled={!inviteCode.trim()}
                className="px-6 py-2.5 bg-[#23a55a] hover:bg-[#1a8346] text-white font-semibold rounded-md text-sm transition-colors disabled:opacity-50 cursor-pointer"
              >
                Entrar no Servidor
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
