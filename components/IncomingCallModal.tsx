import React from 'react';
import { Phone, PhoneOff, Mic } from 'lucide-react';
import { CallPeerInfo } from '../services/webrtcService';

interface IncomingCallModalProps {
  caller: CallPeerInfo;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  caller,
  onAccept,
  onReject
}) => {
  return (
    <div id="incoming-call-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#313338] border border-[#232428] rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col items-center text-center">
        {/* Pulsing avatar */}
        <div className="relative mb-4">
          <div className="absolute -inset-2 rounded-full bg-emerald-500/30 animate-ping" />
          <div className="absolute -inset-1 rounded-full bg-emerald-500/50 animate-pulse" />
          <img
            src={caller.avatar}
            alt={caller.name}
            className="relative w-20 h-20 rounded-full object-cover border-2 border-emerald-500 shadow-lg"
          />
          <div className="absolute bottom-0 right-0 bg-[#232428] p-1.5 rounded-full border border-emerald-500 text-emerald-400">
            <Mic size={14} />
          </div>
        </div>

        <h3 className="text-lg font-semibold text-white mb-1">
          {caller.name}
        </h3>
        <p className="text-sm text-gray-400 mb-6 animate-pulse">
          Chamada de voz recebida...
        </p>

        {/* Actions */}
        <div className="flex items-center gap-6 w-full justify-center">
          <button
            id="reject-call-btn"
            onClick={onReject}
            className="flex flex-col items-center gap-1.5 group cursor-pointer"
            title="Recusar chamada"
          >
            <div className="w-14 h-14 rounded-full bg-red-600/90 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 active:scale-95">
              <PhoneOff size={22} />
            </div>
            <span className="text-xs font-medium text-gray-300 group-hover:text-red-400">Recusar</span>
          </button>

          <button
            id="accept-call-btn"
            onClick={onAccept}
            className="flex flex-col items-center gap-1.5 group cursor-pointer"
            title="Atender chamada"
          >
            <div className="w-14 h-14 rounded-full bg-emerald-600/90 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 active:scale-95 animate-bounce">
              <Phone size={22} />
            </div>
            <span className="text-xs font-medium text-gray-300 group-hover:text-emerald-400">Atender</span>
          </button>
        </div>
      </div>
    </div>
  );
};
