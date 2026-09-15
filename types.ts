export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline';

export type UserRole = 'Owner' | 'Admin' | 'Moderator' | 'Member' | 'Bot';

export interface UserActivity {
  type: 'playing' | 'listening' | 'streaming' | 'coding';
  name: string;
  details?: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  status: UserStatus;
  customStatus?: string;
  activity?: UserActivity;
  role: UserRole;
  roleColor?: string;
  isBot?: boolean;
  joinedAt?: string;
  aboutMe?: string;
  notificationSettings?: {
    messagesEnabled?: boolean;
    friendRequestsEnabled?: boolean;
    mentionsEnabled?: boolean;
    incomingCallsEnabled?: boolean;
    serverMessagesEnabled?: boolean;
    soundEnabled?: boolean;
    showContent?: boolean;
  };
  serverSettings?: Record<string, {
    notifyLevel?: 'all' | 'mentions' | 'nothing';
    mutedUntil?: string | null;
  }>;
  channelSettings?: Record<string, {
    notifyLevel?: 'all' | 'mentions' | 'nothing';
  }>;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[]; // user IDs who reacted
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'video' | 'file' | 'code' | 'web';
  name: string;
  url: string;
  size?: string | number;
  mimeType?: string;
  previewUrl?: string;
}

export interface Message {
  id: string;
  channelId: string;
  author: User;
  content: string;
  timestamp: string;
  edited?: boolean;
  reactions: MessageReaction[];
  attachments?: MessageAttachment[];
  replyTo?: {
    id: string;
    authorName: string;
    content: string;
  };
  isPinned?: boolean;
}

export type ChannelType = 'text' | 'voice' | 'announcement';

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  topic?: string;
  categoryId: string;
  unreadCount?: number;
}

export interface ChannelCategory {
  id: string;
  name: string;
}

export interface Server {
  id: string;
  name: string;
  initials: string;
  icon?: string;
  iconBg: string;
  banner?: string;
  description: string;
  categories: ChannelCategory[];
  channels: Channel[];
  members: User[];
  isOwner?: boolean;
}

export interface DirectMessageConversation {
  id: string;
  recipient: User;
  unreadCount: number;
}

export interface Friend {
  requestId?: string;
  user: User;
  relationship: 'friend' | 'pending_incoming' | 'pending_outgoing' | 'blocked';
  createdAt?: string;
}

export interface VoiceChannelState {
  connected: boolean;
  serverId: string | null;
  serverName: string | null;
  channelId: string | null;
  channelName: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isScreenSharing: boolean;
  isVideo: boolean;
  speakingUserIds: string[];
}
