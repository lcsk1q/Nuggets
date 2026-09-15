import React, { useState, useEffect, useCallback } from 'react';
import { ServerSidebar } from './components/ServerSidebar';
import { ChannelSidebar } from './components/ChannelSidebar';
import { DirectMessagesSidebar } from './components/DirectMessagesSidebar';
import { ChatArea } from './components/ChatArea';
import { MemberList } from './components/MemberList';
import { VoiceOverlay } from './components/VoiceOverlay';
import { FriendsView } from './components/FriendsView';
import { SettingsModal } from './components/SettingsModal';
import { CreateServerModal } from './components/CreateServerModal';
import { CreateChannelModal } from './components/CreateChannelModal';
import { MemberProfileModal } from './components/MemberProfileModal';
import { WebPreviewModal } from './components/WebPreviewModal';
import { AuthView } from './components/AuthView';

import {
  Server,
  Channel,
  User,
  Message,
  Friend,
  DirectMessageConversation,
  UserStatus,
  VoiceChannelState,
  ChannelType,
  MessageAttachment
} from './types';

import { api, tokenStorage } from './services/api';
import { realtime } from './services/websocket';
import { webrtcService, CallState, CallPeerInfo } from './services/webrtcService';
import { notificationService } from './services/notificationService';
import { IncomingCallModal } from './components/IncomingCallModal';
import { ActiveCallModal } from './components/ActiveCallModal';

