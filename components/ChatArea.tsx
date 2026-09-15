import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Hash,
  AtSign,
  Search,
  Bell,
  Pin,
  Users,
  PlusCircle,
  Smile,
  Send,
  Reply,
  Trash2,
  Phone,
  Video,
  ExternalLink,
  Code,
  Image as ImageIcon,
  Film,
  FileText,
  FileArchive,
  File as FileIcon,
  Download,
  Sparkles,
  X,
  Check,
  Loader2,
  Maximize2
} from 'lucide-react';
import { Message, User, Channel, MessageAttachment } from '../types';
import { api } from '../services/api';

interface ChatAreaProps {
  channel: Channel | null;
  dmRecipient?: User;
  messages: Message[];
  currentUser: User;
  onSendMessage: (content: string, replyToMessage?: Message, attachments?: MessageAttachment[]) => void;
  onAddReaction: (messageId: string, emoji: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onTogglePin: (messageId: string) => void;
  onToggleMemberList: () => void;
  isMemberListVisible: boolean;
  isAiGenerating?: boolean;
  onOpenWebPreview?: (html: string, title: string) => void;
  onStartVoiceCall?: (user: User) => void;
}

const COMMON_EMOJIS = ['🍗', '❤️', '🔥', '👍', '😂', '🚀', '🎉', '💯', '✨', '🤖', '👀', '💡'];

export const ChatArea: React.FC<ChatAreaProps> = ({
  channel,
  dmRecipient,
  messages,
  currentUser,
  onSendMessage,
  onAddReaction,
  onDeleteMessage,
  onTogglePin,
  onToggleMemberList,
  isMemberListVisible,
  isAiGenerating = false,
  onOpenWebPreview,
  onStartVoiceCall
}) => {
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showPinnedModal, setShowPinnedModal] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<string, boolean>>({});

