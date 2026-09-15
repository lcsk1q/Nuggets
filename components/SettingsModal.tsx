import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  User as UserIcon,
  Palette,
  Volume2,
  Bell,
  Check,
  Mic,
  MicOff,
  LogOut,
  Upload,
  Trash2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { User } from '../types';
import { api } from '../services/api';
import { notificationService, AppNotificationSettings } from '../services/notificationService';
import { webrtcService, AudioDeviceInfo } from '../services/webrtcService';

interface SettingsModalProps {
  currentUser: User;
  onClose: () => void;
  onUpdateUser: (updated: Partial<User>) => void;
  onLogout?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  currentUser,
  onClose,
  onUpdateUser,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'voice' | 'notifications'>('profile');
  const [displayName, setDisplayName] = useState(currentUser.name);
  const [customStatus, setCustomStatus] = useState(currentUser.customStatus || '');
  const [aboutMe, setAboutMe] = useState(currentUser.aboutMe || '');
  const [currentAvatar, setCurrentAvatar] = useState(currentUser.avatar);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  // Notification state
  const [notifSettings, setNotifSettings] = useState<AppNotificationSettings>(notificationService.getSettings());
  const [permStatus, setPermStatus] = useState<NotificationPermission | 'unsupported'>(notificationService.getPermissionStatus());

  // Voice & Audio state
  const [microphones, setMicrophones] = useState<AudioDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<AudioDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState(webrtcService.selectedMicId || '');
  const [selectedSpeaker, setSelectedSpeaker] = useState(webrtcService.selectedOutputId || '');
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const micTestStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync avatar if currentUser changes
  useEffect(() => {
    setCurrentAvatar(currentUser.avatar);
  }, [currentUser.avatar]);

  // Load audio devices when on voice tab
  useEffect(() => {
    if (activeTab === 'voice') {
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
    }
  }, [activeTab]);