export function App() {
  // Authentication & Initialization State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Core Navigation State
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServerId, setActiveServerId] = useState<string | null>(null); // null = Home / DMs
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeDmId, setActiveDmId] = useState<string | null>(null);
  const [isFriendsTabActive, setIsFriendsTabActive] = useState<boolean>(true);

  // Social & Messaging State
  const [friends, setFriends] = useState<Friend[]>([]);
  const [dms, setDms] = useState<DirectMessageConversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);

  // Real WebRTC Audio Calling State
  const [callState, setCallState] = useState<CallState>('idle');
  const [callTarget, setCallTarget] = useState<CallPeerInfo | null>(null);
  const [incomingCaller, setIncomingCaller] = useState<CallPeerInfo | null>(null);
  const [callEndReason, setCallEndReason] = useState<string | undefined>();

  // Voice Connection State
  const [voiceState, setVoiceState] = useState<VoiceChannelState>({
    connected: false,
    serverId: null,
    serverName: null,
    channelId: null,
    channelName: null,
    isMuted: false,
    isDeafened: false,
    isScreenSharing: false,
    isVideo: false,
    speakingUserIds: []
  });

  // UI Panels & Modals
  const [isMemberListVisible, setIsMemberListVisible] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [selectedMemberForProfile, setSelectedMemberForProfile] = useState<User | null>(null);
  const [webPreviewData, setWebPreviewData] = useState<{ html: string; title: string } | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Safe array references
  const safeServers = Array.isArray(servers) ? servers : [];
  const safeDms = Array.isArray(dms) ? dms : [];
  const safeFriends = Array.isArray(friends) ? friends : [];

  // Helper getters
  const activeServer = safeServers.find(s => s.id === activeServerId) || null;
  const activeChannel = activeServer?.channels ? activeServer.channels.find(c => c.id === activeChannelId) || null : null;
  const activeDmConversation = safeDms.find(d => d.id === activeDmId) || null;
  const unreadDmCount = safeDms.reduce((acc, curr) => acc + (curr?.unreadCount || 0), 0);
  const onlineFriendsCount = safeFriends.filter(f => f?.relationship === 'friend' && f?.user?.status && f.user.status !== 'offline').length;

  // 1. Initial Session Check
  useEffect(() => {
    async function checkAuth() {
      const token = tokenStorage.get();
      if (!token) {
        setIsAuthChecking(false);
        return;
      }
      try {
        const user = await api.auth.me();
        setCurrentUser(user);
      } catch (err) {
        console.warn('Session expired or invalid:', err);
        tokenStorage.remove();
        setCurrentUser(null);
      } finally {
        setIsAuthChecking(false);
      }
    }
    checkAuth();
  }, []);

  // 2. Fetch Initial App Data upon login
  const loadUserData = useCallback(async () => {
    try {
      const [friendsList, dmsList, serversList] = await Promise.all([
        api.friends.get(),
        api.conversations.get(),
        api.servers.get()
      ]);
      setFriends(Array.isArray(friendsList) ? friendsList : []);
      setDms(Array.isArray(dmsList) ? dmsList : []);
      setServers(Array.isArray(serversList) ? serversList : []);
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    // Connect WebSocket
    realtime.connect();

    // Load initial user data
    loadUserData();

    // Subscribe to WebRTC Voice Calling State
    const unsubWebRTC = webrtcService.subscribe((state, payload) => {
      setCallState(state);
      if (state === 'incoming' && payload?.caller) {
        setIncomingCaller(payload.caller);
        notificationService.notify({
          title: `Chamada de voz: ${payload.caller.name}`,
          body: 'Clique para atender',
          icon: payload.caller.avatar,
          type: 'call'
        });
      } else if (state === 'calling' && payload?.target) {
        setCallTarget(payload.target);
      } else if (state === 'connecting' || state === 'connected') {
        setCallTarget(webrtcService.targetUser);
      } else if (state === 'ended') {
        setCallEndReason(payload?.reason);
      } else if (state === 'idle') {
        setIncomingCaller(null);
        setCallTarget(null);
        setCallEndReason(undefined);
      }
    });

    // WebSocket Listeners
    const unsubMessage = realtime.on('chat:message', (payload: { message: Message; conversationId?: string; channelId?: string; serverId?: string }) => {
      const { message, conversationId, channelId } = payload;

      // If active conversation or channel matches, add only if not already in state (prevent duplicate)
      if (conversationId && activeServerId === null && activeDmId === conversationId) {
        setMessages(prev => (prev.some(m => m.id === message.id) ? prev : [...prev, message]));
      } else if (channelId && activeServerId && activeChannelId === channelId) {
        setMessages(prev => (prev.some(m => m.id === message.id) ? prev : [...prev, message]));
      }

      // Update DM conversations list unread / order
      if (conversationId) {
        setDms(prev => {
          const exists = prev.find(d => d.id === conversationId);
          if (exists) {
            return prev.map(d =>
              d.id === conversationId
                ? {
                    ...d,
                    unreadCount: activeDmId === conversationId ? 0 : (d.unreadCount || 0) + 1
                  }
                : d
            );
          } else {
            // New conversation incoming, reload conversations
            api.conversations.get().then(setDms).catch(console.error);
            return prev;
          }
        });
      }

      // Trigger notification if message is from another user
      if (message.author.id !== currentUser.id) {
        notificationService.notify({
          title: conversationId ? message.author.name : `#chat - ${message.author.name}`,
          body: message.content || (message.attachments?.length ? 'Enviou um anexo' : ''),
          icon: message.author.avatar,
          type: conversationId ? 'message' : 'server'
        });
      }
    });

    const unsubReaction = realtime.on('chat:reaction', (payload: { messageId: string; reactions: Message['reactions'] }) => {
      setMessages(prev =>
        prev.map(m => (m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m))
      );
    });

    const unsubDelete = realtime.on('chat:delete', (payload: { messageId: string }) => {
      setMessages(prev => prev.filter(m => m.id !== payload.messageId));
    });

    const unsubPin = realtime.on('chat:pin', (payload: { messageId: string; isPinned: boolean }) => {
      setMessages(prev =>
        prev.map(m => (m.id === payload.messageId ? { ...m, isPinned: payload.isPinned } : m))
      );
    });

    const unsubFriendReq = realtime.on('friend:request', () => {
      api.friends.get().then(setFriends).catch(console.error);
    });

    const unsubFriendAccepted = realtime.on('friend:accepted', () => {
      api.friends.get().then(setFriends).catch(console.error);
      api.conversations.get().then(setDms).catch(console.error);
    });

    const unsubPresence = realtime.on('presence:update', (payload: { userId: string; status: UserStatus; customStatus?: string }) => {
      setFriends(prev =>
        prev.map(f =>
          f.user.id === payload.userId
            ? { ...f, user: { ...f.user, status: payload.status, customStatus: payload.customStatus } }
            : f
        )
      );
      setDms(prev =>
        prev.map(d =>
          d.recipient.id === payload.userId
            ? { ...d, recipient: { ...d.recipient, status: payload.status, customStatus: payload.customStatus } }
            : d
        )
      );
      setServers(prev =>
        prev.map(s => ({
          ...s,
          members: s.members.map(m =>
            m.id === payload.userId ? { ...m, status: payload.status, customStatus: payload.customStatus } : m
          )
        }))
      );
    });

    const unsubServerUpdate = realtime.on('server:member_joined', () => {
      api.servers.get().then(setServers).catch(console.error);
    });

    const unsubChannelCreated = realtime.on('server:channel_created', () => {
      api.servers.get().then(setServers).catch(console.error);
    });

    return () => {
      unsubMessage();
      unsubReaction();
      unsubDelete();
      unsubPin();
      unsubFriendReq();
      unsubFriendAccepted();
      unsubPresence();
      unsubServerUpdate();
      unsubChannelCreated();
      unsubWebRTC();
      realtime.disconnect();
    };
  }, [currentUser, activeServerId, activeDmId, activeChannelId, loadUserData]);

  // 3. Load Messages when active DM or active Channel changes
  useEffect(() => {
    if (!currentUser) return;

    if (activeServerId === null && activeDmId && !isFriendsTabActive) {
      // Load DM messages
      setIsLoadingMessages(true);
      api.conversations
        .getMessages(activeDmId)
        .then(data => {
          setMessages(data);
          // Mark unread as 0 locally
          setDms(prev =>
            prev.map(d => (d.id === activeDmId ? { ...d, unreadCount: 0 } : d))
          );
        })
        .catch(err => console.error('Failed to load DM messages:', err))
        .finally(() => setIsLoadingMessages(false));
    } else if (activeServerId && activeChannelId) {
      // Load Channel messages
      setIsLoadingMessages(true);
      api.servers
        .getChannelMessages(activeServerId, activeChannelId)
        .then(setMessages)
        .catch(err => console.error('Failed to load channel messages:', err))
        .finally(() => setIsLoadingMessages(false));
    } else {
      setMessages([]);
    }
  }, [currentUser, activeServerId, activeDmId, activeChannelId, isFriendsTabActive]);

  // Handle successful login or register
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsFriendsTabActive(true);
    setActiveServerId(null);
    setActiveDmId(null);
  };

  // Handle Logout
  const handleLogout = () => {
    tokenStorage.remove();
    realtime.disconnect();
    setCurrentUser(null);
    setServers([]);
    setFriends([]);
    setDms([]);
    setMessages([]);
    setActiveServerId(null);
    setActiveDmId(null);
    setIsFriendsTabActive(true);
  };

  // Navigation handlers
  const handleSelectServer = (serverId: string | null) => {
    setActiveServerId(serverId);
    if (serverId === null) {
      // Switched to Home
      if (!activeDmId) {
        setIsFriendsTabActive(true);
      }
    } else {
      // Switched to Server: select first channel
      const server = servers.find(s => s.id === serverId);
      if (server && server.channels.length > 0) {
        setActiveChannelId(server.channels[0].id);
      } else {
        setActiveChannelId(null);
      }
      setIsFriendsTabActive(false);
    }
  };

  const handleSelectDm = (dmId: string) => {
    setActiveDmId(dmId);
    setIsFriendsTabActive(false);
    setActiveServerId(null);
  };

  const handleCloseDm = (dmId: string) => {
    setDms(prev => prev.filter(d => d.id !== dmId));
    if (activeDmId === dmId) {
      setActiveDmId(null);
      setIsFriendsTabActive(true);
    }
  };

  const handleStartDmWithUser = async (userId: string) => {
    try {
      const conv = await api.conversations.create(userId);
      setDms(prev => {
        if (prev.some(d => d.id === conv.id)) return prev;
        return [conv, ...prev];
      });
      setActiveServerId(null);
      setActiveDmId(conv.id);
      setIsFriendsTabActive(false);
    } catch (err) {
      console.error('Failed to start conversation:', err);
    }
  };

  const handleSelectChannel = (channel: Channel) => {
    setActiveChannelId(channel.id);
  };

  // Messaging Actions
  const handleSendMessage = async (
    content: string,
    replyToMessage?: Message,
    attachments?: MessageAttachment[]
  ) => {
    if (!currentUser) return;

    try {
      if (activeServerId === null && activeDmId) {
        const newMsg = await api.conversations.sendMessage(
          activeDmId,
          content,
          replyToMessage
            ? {
                id: replyToMessage.id,
                authorName: replyToMessage.author.name,
                content: replyToMessage.content
              }
            : undefined,
          attachments
        );
        // Guarantee no duplicate insertion if WebSocket event arrived earlier
        setMessages(prev => (prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]));
      } else if (activeServerId && activeChannelId) {
        const newMsg = await api.servers.sendChannelMessage(
          activeServerId,
          activeChannelId,
          content,
          replyToMessage
            ? {
                id: replyToMessage.id,
                authorName: replyToMessage.author.name,
                content: replyToMessage.content
              }
            : undefined,
          attachments
        );
        // Guarantee no duplicate insertion if WebSocket event arrived earlier
        setMessages(prev => (prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleReactMessage = async (messageId: string, emoji: string) => {
    try {
      const reactions = await api.messages.react(messageId, emoji);
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, reactions } : m))
      );
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await api.messages.delete(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handlePinMessage = async (messageId: string) => {
    try {
      const res = await api.messages.pin(messageId);
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, isPinned: res.isPinned } : m))
      );
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  // Server & Channel Management
  const handleCreateServer = async (name: string, description: string) => {
    try {
      const newServer = await api.servers.create(name, description);
      setServers(prev => [...prev, newServer]);
      setActiveServerId(newServer.id);
      if (newServer.channels.length > 0) {
        setActiveChannelId(newServer.channels[0].id);
      }
      setIsFriendsTabActive(false);
    } catch (err) {
      console.error('Failed to create server:', err);
    }
  };

  const handleJoinServer = async (inviteCode: string) => {
    try {
      const joinedServer = await api.servers.join(inviteCode);
      setServers(prev => {
        if (prev.some(s => s.id === joinedServer.id)) return prev;
        return [...prev, joinedServer];
      });
      setActiveServerId(joinedServer.id);
      if (joinedServer.channels.length > 0) {
        setActiveChannelId(joinedServer.channels[0].id);
      }
      setIsFriendsTabActive(false);
    } catch (err: any) {
      alert(err.message || 'Código de convite inválido');
    }
  };

  const handleCreateChannel = async (name: string, type: ChannelType, topic: string) => {
    if (!activeServerId) return;
    try {
      const newChannel = await api.servers.createChannel(activeServerId, name, type, topic);
      setServers(prev =>
        prev.map(s =>
          s.id === activeServerId ? { ...s, channels: [...s.channels, newChannel] } : s
        )
      );
      setActiveChannelId(newChannel.id);
    } catch (err) {
      console.error('Failed to create channel:', err);
    }
  };

  // Voice Controls
  const handleJoinVoiceChannel = (channel: Channel) => {
    if (!activeServer) return;
    setVoiceState(prev => ({
      ...prev,
      connected: true,
      serverId: activeServer.id,
      serverName: activeServer.name,
      channelId: channel.id,
      channelName: channel.name,
      speakingUserIds: [currentUser?.id || '']
    }));
  };

  const handleDisconnectVoice = () => {
    setVoiceState(prev => ({
      ...prev,
      connected: false,
      serverId: null,
      serverName: null,
      channelId: null,
      channelName: null,
      speakingUserIds: []
    }));
  };

  // User Profile & Status updates
  const handleUpdateStatus = async (status: UserStatus) => {
    if (!currentUser) return;
    try {
      const updated = await api.auth.updateStatus(status);
      setCurrentUser(updated);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const handleUpdateUser = async (updated: Partial<User>) => {
    if (!currentUser) return;
    try {
      const res = await api.auth.updateProfile(updated);
      setCurrentUser(res);
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  };

  const handleSendFriendRequest = async (username: string) => {
    try {
      const res = await api.friends.sendRequest(username);
      if (res.success) {
        await loadUserData();
        return { success: true };
      }
      return { success: false, error: 'Não foi possível enviar a solicitação.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erro ao adicionar amigo.' };
    }
  };

  const handleAcceptFriendRequest = async (requestId?: string, senderId?: string) => {
    try {
      await api.friends.accept(requestId, senderId);
      await loadUserData();
    } catch (err) {
      console.error('Error accepting friend request:', err);
    }
  };

  const handleRejectFriendRequest = async (requestId?: string, senderId?: string) => {
    try {
      await api.friends.reject(requestId, senderId);
      await loadUserData();
    } catch (err) {
      console.error('Error rejecting friend request:', err);
    }
  };

  // If checking authentication session on load
  if (isAuthChecking) {
    return (
      <div className="h-screen w-screen bg-[#1e1f22] flex flex-col items-center justify-center text-white select-none">
        <div className="w-16 h-16 rounded-2xl bg-[#5865F2] flex items-center justify-center shadow-2xl mb-4 animate-bounce text-3xl">
          🍗
        </div>
        <div className="text-lg font-semibold tracking-wide text-[#dbdee1] flex items-center gap-2">
          <span>Iniciando Nuggets</span>
          <div className="w-2 h-2 rounded-full bg-[#5865F2] animate-ping" />
        </div>
      </div>
    );
  }

  // If not logged in, show Auth Screen
  if (!currentUser) {
    return <AuthView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="h-screen w-screen bg-[#1e1f22] flex overflow-hidden font-sans select-none antialiased">
      {/* 1. Leftmost Server Sidebar */}
      <ServerSidebar
        servers={safeServers}
        activeServerId={activeServerId}
        onSelectServer={handleSelectServer}
        onOpenCreateServer={() => setIsCreateServerOpen(true)}
        unreadDmCount={unreadDmCount}
      />

      {/* 2. Sub-Sidebar: DMs Sidebar or Channel Sidebar */}
      {activeServerId === null ? (
        <DirectMessagesSidebar
          conversations={safeDms}
          activeDmId={activeDmId}
          onSelectDm={handleSelectDm}
          onCloseDm={handleCloseDm}
          onSelectFriendsTab={() => {
            setIsFriendsTabActive(true);
            setActiveDmId(null);
          }}
          isFriendsTabActive={isFriendsTabActive}
          currentUser={currentUser}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onUpdateStatus={handleUpdateStatus}
          onOpenProfile={() => setSelectedMemberForProfile(currentUser)}
          onlineFriendsCount={onlineFriendsCount}
          onLogout={handleLogout}
        />
      ) : activeServer ? (
        <ChannelSidebar
          server={activeServer}
          activeChannelId={activeChannelId || ''}
          onSelectChannel={handleSelectChannel}
          onOpenCreateChannel={() => setIsCreateChannelOpen(true)}
          voiceState={voiceState}
          onJoinVoiceChannel={handleJoinVoiceChannel}
          onDisconnectVoice={handleDisconnectVoice}
          currentUser={currentUser}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onUpdateStatus={handleUpdateStatus}
          onOpenProfile={() => setSelectedMemberForProfile(currentUser)}
          onLogout={handleLogout}
        />
      ) : null}

      {/* 3. Main Center Area: Friends View or Chat Area */}
      {activeServerId === null && isFriendsTabActive ? (
        <FriendsView
          friends={safeFriends}
          onStartDirectMessage={handleStartDmWithUser}
          onSendFriendRequest={handleSendFriendRequest}
          onAcceptRequest={handleAcceptFriendRequest}
          onRejectRequest={handleRejectFriendRequest}
          onStartVoiceCall={(targetUser) =>
            webrtcService.startCall({
              id: targetUser.id,
              name: targetUser.name,
              avatar: targetUser.avatar
            })
          }
        />
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          <ChatArea
            channel={activeChannel}
            dmRecipient={activeDmConversation?.recipient || undefined}
            messages={messages}
            currentUser={currentUser}
            onSendMessage={handleSendMessage}
            onAddReaction={handleReactMessage}
            onDeleteMessage={handleDeleteMessage}
            onTogglePin={handlePinMessage}
            onOpenWebPreview={(html, title) => setWebPreviewData({ html, title })}
            isMemberListVisible={isMemberListVisible}
            onToggleMemberList={() => setIsMemberListVisible(prev => !prev)}
            isAiGenerating={isAiGenerating}
            onStartVoiceCall={(targetUser) =>
              webrtcService.startCall({
                id: targetUser.id,
                name: targetUser.name,
                avatar: targetUser.avatar
              })
            }
          />

          {/* 4. Rightmost Member List (only in Server mode) */}
          {activeServer && isMemberListVisible && (
            <MemberList
              server={activeServer}
              onSelectMember={(member) => setSelectedMemberForProfile(member)}
            />
          )}
        </div>
      )}

      {/* Real WebRTC Call Modals */}
      {callState === 'incoming' && incomingCaller && (
        <IncomingCallModal
          caller={incomingCaller}
          onAccept={() => webrtcService.acceptCall()}
          onReject={() => webrtcService.rejectCall()}
        />
      )}

      {(callState === 'calling' || callState === 'connecting' || callState === 'connected' || callState === 'ended') && (
        <ActiveCallModal
          state={callState}
          targetUser={callTarget}
          reason={callEndReason}
          onEndCall={() => webrtcService.endCall()}
        />
      )}

      {/* Persistent Voice Overlay */}
      {voiceState.connected && (
        <VoiceOverlay
          voiceState={voiceState}
          currentUser={currentUser}
          participants={[]}
          onDisconnect={handleDisconnectVoice}
          onToggleMute={() => setVoiceState(prev => ({ ...prev, isMuted: !prev.isMuted }))}
          onToggleDeafen={() => setVoiceState(prev => ({ ...prev, isDeafened: !prev.isDeafened }))}
        />
      )}

      {/* Modals */}
      {isSettingsOpen && (
        <SettingsModal
          currentUser={currentUser}
          onClose={() => setIsSettingsOpen(false)}
          onUpdateUser={handleUpdateUser}
          onLogout={handleLogout}
        />
      )}

      {isCreateServerOpen && (
        <CreateServerModal
          onClose={() => setIsCreateServerOpen(false)}
          onCreate={handleCreateServer}
          onJoin={handleJoinServer}
        />
      )}

      {isCreateChannelOpen && (
        <CreateChannelModal
          onClose={() => setIsCreateChannelOpen(false)}
          onCreate={handleCreateChannel}
        />
      )}

      {selectedMemberForProfile && (
        <MemberProfileModal
          member={selectedMemberForProfile}
          currentUser={currentUser}
          onClose={() => setSelectedMemberForProfile(null)}
          onStartDm={(userId) => {
            setSelectedMemberForProfile(null);
            handleStartDmWithUser(userId);
          }}
        />
      )}

      {webPreviewData && (
        <WebPreviewModal
          html={webPreviewData.html}
          title={webPreviewData.title}
          onClose={() => setWebPreviewData(null)}
        />
      )}
    </div>
  );
}

export default App;