  // Lightbox modal state for full-screen image view
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  // Staged attachment state before sending
  const [pendingAttachment, setPendingAttachment] = useState<MessageAttachment | null>(null);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  // CRITICAL FIX FOR DUPLICATE MESSAGES:
  // Memoize and filter unique messages by id to guarantee no duplicates ever render in the UI
  const uniqueMessages = useMemo(() => {
    const seen = new Set<string>();
    const result: Message[] = [];
    const source = Array.isArray(messages) ? messages : [];
    for (const msg of source) {
      if (!msg || !msg.id) continue;
      if (!seen.has(msg.id)) {
        seen.add(msg.id);
        result.push(msg);
      }
    }
    return result;
  }, [messages]);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [uniqueMessages, isAiGenerating]);

  // Close plus menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setShowPlusMenu(false);
      }
    };
    if (showPlusMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPlusMenu]);

  // Handle slash commands suggestions
  useEffect(() => {
    if (inputText.startsWith('/')) {
      setShowSlashCommands(true);
    } else {
      setShowSlashCommands(false);
    }
  }, [inputText]);

  // Handle sending message
  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isUploadingAttachment) return;

    const text = inputText.trim();
    if (!text && !pendingAttachment) return;

    const attachmentsToSend = pendingAttachment ? [pendingAttachment] : undefined;
    onSendMessage(text, replyingTo || undefined, attachmentsToSend);

    setInputText('');
    setPendingAttachment(null);
    setReplyingTo(null);
    setShowSlashCommands(false);
    setShowEmojiPicker(false);
    setShowPlusMenu(false);
    setUploadError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Upload Media (photo/video)
  const handleMediaSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowPlusMenu(false);
    setUploadError(null);
    setIsUploadingAttachment(true);

    try {
      const res = await api.upload.media(file);
      setPendingAttachment({
        id: res.id,
        type: res.type,
        name: res.name,
        url: res.url,
        size: res.size,
        mimeType: res.mimeType
      });
      inputRef.current?.focus();
    } catch (err: any) {
      setUploadError(err.message || 'Falha ao enviar foto ou vídeo.');
    } finally {
      setIsUploadingAttachment(false);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  // Upload File (documents, zip, txt, etc.)
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setShowPlusMenu(false);
    setUploadError(null);
    setIsUploadingAttachment(true);

    try {
      const res = await api.upload.file(file);
      setPendingAttachment({
        id: res.id,
        type: 'file',
        name: res.name,
        url: res.url,
        size: res.size,
        mimeType: res.mimeType
      });
      inputRef.current?.focus();
    } catch (err: any) {
      setUploadError(err.message || 'Falha ao enviar arquivo.');
    } finally {
      setIsUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const insertEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const applySlashCommand = (cmd: string) => {
    setInputText(cmd + ' ');
    setShowSlashCommands(false);
    inputRef.current?.focus();
  };

  // Filter messages based on search query
  const filteredMessages = searchQuery
    ? uniqueMessages.filter(m =>
        m &&
        ((m.content && m.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (m.author?.name && m.author.name.toLowerCase().includes(searchQuery.toLowerCase())))
      )
    : uniqueMessages;

  const pinnedMessages = uniqueMessages.filter(m => m?.isPinned);

  // Render markdown with rich styling
  const renderMarkdown = (content: string, messageId: string) => {
    if (!content) return null;
    const lines = content.split('\n');

    return (
      <div className="space-y-1 text-[15px] leading-relaxed text-[#dbdee1] break-words">
        {lines.map((line, lIdx) => {
          if (line.startsWith('> ')) {
            return (
              <div key={lIdx} className="pl-3 border-l-4 border-[#4e5058] text-[#949ba4] italic my-1">
                {line.slice(2)}
              </div>
            );
          }

          if (line.startsWith('```')) {
            return (
              <pre key={lIdx} className="bg-[#1e1f22] p-3 rounded-md text-xs font-mono text-[#e8eaed] overflow-x-auto border border-[#2b2d31] my-1">
                <code>{line.replace(/```[a-z]*/i, '')}</code>
              </pre>
            );
          }

          const parts = line.split(/(\*\*.*?\*\*|`.*?`|\|\|.*?\|\||@[a-zA-Z0-9_]+)/g);

          return (
            <p key={lIdx} className="min-h-[1.2rem]">
              {parts.map((part, pIdx) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <strong key={pIdx} className="font-bold text-white">{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith('`') && part.endsWith('`')) {
                  return (
                    <code key={pIdx} className="px-1.5 py-0.5 rounded bg-[#1e1f22] text-[#e8eaed] font-mono text-[13px] border border-[#2b2d31]">
                      {part.slice(1, -1)}
                    </code>
                  );
                }
                if (part.startsWith('||') && part.endsWith('||')) {
                  const spoilerKey = `${messageId}-${lIdx}-${pIdx}`;
                  const isRevealed = revealedSpoilers[spoilerKey];
                  return (
                    <span
                      key={pIdx}
                      onClick={() => setRevealedSpoilers(prev => ({ ...prev, [spoilerKey]: !prev[spoilerKey] }))}
                      className={isRevealed ? 'spoiler-revealed' : 'spoiler-hidden px-1 cursor-pointer'}
                      title="Clique para ver o spoiler"
                    >
                      {part.slice(2, -2)}
                    </span>
                  );
                }
                if (part.startsWith('@')) {
                  return (
                    <span key={pIdx} className="px-1 py-0.2 rounded bg-[#5865F2]/20 text-[#c9cdfb] font-semibold hover:bg-[#5865F2]/40 transition-colors cursor-pointer">
                      {part}
                    </span>
                  );
                }
                return part;
              })}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <main id="chat-area-main" className="flex-1 flex flex-col bg-[#313338] h-full overflow-hidden relative">
      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          id="image-lightbox-modal"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in"
        >
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <a
              href={lightboxImage.url}
              download={lightboxImage.name}
              target="_blank"
              rel="noreferrer"
              onClick={e => e.stopPropagation()}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors flex items-center gap-1.5 text-xs"
              title="Baixar imagem original"
            >
              <Download size={16} />
              <span>Baixar</span>
            </a>
            <button
              onClick={() => setLightboxImage(null)}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
              title="Fechar"
            >
              <X size={20} />
            </button>
          </div>
          <img
            src={lightboxImage.url}
            alt={lightboxImage.name}
            onClick={e => e.stopPropagation()}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
          />
          <span className="text-xs text-gray-300 mt-3 font-medium bg-black/40 px-3 py-1 rounded-full">
            {lightboxImage.name}
          </span>
        </div>
      )}

      {/* Hidden File Inputs for "+" Upload Options */}
      <input
        ref={mediaInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
        onChange={handleMediaSelected}
        className="hidden"
        id="input-upload-media"
      />
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelected}
        className="hidden"
        id="input-upload-file"
      />

      {/* Header */}
      <header
        id="chat-header"
        className="h-12 border-b border-[#1f2023]/60 px-4 flex items-center justify-between shadow-sm shrink-0 bg-[#313338] z-10"
      >
        <div className="flex items-center gap-2">
          {dmRecipient ? (
            <div className="flex items-center gap-2">
              <AtSign size={20} className="text-[#80848e]" />
              <span className="font-semibold text-white text-[15px]">
                {dmRecipient.name}
              </span>
              <span className="text-xs text-[#949ba4]">
                @{dmRecipient.username}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Hash size={20} className="text-[#80848e]" />
              <span className="font-semibold text-white text-[15px]">
                {channel?.name || 'chat-geral'}
              </span>
              {channel?.topic && (
                <span className="text-xs text-[#949ba4] border-l border-[#4e5058] pl-2 hidden md:inline truncate max-w-sm">
                  {channel.topic}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Header Tools */}
        <div className="flex items-center gap-3">
          {/* Direct Voice Call Button (Only in DM) */}
          {dmRecipient && onStartVoiceCall && (
            <button
              id="btn-header-voice-call"
              onClick={() => onStartVoiceCall(dmRecipient)}
              className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              title={`Iniciar chamada de voz com @${dmRecipient.username}`}
            >
              <Phone size={16} />
              <span className="hidden sm:inline">Ligar</span>
            </button>
          )}

          {/* Pinned Messages Button */}
          <button
            id="btn-pinned-messages"
            onClick={() => setShowPinnedModal(!showPinnedModal)}
            className={`text-[#b5bac1] hover:text-white transition-colors relative cursor-pointer ${
              showPinnedModal ? 'text-white' : ''
            }`}
            title="Mensagens fixadas"
          >
            <Pin size={20} />
            {pinnedMessages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#5865F2] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {pinnedMessages.length}
              </span>
            )}
          </button>

          {/* Toggle Members Sidebar */}
          {!dmRecipient && (
            <button
              id="btn-toggle-members"
              onClick={onToggleMemberList}
              className={`text-[#b5bac1] hover:text-white transition-colors cursor-pointer ${
                isMemberListVisible ? 'text-white' : ''
              }`}
              title="Lista de membros"
            >
              <Users size={20} />
            </button>
          )}

          {/* Chat Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-[#1e1f22] text-[#dbdee1] placeholder-[#949ba4] text-xs rounded px-2 py-1 pr-6 focus:outline-none focus:w-48 w-36 transition-all"
            />
            <Search size={14} className="absolute right-1.5 top-1.5 text-[#949ba4] pointer-events-none" />
          </div>
        </div>
      </header>

      {/* Pinned Messages Popover */}
      {showPinnedModal && (
        <div className="absolute top-14 right-4 w-80 max-h-96 bg-[#2b2d31] border border-[#1f2023] rounded-xl shadow-2xl z-40 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[#1f2023] flex items-center justify-between font-bold text-sm text-[#f2f3f5]">
            <div className="flex items-center gap-1.5">
              <Pin size={16} />
              <span>Mensagens Fixadas</span>
            </div>
            <button
              onClick={() => setShowPinnedModal(false)}
              className="text-[#949ba4] hover:text-white p-1 cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          <div className="p-3 overflow-y-auto space-y-3 flex-1 [scrollbar-width:thin]">
            {pinnedMessages.length === 0 ? (
              <p className="text-xs text-[#949ba4] text-center py-4">Nenhuma mensagem fixada.</p>
            ) : (
              pinnedMessages.map(pm => (
                <div key={pm.id} className="p-2.5 bg-[#1e1f22] rounded-lg border border-[#35373c] space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white">{pm.author.name}</span>
                    <span className="text-[10px] text-[#949ba4]">{pm.timestamp}</span>
                  </div>
                  <p className="text-xs text-[#dbdee1] line-clamp-3">{pm.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div
        id="messages-feed"
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 [scrollbar-width:thin]"
      >
        {/* Welcome Banner */}
        <div className="py-6 border-b border-[#35373c]/60">
          <div className="w-16 h-16 rounded-full bg-[#404249] flex items-center justify-center text-white mb-3 shadow-md">
            {dmRecipient ? <AtSign size={36} /> : <Hash size={36} />}
          </div>
          <h2 className="text-2xl font-bold text-[#f2f3f5]">
            {dmRecipient ? dmRecipient.name : `#${channel?.name || 'chat'}`}
          </h2>
          <p className="text-sm text-[#949ba4] mt-1">
            {dmRecipient
              ? `Esse é o início da sua conversa privada com @${dmRecipient.username}.`
              : `Esse é o início do canal #${channel?.name || 'chat'}.`}
          </p>
        </div>

        {/* Message List */}
        {filteredMessages.map((msg, index) => {
          const isOwn = msg.author.id === currentUser.id;
          const prevMsg = filteredMessages[index - 1];
          const isConsecutive = prevMsg && prevMsg.author.id === msg.author.id;

          return (
            <div
              key={msg.id}
              id={`message-${msg.id}`}
              className="relative group -mx-4 px-4 py-1 hover:bg-[#2e3035]/60 transition-colors flex flex-col"
            >
              {/* Reply Quote Banner */}
              {msg.replyTo && (
                <div className="flex items-center gap-1.5 text-xs text-[#b5bac1] mb-1 pl-6 relative before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-0 before:w-3 before:border-l-2 before:border-t-2 before:border-[#4e5058] before:rounded-tl">
                  <Reply size={12} className="rotate-180" />
                  <span className="font-semibold text-white">@{msg.replyTo.authorName}</span>
                  <span className="truncate max-w-xs text-[#949ba4]">{msg.replyTo.content}</span>
                </div>
              )}

              <div className="flex gap-4">
                {/* Avatar */}
                {!isConsecutive ? (
                  <img
                    src={msg.author.avatar}
                    alt={msg.author.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0 mt-0.5"
                  />
                ) : (
                  <div className="w-10 shrink-0 text-right pr-2 opacity-0 group-hover:opacity-100 text-[10px] text-[#949ba4] select-none">
                    {msg.timestamp.split('at ')[1] || ''}
                  </div>
                )}

                {/* Message Body */}
                <div className="flex-1 min-w-0">
                  {!isConsecutive && (
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span
                        className="text-[15px] font-semibold hover:underline cursor-pointer"
                        style={{ color: msg.author.roleColor || '#f2f3f5' }}
                      >
                        {msg.author.name}
                      </span>

                      {msg.author.isBot && (
                        <span className="px-1 py-0.2 bg-[#5865F2] text-white text-[9px] font-bold rounded">
                          BOT
                        </span>
                      )}

                      <span className="text-[11px] text-[#949ba4]">
                        {msg.timestamp}
                      </span>

                      {msg.isPinned && (
                        <Pin size={12} className="text-[#f59e0b] ml-1" title="Fixada" />
                      )}
                    </div>
                  )}

                  {/* Message Content */}
                  {msg.content && renderMarkdown(msg.content, msg.id)}

                  {/* Attachments Section */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {msg.attachments.map(att => (
                        <div key={att.id} className="max-w-md">
                          {/* Image Attachment */}
                          {att.type === 'image' && (
                            <div className="relative group/att rounded-xl overflow-hidden border border-[#2b2d31] bg-[#1e1f22] inline-block">
                              <img
                                src={att.url}
                                alt={att.name}
                                className="max-h-72 w-auto object-cover rounded-xl cursor-pointer hover:opacity-95 transition-opacity"
                                onClick={() => setLightboxImage({ url: att.url, name: att.name })}
                              />
                              <div
                                onClick={() => setLightboxImage({ url: att.url, name: att.name })}
                                className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg opacity-0 group-hover/att:opacity-100 transition-opacity cursor-pointer"
                                title="Expandir imagem"
                              >
                                <Maximize2 size={14} />
                              </div>
                            </div>
                          )}

                          {/* Video Attachment */}
                          {att.type === 'video' && (
                            <div className="rounded-xl overflow-hidden border border-[#2b2d31] bg-black max-w-lg">
                              <video
                                src={att.url}
                                controls
                                playsInline
                                preload="metadata"
                                className="w-full max-h-80 rounded-xl"
                              >
                                Seu navegador não suporta a tag de vídeo.
                              </video>
                              <div className="p-2 bg-[#1e1f22] text-xs text-[#b5bac1] flex items-center justify-between">
                                <span className="truncate">{att.name}</span>
                                <span className="text-[#80848e]">{formatFileSize(att.size)}</span>
                              </div>
                            </div>
                          )}

                          {/* Generic File Attachment */}
                          {att.type === 'file' && (
                            <div className="p-3 bg-[#1e1f22] border border-[#35373c] rounded-xl flex items-center justify-between gap-3 hover:border-[#5865F2]/50 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2.5 bg-[#2b2d31] rounded-lg text-[#5865F2]">
                                  {att.name.endsWith('.pdf') ? (
                                    <FileText size={20} />
                                  ) : att.name.endsWith('.zip') || att.name.endsWith('.rar') ? (
                                    <FileArchive size={20} />
                                  ) : (
                                    <FileIcon size={20} />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-white truncate max-w-xs" title={att.name}>
                                    {att.name}
                                  </div>
                                  <div className="text-xs text-[#949ba4]">
                                    {formatFileSize(att.size)}
                                  </div>
                                </div>
                              </div>

                              <a
                                href={att.url}
                                download={att.name}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 bg-[#2b2d31] hover:bg-[#5865F2] text-[#b5bac1] hover:text-white rounded-lg transition-colors shrink-0"
                                title="Baixar arquivo"
                              >
                                <Download size={18} />
                              </a>
                            </div>
                          )}

                          {/* Web prototype attachment */}
                          {att.type === 'web' && (
                            <div className="p-3 bg-[#1e1f22] border border-[#5865F2]/40 rounded-xl space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#5865F2] flex items-center gap-1">
                                  <Sparkles size={14} /> Protótipo Interativo
                                </span>
                                {onOpenWebPreview && (
                                  <button
                                    onClick={() => onOpenWebPreview(att.url, att.name)}
                                    className="text-xs text-white bg-[#5865F2] hover:bg-[#4752c4] px-2.5 py-1 rounded font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                  >
                                    <span>Ver Demonstração</span>
                                    <ExternalLink size={12} />
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-[#949ba4]">{att.name}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Emoji Reactions */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {msg.reactions.map((react, rIdx) => {
                        const hasReacted = react.users.includes(currentUser.id);
                        return (
                          <button
                            key={rIdx}
                            onClick={() => onAddReaction(msg.id, react.emoji)}
                            className={`px-2 py-0.5 rounded-[6px] text-xs flex items-center gap-1.5 transition-colors border cursor-pointer ${
                              hasReacted
                                ? 'bg-[#5865F2]/20 border-[#5865F2] text-white'
                                : 'bg-[#2b2d31] border-transparent text-[#dbdee1] hover:bg-[#35373c]'
                            }`}
                          >
                            <span>{react.emoji}</span>
                            <span className="font-semibold text-[11px]">{react.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Message Hover Quick Actions */}
              <div className="absolute right-4 top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 bg-[#313338] border border-[#232428] rounded-md shadow-lg flex items-center py-0.5 px-1 gap-1 transition-opacity z-20">
                <button
                  onClick={() => onAddReaction(msg.id, '🍗')}
                  className="p-1.5 text-[#b5bac1] hover:text-[#f59e0b] hover:bg-[#35373c] rounded transition-colors cursor-pointer"
                  title="Reagir com Nuggets"
                >
                  🍗
                </button>
                <button
                  onClick={() => onAddReaction(msg.id, '❤️')}
                  className="p-1.5 text-[#b5bac1] hover:text-[#f23f43] hover:bg-[#35373c] rounded transition-colors cursor-pointer"
                  title="Reagir com Coração"
                >
                  ❤️
                </button>
                <button
                  onClick={() => onAddReaction(msg.id, '👍')}
                  className="p-1.5 text-[#b5bac1] hover:text-[#23a55a] hover:bg-[#35373c] rounded transition-colors cursor-pointer"
                  title="Reagir com Joinha"
                >
                  👍
                </button>
                <button
                  onClick={() => setReplyingTo(msg)}
                  className="p-1.5 text-[#b5bac1] hover:text-white hover:bg-[#35373c] rounded transition-colors cursor-pointer"
                  title="Responder"
                >
                  <Reply size={16} />
                </button>
                <button
                  onClick={() => onTogglePin(msg.id)}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                    msg.isPinned
                      ? 'text-[#f59e0b] hover:bg-[#35373c]'
                      : 'text-[#b5bac1] hover:text-white hover:bg-[#35373c]'
                  }`}
                  title={msg.isPinned ? 'Desafixar' : 'Fixar'}
                >
                  <Pin size={16} />
                </button>
                {isOwn && (
                  <button
                    onClick={() => onDeleteMessage(msg.id)}
                    className="p-1.5 text-[#b5bac1] hover:text-[#f23f43] hover:bg-[#35373c] rounded transition-colors cursor-pointer"
                    title="Excluir mensagem"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* AI Generating Indicator */}
        {isAiGenerating && (
          <div className="flex items-center gap-3 p-3 bg-[#2b2d31]/50 border border-[#5865F2]/30 rounded-lg max-w-md animate-pulse">
            <Sparkles size={18} className="text-[#5865F2] animate-spin" />
            <span className="text-xs text-[#dbdee1] font-medium">
              Nuggets AI está redigindo uma resposta...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <footer id="chat-footer" className="px-4 pb-4 pt-1 shrink-0 relative">
        {/* Reply Quote Indicator */}
        {replyingTo && (
          <div className="bg-[#2b2d31] rounded-t-lg px-3 py-1.5 flex items-center justify-between text-xs text-[#b5bac1] border-b border-[#1f2023]">
            <div className="flex items-center gap-2 truncate">
              <Reply size={12} className="text-[#5865F2]" />
              <span>Respondendo a <strong className="text-white">@{replyingTo.author.name}</strong>:</span>
              <span className="italic truncate max-w-sm text-[#949ba4]">{replyingTo.content}</span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 hover:text-white rounded cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Pending Attachment Preview */}
        {pendingAttachment && (
          <div className="bg-[#2b2d31] border border-[#1f2023] rounded-t-xl p-3 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-3 min-w-0">
              {pendingAttachment.type === 'image' && (
                <img
                  src={pendingAttachment.url}
                  alt={pendingAttachment.name}
                  className="w-12 h-12 rounded-lg object-cover border border-[#3f4147]"
                />
              )}
              {pendingAttachment.type === 'video' && (
                <div className="w-12 h-12 rounded-lg bg-[#1e1f22] flex items-center justify-center text-indigo-400 border border-[#3f4147]">
                  <Film size={22} />
                </div>
              )}
              {pendingAttachment.type === 'file' && (
                <div className="w-12 h-12 rounded-lg bg-[#1e1f22] flex items-center justify-center text-emerald-400 border border-[#3f4147]">
                  <FileIcon size={22} />
                </div>
              )}
              <div className="min-w-0">
                <span className="text-xs font-semibold text-white truncate block">
                  {pendingAttachment.name}
                </span>
                <span className="text-[11px] text-[#949ba4]">
                  {formatFileSize(pendingAttachment.size)} • Pronto para enviar
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setPendingAttachment(null)}
              className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-[#35373c] rounded-lg transition-colors cursor-pointer"
              title="Remover anexo"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Upload Error Alert */}
        {uploadError && (
          <div className="bg-red-500/15 border border-red-500/30 text-red-400 text-xs px-3 py-1.5 rounded-t-lg flex items-center justify-between">
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Upload Loading Banner */}
        {isUploadingAttachment && (
          <div className="bg-[#2b2d31] rounded-t-xl px-4 py-2 border-b border-[#1f2023] flex items-center gap-2 text-xs text-indigo-400 font-medium">
            <Loader2 size={14} className="animate-spin" />
            <span>Fazendo upload do arquivo para o servidor...</span>
          </div>
        )}

        {/* Input Bar Form */}
        <form
          onSubmit={handleSend}
          className={`relative bg-[#383a40] rounded-xl flex items-center px-4 py-2.5 gap-3 shadow-inner ${
            replyingTo || pendingAttachment || isUploadingAttachment ? 'rounded-t-none border-t-0' : ''
          }`}
        >
          {/* Quick Actions (+) Button and Popover Menu */}
          <div className="relative" ref={plusMenuRef}>
            <button
              id="btn-chat-plus"
              type="button"
              onClick={() => setShowPlusMenu(!showPlusMenu)}
              className={`transition-transform cursor-pointer ${
                showPlusMenu ? 'text-white rotate-45' : 'text-[#b5bac1] hover:text-white'
              }`}
              title="Adicionar anexo (Foto, Vídeo ou Arquivo)"
            >
              <PlusCircle size={22} />
            </button>

            {/* Popover Menu with Options */}
            {showPlusMenu && (
              <div
                id="plus-actions-popover"
                className="absolute bottom-12 left-0 w-60 bg-[#2b2d31] border border-[#1f2023] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 animate-in zoom-in-95"
              >
                <div className="px-3 py-1 text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">
                  Enviar Conteúdo
                </div>

                <button
                  id="btn-opt-photo-video"
                  type="button"
                  onClick={() => mediaInputRef.current?.click()}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs text-[#dbdee1] hover:bg-[#5865F2] hover:text-white transition-colors cursor-pointer"
                >
                  <div className="p-1.5 rounded-md bg-[#1e1f22] text-emerald-400">
                    <ImageIcon size={16} />
                  </div>
                  <div>
                    <div className="font-semibold">Foto ou vídeo</div>
                    <div className="text-[10px] text-[#949ba4] group-hover:text-white/80">JPG, PNG, WEBP, GIF, MP4</div>
                  </div>
                </button>

                <button
                  id="btn-opt-upload-file"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-left text-xs text-[#dbdee1] hover:bg-[#5865F2] hover:text-white transition-colors cursor-pointer"
                >
                  <div className="p-1.5 rounded-md bg-[#1e1f22] text-indigo-400">
                    <FileIcon size={16} />
                  </div>
                  <div>
                    <div className="font-semibold">Enviar arquivo</div>
                    <div className="text-[10px] text-[#949ba4] group-hover:text-white/80">PDF, DOCX, ZIP, TXT, etc.</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              dmRecipient
                ? `Conversar com @${dmRecipient.username}`
                : `Conversar em #${channel?.name || 'chat'} (digite / para comandos)`
            }
            className="flex-1 bg-transparent text-[#dbdee1] placeholder-[#80848e] text-[15px] focus:outline-none"
            autoFocus
          />

          {/* Slash Commands Dropdown */}
          {showSlashCommands && (
            <div className="absolute bottom-14 left-0 w-72 bg-[#2b2d31] border border-[#1f2023] rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1 text-xs">
              <div className="px-2 py-1 font-bold text-[#949ba4] uppercase tracking-wider text-[10px]">
                Comandos do Nuggets
              </div>
              <button
                type="button"
                onClick={() => applySlashCommand('/ask')}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#5865F2] hover:text-white text-left transition-colors text-[#dbdee1] cursor-pointer"
              >
                <Sparkles size={14} className="text-[#5865F2]" />
                <div>
                  <div className="font-bold">/ask &lt;pergunta&gt;</div>
                  <div className="text-[11px] text-[#949ba4]">Pergunte qualquer coisa à IA</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => applySlashCommand('/roll')}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#5865F2] hover:text-white text-left transition-colors text-[#dbdee1] cursor-pointer"
              >
                <span>🎲</span>
                <div>
                  <div className="font-bold">/roll</div>
                  <div className="text-[11px] text-[#949ba4]">Rolar um dado de 100 lados</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => applySlashCommand('/web')}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#5865F2] hover:text-white text-left transition-colors text-[#dbdee1] cursor-pointer"
              >
                <Code size={14} className="text-[#f59e0b]" />
                <div>
                  <div className="font-bold">/web &lt;componente&gt;</div>
                  <div className="text-[11px] text-[#949ba4]">Gerar snippet UI interativo</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => applySlashCommand('/help')}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#5865F2] hover:text-white text-left transition-colors text-[#dbdee1] cursor-pointer"
              >
                <span>💡</span>
                <div>
                  <div className="font-bold">/help</div>
                  <div className="text-[11px] text-[#949ba4]">Ver diretrizes e comandos</div>
                </div>
              </button>
            </div>
          )}

          {/* Emoji Picker Button */}
          <div className="relative">
            <button
              id="btn-emoji-picker"
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-[#b5bac1] hover:text-white transition-colors cursor-pointer"
              title="Selecionar Emoji"
            >
              <Smile size={22} />
            </button>

            {/* Quick Emoji Popover */}
            {showEmojiPicker && (
              <div className="absolute bottom-12 right-0 bg-[#2b2d31] border border-[#1f2023] rounded-xl shadow-2xl p-2.5 z-50 grid grid-cols-4 gap-1.5 w-48">
                {COMMON_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insertEmoji(emoji)}
                    className="w-9 h-9 flex items-center justify-center text-xl hover:bg-[#35373c] rounded-lg transition-colors cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Send Button */}
          <button
            id="btn-send-message"
            type="submit"
            disabled={(!inputText.trim() && !pendingAttachment) || isUploadingAttachment}
            className={`p-2 rounded-full transition-all cursor-pointer ${
              inputText.trim() || pendingAttachment
                ? 'bg-[#5865F2] text-white hover:bg-[#4752c4] shadow'
                : 'text-[#80848e] cursor-not-allowed opacity-50'
            }`}
            title="Enviar mensagem"
          >
            <Send size={16} />
          </button>
        </form>
      </footer>
    </main>
  );
};