  // Real microphone audio level meter for test
  useEffect(() => {
    if (!isTestingMic) {
      if (micTestStreamRef.current) {
        micTestStreamRef.current.getTracks().forEach(t => t.stop());
        micTestStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      setMicVolume(0);
      return;
    }

    let isMounted = true;

    async function startTest() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMic ? { deviceId: { exact: selectedMic } } : true
        });
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        micTestStreamRef.current = stream;

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!isMounted) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const level = Math.min(100, Math.round((average / 128) * 100));
          setMicVolume(level);
          animFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (err: any) {
        console.error('Error in mic test:', err);
        setIsTestingMic(false);
      }
    }

    startTest();

    return () => {
      isMounted = false;
      if (micTestStreamRef.current) {
        micTestStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isTestingMic, selectedMic]);

  // Handle avatar file selection & upload
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setIsUploadingAvatar(true);

    try {
      const res = await api.upload.avatar(file);
      if (res && res.avatarUrl) {
        setCurrentAvatar(res.avatarUrl);
        onUpdateUser({ avatar: res.avatarUrl });
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 2500);
      }
    } catch (err: any) {
      console.error('Upload avatar error:', err);
      setAvatarError(err.message || 'Falha ao enviar avatar.');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Reset to default avatar
  const handleRemoveAvatar = async () => {
    setAvatarError(null);
    setIsUploadingAvatar(true);
    try {
      const res = await api.upload.removeAvatar();
      if (res && res.avatarUrl) {
        setCurrentAvatar(res.avatarUrl);
        onUpdateUser({ avatar: res.avatarUrl });
      }
    } catch (err: any) {
      console.error('Error removing avatar:', err);
      setAvatarError(err.message || 'Erro ao redefinir avatar.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Save profile information
  const handleSaveProfile = () => {
    onUpdateUser({
      name: displayName,
      customStatus,
      aboutMe,
      avatar: currentAvatar
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  // Update notification preferences
  const handleToggleNotif = (key: keyof AppNotificationSettings) => {
    const updated = {
      ...notifSettings,
      [key]: !notifSettings[key]
    };
    setNotifSettings(updated);
    notificationService.updateSettings(updated);
    api.users.updateNotifications(updated).catch(() => {});
  };

  const handleRequestPermission = async () => {
    const status = await notificationService.requestPermission();
    setPermStatus(status);
  };

  return (
    <div
      id="settings-modal"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div className="w-full max-w-4xl h-[620px] bg-[#313338] rounded-2xl flex overflow-hidden shadow-2xl border border-[#232428] relative">
        {/* Settings Sidebar */}
        <div className="w-64 bg-[#2b2d31] p-4 flex flex-col justify-between border-r border-[#1f2023]/60 shrink-0">
          <div className="space-y-4">
            <div className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wider px-2">
              Configurações do Usuário
            </div>

            <nav className="space-y-0.5">
              <button
                id="tab-profile-btn"
                onClick={() => setActiveTab('profile')}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-[#404249] text-white'
                    : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
                }`}
              >
                <UserIcon size={16} />
                <span>Meu Perfil</span>
              </button>

              <button
                id="tab-notifications-btn"
                onClick={() => setActiveTab('notifications')}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                  activeTab === 'notifications'
                    ? 'bg-[#404249] text-white'
                    : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
                }`}
              >
                <Bell size={16} />
                <span>Notificações</span>
              </button>

              <button
                id="tab-voice-btn"
                onClick={() => setActiveTab('voice')}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                  activeTab === 'voice'
                    ? 'bg-[#404249] text-white'
                    : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
                }`}
              >
                <Volume2 size={16} />
                <span>Voz & Áudio</span>
              </button>

              <button
                id="tab-appearance-btn"
                onClick={() => setActiveTab('appearance')}
                className={`w-full px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-colors cursor-pointer ${
                  activeTab === 'appearance'
                    ? 'bg-[#404249] text-white'
                    : 'text-[#b5bac1] hover:bg-[#35373c] hover:text-[#dbdee1]'
                }`}
              >
                <Palette size={16} />
                <span>Aparência</span>
              </button>

              {onLogout && (
                <div className="pt-4 border-t border-[#35373c]">
                  <button
                    id="btn-settings-logout"
                    onClick={() => {
                      onClose();
                      onLogout();
                    }}
                    className="w-full px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2.5 text-[#f23f43] hover:bg-[#f23f43]/15 transition-colors cursor-pointer"
                  >
                    <LogOut size={16} />
                    <span>Sair da conta</span>
                  </button>
                </div>
              )}
            </nav>
          </div>

          <div className="text-xs text-[#80848e] px-2">
            Nuggets v2.4.0 (Build 2026.3)
          </div>
        </div>

        {/* Content Pane */}
        <div className="flex-1 p-8 overflow-y-auto relative [scrollbar-width:thin]">
          {/* Close ESC button */}
          <div className="absolute top-6 right-6 flex items-center gap-2">
            <button
              id="btn-close-settings"
              onClick={onClose}
              className="w-9 h-9 rounded-full border border-[#4e5058] hover:bg-[#35373c] text-[#b5bac1] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Fechar (ESC)"
            >
              <X size={18} />
            </button>
            <span className="text-[11px] font-bold text-[#949ba4]">ESC</span>
          </div>

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="max-w-lg space-y-6">
              <h2 className="text-xl font-bold text-white">Perfil do Usuário</h2>

              {/* Avatar Uploader */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#b5bac1] uppercase tracking-wider">
                  Foto de Perfil (Avatar)
                </label>
                <div className="flex items-center gap-5 p-4 bg-[#2b2d31] rounded-2xl border border-[#232428]">
                  <div className="relative">
                    <img
                      src={currentAvatar}
                      alt={currentUser.name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-indigo-500 shadow-md"
                    />
                    {isUploadingAvatar && (
                      <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                        <Loader2 className="animate-spin text-white" size={20} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={handleAvatarFileChange}
                        className="hidden"
                        id="avatar-file-upload-input"
                      />
                      <button
                        id="btn-upload-avatar"
                        type="button"
                        disabled={isUploadingAvatar}
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3.5 py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Upload size={14} />
                        <span>Carregar do Computador</span>
                      </button>

                      <button
                        id="btn-remove-avatar"
                        type="button"
                        disabled={isUploadingAvatar}
                        onClick={handleRemoveAvatar}
                        className="p-1.5 bg-[#35373c] hover:bg-[#3f4147] text-gray-300 hover:text-red-400 rounded-lg text-xs transition-colors cursor-pointer"
                        title="Redefinir para padrão"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <p className="text-[11px] text-gray-400">
                      Formatos recomendados: PNG, JPG ou WEBP (máx. 10MB). Sincroniza em tempo real com todos os outros usuários.
                    </p>

                    {avatarError && (
                      <p className="text-xs text-red-400 flex items-center gap-1">
                        <AlertCircle size={13} /> {avatarError}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Display Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#b5bac1] uppercase">Nome de Exibição</label>
                <input
                  id="input-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#1e1f22] text-white p-2.5 rounded-lg border border-[#111214] text-sm focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
                />
              </div>

              {/* Custom Status */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#b5bac1] uppercase">Status Personalizado</label>
                <input
                  id="input-custom-status"
                  type="text"
                  value={customStatus}
                  onChange={(e) => setCustomStatus(e.target.value)}
                  placeholder="O que você está pensando?"
                  className="w-full bg-[#1e1f22] text-white p-2.5 rounded-lg border border-[#111214] text-sm focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
                />
              </div>

              {/* About Me */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#b5bac1] uppercase">Sobre Mim</label>
                <textarea
                  id="input-about-me"
                  rows={3}
                  value={aboutMe}
                  onChange={(e) => setAboutMe(e.target.value)}
                  className="w-full bg-[#1e1f22] text-white p-2.5 rounded-lg border border-[#111214] text-sm focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  id="btn-save-profile"
                  onClick={handleSaveProfile}
                  className="px-5 py-2 bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold rounded-lg text-sm transition-colors shadow cursor-pointer"
                >
                  Salvar Alterações
                </button>
                {savedNotice && (
                  <span className="text-xs text-[#23a55a] flex items-center gap-1 font-medium animate-in fade-in">
                    <Check size={16} /> Salvo com sucesso!
                  </span>
                )}
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="max-w-lg space-y-6">
              <h2 className="text-xl font-bold text-white">Notificações</h2>

              {/* Browser Permission Banner */}
              <div className="p-4 bg-[#2b2d31] rounded-2xl border border-[#232428] flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white mb-1">
                    Notificações do Navegador / Sistema
                  </div>
                  <div className="text-xs text-gray-400">
                    Status:{' '}
                    {permStatus === 'granted' ? (
                      <span className="text-emerald-400 font-semibold">Permitido</span>
                    ) : permStatus === 'denied' ? (
                      <span className="text-red-400 font-semibold">Bloqueado no navegador</span>
                    ) : (
                      <span className="text-yellow-400 font-semibold">Pendente / Não solicitado</span>
                    )}
                  </div>
                </div>

                {permStatus !== 'granted' && permStatus !== 'unsupported' && (
                  <button
                    id="btn-enable-browser-notif"
                    onClick={handleRequestPermission}
                    className="px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752c4] text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Ativar no Navegador
                  </button>
                )}
              </div>

              {/* Toggles */}
              <div className="space-y-4">
                <label className="flex items-center justify-between p-3 bg-[#1e1f22] rounded-xl cursor-pointer hover:bg-[#232428] transition-colors">
                  <div>
                    <div className="text-sm font-medium text-white">Mensagens Diretas</div>
                    <div className="text-xs text-gray-400">Receber notificações quando receber mensagens privadas</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.messagesEnabled}
                    onChange={() => handleToggleNotif('messagesEnabled')}
                    className="w-4 h-4 accent-[#5865F2] rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#1e1f22] rounded-xl cursor-pointer hover:bg-[#232428] transition-colors">
                  <div>
                    <div className="text-sm font-medium text-white">Mensagens de Servidores</div>
                    <div className="text-xs text-gray-400">Notificar novas postagens nos canais que você participa</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.serverMessagesEnabled}
                    onChange={() => handleToggleNotif('serverMessagesEnabled')}
                    className="w-4 h-4 accent-[#5865F2] rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#1e1f22] rounded-xl cursor-pointer hover:bg-[#232428] transition-colors">
                  <div>
                    <div className="text-sm font-medium text-white">Solicitações de Amizade</div>
                    <div className="text-xs text-gray-400">Notificar quando alguém enviar convite de amizade</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.friendRequestsEnabled}
                    onChange={() => handleToggleNotif('friendRequestsEnabled')}
                    className="w-4 h-4 accent-[#5865F2] rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#1e1f22] rounded-xl cursor-pointer hover:bg-[#232428] transition-colors">
                  <div>
                    <div className="text-sm font-medium text-white">Chamadas de Voz Recebidas</div>
                    <div className="text-xs text-gray-400">Receber alertas visuais e sonoros de chamada</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.incomingCallsEnabled}
                    onChange={() => handleToggleNotif('incomingCallsEnabled')}
                    className="w-4 h-4 accent-[#5865F2] rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#1e1f22] rounded-xl cursor-pointer hover:bg-[#232428] transition-colors">
                  <div>
                    <div className="text-sm font-medium text-white">Sons de Notificação</div>
                    <div className="text-xs text-gray-400">Tocar sinal sonoro ao receber mensagens ou chamadas</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.soundEnabled}
                    onChange={() => handleToggleNotif('soundEnabled')}
                    className="w-4 h-4 accent-[#5865F2] rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-[#1e1f22] rounded-xl cursor-pointer hover:bg-[#232428] transition-colors">
                  <div>
                    <div className="text-sm font-medium text-white">Exibir Conteúdo nas Notificações</div>
                    <div className="text-xs text-gray-400">Mostrar trecho do texto na notificação do sistema</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSettings.showContent}
                    onChange={() => handleToggleNotif('showContent')}
                    className="w-4 h-4 accent-[#5865F2] rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* VOICE & AUDIO TAB */}
          {activeTab === 'voice' && (
            <div className="max-w-lg space-y-6">
              <h2 className="text-xl font-bold text-white">Configurações de Voz & Áudio</h2>

              {/* Devices */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-1.5 flex items-center gap-1.5">
                    <Mic size={14} className="text-emerald-400" />
                    Dispositivo de Entrada (Microfone)
                  </label>
                  <select
                    value={selectedMic}
                    onChange={e => {
                      setSelectedMic(e.target.value);
                      webrtcService.switchMicrophone(e.target.value);
                    }}
                    className="w-full bg-[#1e1f22] text-sm text-gray-200 border border-[#232428] rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {microphones.length > 0 ? (
                      microphones.map(mic => (
                        <option key={mic.deviceId} value={mic.deviceId}>
                          {mic.label}
                        </option>
                      ))
                    ) : (
                      <option value="">Microfone padrão</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-1.5 flex items-center gap-1.5">
                    <Volume2 size={14} className="text-indigo-400" />
                    Dispositivo de Saída (Alto-falante / Fone)
                  </label>
                  <select
                    value={selectedSpeaker}
                    onChange={e => {
                      setSelectedSpeaker(e.target.value);
                      webrtcService.switchAudioOutput(e.target.value);
                    }}
                    className="w-full bg-[#1e1f22] text-sm text-gray-200 border border-[#232428] rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {speakers.length > 0 ? (
                      speakers.map(spk => (
                        <option key={spk.deviceId} value={spk.deviceId}>
                          {spk.label}
                        </option>
                      ))
                    ) : (
                      <option value="">Alto-falante padrão</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Real Mic Test Meter */}
              <div className="p-5 bg-[#1e1f22] rounded-2xl border border-[#35373c] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-white">Teste de Microfone em Tempo Real</div>
                  <span className="text-xs text-gray-400 font-mono">{micVolume}%</span>
                </div>

                <div className="h-3 bg-[#2b2d31] rounded-full overflow-hidden p-0.5 border border-[#1e1f22]">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500 rounded-full transition-all duration-75"
                    style={{ width: `${micVolume}%` }}
                  />
                </div>

                <button
                  id="btn-test-mic"
                  onClick={() => setIsTestingMic(!isTestingMic)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                    isTestingMic
                      ? 'bg-[#f23f43] text-white hover:bg-[#da373b]'
                      : 'bg-[#5865F2] text-white hover:bg-[#4752c4]'
                  }`}
                >
                  {isTestingMic ? <MicOff size={16} /> : <Mic size={16} />}
                  <span>{isTestingMic ? 'Parar Teste' : 'Testar Meu Microfone'}</span>
                </button>
              </div>
            </div>
          )}

          {/* APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <div className="max-w-lg space-y-6">
              <h2 className="text-xl font-bold text-white">Aparência</h2>

              <div className="space-y-3">
                <label className="text-xs font-bold text-[#b5bac1] uppercase">Tema</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border-2 border-[#5865F2] bg-[#313338] text-white space-y-1 cursor-pointer">
                    <div className="font-bold text-sm">Escuro (Padrão)</div>
                    <div className="text-xs text-[#949ba4]">Tema escuro clássico do Nuggets</div>
                  </div>
                  <div className="p-4 rounded-xl border border-[#3f4147] bg-[#1e1f22] text-white space-y-1 cursor-pointer hover:border-[#5865F2]">
                    <div className="font-bold text-sm">Meia-noite</div>
                    <div className="text-xs text-[#949ba4]">Preto profundo para telas OLED</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
