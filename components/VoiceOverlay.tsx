import React from 'react';
import { Mic, MicOff, Headphones, PhoneOff, Share2, Video, VideoOff, Volume2 } from 'lucide-react';
import { User, VoiceChannelState } from '../types';

interface VoiceOverlayProps {
  voiceState: VoiceChannelState;
  currentUser: User;
  participants?: User[];
  onDisconnect: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare?: () => void;
  onToggleVideo?: () => void;
}

export const VoiceOverlay: React.FC<VoiceOverlayProps> = ({
  voiceState,
  currentUser,
  participants = [],
  onDisconnect,
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onToggleVideo
}) => {
  const safeParticipants = Array.isArray(participants) ? participants : [];

  return (
    <div
      id="voice-overlay-room"
      className="flex-1 bg-[#1e1f22] flex flex-col h-full overflow-hidden select-none"
    >
      {/* Voice Room Header */}
      <div className="h-12 px-6 border-b border-[#2b2d31] flex items-center justify-between bg-[#232428] shrink-0">
        <div className="flex items-center gap-2">
          <Volume2 size={20} className="text-[#23a55a]" />
          <h2 className="text-base font-bold text-white">
            {voiceState.channelName || 'Canal de Voz'}
          </h2>
          <span className="text-xs text-[#949ba4] ml-2">
            ({safeParticipants.length + 1} conectado{safeParticipants.length > 0 ? 's' : ''})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#23a55a] font-semibold bg-[#23a55a]/10 px-2 py-1 rounded">
            🟢 RTC Conectado
          </span>
        </div>
      </div>

      {/* Voice Participant Grid */}
      <div className="flex-1 p-6 overflow-y-auto flex items-center justify-center">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-4xl">
          {/* Current User Card */}
          <div className="bg-[#2b2d31] rounded-xl p-6 flex flex-col items-center justify-center relative aspect-video border border-[#35373c] shadow-lg">
            <div className="relative mb-3">
              <img
                src={currentUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                alt={currentUser?.name || 'Você'}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-[#23a55a]/60 shadow-xl"
              />
              {voiceState.isMuted && (
                <div className="absolute -bottom-1 -right-1 bg-[#f23f43] p-1.5 rounded-full text-white">
                  <MicOff size={14} />
                </div>
              )}
            </div>
            <span className="font-semibold text-white text-sm">
              {currentUser?.name || 'Você'} (Você)
            </span>
            <span className="text-xs text-[#23a55a] mt-1 font-medium">Falando</span>
          </div>

          {/* Other participants */}
          {safeParticipants.map((user) => (
            <div
              key={user.id}
              className="bg-[#2b2d31] rounded-xl p-6 flex flex-col items-center justify-center relative aspect-video border border-[#35373c] shadow-lg"
            >
              <div className="relative mb-3">
                <img
                  src={user.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                  alt={user.name}
                  className="w-20 h-20 rounded-full object-cover"
                />
              </div>
              <span className="font-semibold text-white text-sm">{user.name}</span>
              <span className="text-xs text-[#949ba4] mt-1">Conectado</span>
            </div>
          ))}

          {/* Screen Share Card */}
          {voiceState.isScreenSharing && (
            <div className="col-span-full bg-[#111214] rounded-xl p-4 border border-[#5865F2] flex flex-col items-center justify-center min-h-[220px]">
              <div className="flex items-center gap-2 text-[#5865F2] mb-2 font-bold text-sm">
                <Share2 size={18} />
                <span>Compartilhamento de Tela</span>
              </div>
              <div className="w-full h-40 bg-[#1e1f22] rounded-lg border border-[#313338] flex items-center justify-center text-xs text-[#949ba4]">
                <span>🖥️ Transmissão de tela ativa</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Voice Controls Bottom Bar */}
      <div className="h-16 bg-[#111214] px-6 flex items-center justify-center gap-3 shrink-0 border-t border-[#232428]">
        {/* Toggle Mute */}
        <button
          onClick={onToggleMute}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
            voiceState.isMuted
              ? 'bg-[#f23f43] text-white hover:bg-[#d8363a]'
              : 'bg-[#313338] text-[#dbdee1] hover:bg-[#3b3e45]'
          }`}
          title={voiceState.isMuted ? 'Desmutar' : 'Mutar'}
        >
          {voiceState.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        {/* Toggle Deafen */}
        <button
          onClick={onToggleDeafen}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
            voiceState.isDeafened
              ? 'bg-[#f23f43] text-white hover:bg-[#d8363a]'
              : 'bg-[#313338] text-[#dbdee1] hover:bg-[#3b3e45]'
          }`}
          title={voiceState.isDeafened ? 'Desativar ensurdecedor' : 'Ensurdecer'}
        >
          <Headphones size={20} />
        </button>

        {/* Toggle Video */}
        {onToggleVideo && (
          <button
            onClick={onToggleVideo}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
              voiceState.isVideo
                ? 'bg-[#23a55a] text-white'
                : 'bg-[#313338] text-[#dbdee1] hover:bg-[#3b3e45]'
            }`}
            title="Câmera"
          >
            {voiceState.isVideo ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
        )}

        {/* Toggle Screen Share */}
        {onToggleScreenShare && (
          <button
            onClick={onToggleScreenShare}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
              voiceState.isScreenSharing
                ? 'bg-[#5865F2] text-white'
                : 'bg-[#313338] text-[#dbdee1] hover:bg-[#3b3e45]'
            }`}
            title="Compartilhar Tela"
          >
            <Share2 size={20} />
          </button>
        )}

        {/* Disconnect */}
        <button
          onClick={onDisconnect}
          className="w-11 h-11 rounded-full bg-[#f23f43] text-white flex items-center justify-center hover:bg-[#d8363a] transition-colors"
          title="Desconectar"
        >
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  );
};
