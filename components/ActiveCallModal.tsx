import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
  Settings,
  Minimize2,
  Maximize2
} from 'lucide-react';
import { webrtcService, CallState, CallPeerInfo, AudioDeviceInfo } from '../services/webrtcService';

interface ActiveCallModalProps {
  state: CallState;
  targetUser: CallPeerInfo | null;
  reason?: string;
  onEndCall: () => void;
}

export const ActiveCallModal: React.FC<ActiveCallModalProps> = ({
  state,
  targetUser,
  reason,
  onEndCall
}) => {
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(webrtcService.isMuted);
  const [isDeafened, setIsDeafened] = useState(webrtcService.isDeafened);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [microphones, setMicrophones] = useState<AudioDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<AudioDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');

  // Call duration counter
  useEffect(() => {
    let timer: any = null;
    if (state === 'connected') {
      timer = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [state]);

  // Load audio devices when opening settings or connecting
  useEffect(() => {
    webrtcService.getAudioDevices().then(({ microphones, speakers }) => {
      setMicrophones(microphones);
      setSpeakers(speakers);
      if (microphones.length > 0 && !selectedMic) {
        setSelectedMic(microphones[0].deviceId);
      }
      if (speakers.length > 0 && !selectedSpeaker) {
        setSelectedSpeaker(speakers[0].deviceId);
      }
    });
  }, [showSettings, state]);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSecs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const handleToggleMute = () => {
    const muted = webrtcService.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleDeafen = () => {
    const deafened = webrtcService.toggleDeafen();
    setIsDeafened(deafened);
  };

  const handleMicChange = async (deviceId: string) => {
    setSelectedMic(deviceId);
    await webrtcService.switchMicrophone(deviceId);
  };

  const handleSpeakerChange = async (deviceId: string) => {
    setSelectedSpeaker(deviceId);
    await webrtcService.switchAudioOutput(deviceId);
  };

  if (!targetUser && state === 'idle') return null;

  // Minimized floating pill banner at bottom right
  if (isMinimized) {
    return (
      <div id="active-call-minimized" className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#2b2d31] border border-[#1e1f22] p-3 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5">
        <div className="relative">
          <img
            src={targetUser?.avatar || ''}
            alt={targetUser?.name || 'Chamada'}
            className="w-10 h-10 rounded-full object-cover border border-emerald-500"
          />
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-[#2b2d31]" />
        </div>

        <div className="flex flex-col pr-2">
          <span className="text-xs font-semibold text-white truncate max-w-[120px]">
            {targetUser?.name}
          </span>
          <span className="text-[11px] text-emerald-400 font-mono">
            {state === 'connected' ? formatDuration(seconds) : 'Conectando...'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-[#35373c] pl-2">
          <button
            id="min-toggle-mute-btn"
            onClick={handleToggleMute}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              isMuted ? 'bg-red-500/20 text-red-400' : 'bg-[#35373c] hover:bg-[#3f4147] text-gray-200'
            }`}
            title={isMuted ? 'Desmutar' : 'Mutar'}
          >
            {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          <button
            id="min-maximize-btn"
            onClick={() => setIsMinimized(false)}
            className="p-2 rounded-lg bg-[#35373c] hover:bg-[#3f4147] text-gray-200 transition-colors cursor-pointer"
            title="Expandir janela"
          >
            <Maximize2 size={16} />
          </button>

          <button
            id="min-hangup-btn"
            onClick={onEndCall}
            className="p-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer"
            title="Desligar"
          >
            <PhoneOff size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Expanded call overlay / modal
  return (
    <div id="active-call-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative bg-[#313338] border border-[#232428] rounded-3xl shadow-2xl p-8 w-full max-w-md flex flex-col items-center text-center">
        {/* Header Controls */}
        <div className="absolute top-5 right-5 flex items-center gap-2">
          <button
            id="call-settings-toggle-btn"
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              showSettings ? 'bg-[#5865f2] text-white' : 'bg-[#2b2d31] hover:bg-[#383a40] text-gray-300'
            }`}
            title="Configurações de Dispositivos de Áudio"
          >
            <Settings size={18} />
          </button>

          <button
            id="call-minimize-btn"
            onClick={() => setIsMinimized(true)}
            className="p-2 rounded-full bg-[#2b2d31] hover:bg-[#383a40] text-gray-300 transition-colors cursor-pointer"
            title="Minimizar chamada"
          >
            <Minimize2 size={18} />
          </button>
        </div>

        {/* Avatar & Pulse */}
        <div className="relative mt-2 mb-4">
          {state === 'connected' && (
            <div className="absolute -inset-3 rounded-full bg-emerald-500/20 animate-pulse" />
          )}
          {state === 'calling' && (
            <div className="absolute -inset-3 rounded-full bg-indigo-500/20 animate-ping" />
          )}
          <img
            src={targetUser?.avatar || ''}
            alt={targetUser?.name || ''}
            className="relative w-28 h-28 rounded-full object-cover border-4 border-[#232428] shadow-2xl"
          />
        </div>

        {/* User Name & Status */}
        <h3 className="text-xl font-bold text-white mb-1">
          {targetUser?.name}
        </h3>

        {/* Status indicator */}
        <div className="mb-6">
          {state === 'calling' && (
            <span className="inline-flex items-center gap-2 text-sm text-indigo-400 font-medium animate-pulse">
              <span className="w-2 h-2 rounded-full bg-indigo-400" />
              Chamando...
            </span>
          )}
          {state === 'connecting' && (
            <span className="inline-flex items-center gap-2 text-sm text-yellow-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
              Conectando áudio...
            </span>
          )}
          {state === 'connected' && (
            <div className="flex flex-col items-center">
              <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Voz Conectada
              </span>
              <span className="text-2xl font-mono font-bold text-white tracking-widest">
                {formatDuration(seconds)}
              </span>
            </div>
          )}
          {state === 'ended' && (
            <span className="text-sm text-red-400 font-medium">
              {reason || 'Chamada finalizada'}
            </span>
          )}
        </div>

        {/* Settings Panel (Device Selection) */}
        {showSettings && (
          <div className="w-full bg-[#2b2d31] rounded-2xl p-4 mb-6 text-left border border-[#1e1f22] animate-in fade-in zoom-in-95">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Configurações de Áudio
            </h4>

            {/* Microphone select */}
            <div className="mb-3">
              <label className="block text-xs text-gray-300 mb-1 flex items-center gap-1.5">
                <Mic size={14} className="text-emerald-400" />
                Microfone de Entrada
              </label>
              <select
                value={selectedMic}
                onChange={e => handleMicChange(e.target.value)}
                className="w-full bg-[#1e1f22] text-xs text-gray-200 border border-transparent rounded-lg p-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {microphones.length > 0 ? (
                  microphones.map(mic => (
                    <option key={mic.deviceId} value={mic.deviceId}>
                      {mic.label}
                    </option>
                  ))
                ) : (
                  <option value="">Microfone Padrão do Sistema</option>
                )}
              </select>
            </div>

            {/* Speaker select */}
            <div>
              <label className="block text-xs text-gray-300 mb-1 flex items-center gap-1.5">
                <Volume2 size={14} className="text-indigo-400" />
                Dispositivo de Saída (Alto-falante / Fone)
              </label>
              <select
                value={selectedSpeaker}
                onChange={e => handleSpeakerChange(e.target.value)}
                className="w-full bg-[#1e1f22] text-xs text-gray-200 border border-transparent rounded-lg p-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {speakers.length > 0 ? (
                  speakers.map(spk => (
                    <option key={spk.deviceId} value={spk.deviceId}>
                      {spk.label}
                    </option>
                  ))
                ) : (
                  <option value="">Saída Padrão do Sistema</option>
                )}
              </select>
            </div>
          </div>
        )}

        {/* Primary Call Controls */}
        <div className="flex items-center gap-4">
          {/* Mute button */}
          <button
            id="call-mute-toggle-btn"
            onClick={handleToggleMute}
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer shadow-lg ${
              isMuted
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-[#2b2d31] hover:bg-[#383a40] text-gray-200'
            }`}
            title={isMuted ? 'Ativar microfone' : 'Mutar microfone'}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* Deafen button */}
          <button
            id="call-deafen-toggle-btn"
            onClick={handleToggleDeafen}
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer shadow-lg ${
              isDeafened
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-[#2b2d31] hover:bg-[#383a40] text-gray-200'
            }`}
            title={isDeafened ? 'Ativar áudio' : 'Desativar áudio (Surdo)'}
          >
            {isDeafened ? <VolumeX size={22} /> : <Volume2 size={22} />}
          </button>

          {/* End Call button */}
          <button
            id="call-hangup-btn"
            onClick={onEndCall}
            className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex flex-col items-center justify-center transition-all cursor-pointer shadow-xl hover:scale-105 active:scale-95"
            title="Encerrar chamada"
          >
            <PhoneOff size={22} />
          </button>
        </div>
      </div>
    </div>
  );
};
