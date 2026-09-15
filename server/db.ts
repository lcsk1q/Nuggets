import fs from 'fs';
import path from 'path';

export interface DbUser {
  id: string;
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  avatar: string;
  status: 'online' | 'idle' | 'dnd' | 'offline';
  customStatus?: string;
  aboutMe?: string;
  role: 'Owner' | 'Admin' | 'Member';
  createdAt: string;
  googleId?: string;
  blockedUserIds?: string[];
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

export interface DbFriendship {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: string;
}

export interface DbFriendRequest {
  id: string;
  senderId: string;
  receiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface DbConversation {
  id: string;
  type: 'dm' | 'group';
  updatedAt: string;
}

export interface DbConversationMember {
  conversationId: string;
  userId: string;
  joinedAt: string;
}

export interface DbMessageAttachment {
  id: string;
  type: 'image' | 'video' | 'file' | 'code' | 'web';
  name: string;
  url: string;
  size?: number | string;
  mimeType?: string;
  previewUrl?: string;
}

export interface DbMessage {
  id: string;
  conversationId?: string;
  channelId?: string;
  authorId: string;
  content: string;
  timestamp: string;
  replyTo?: {
    id: string;
    authorName: string;
    content: string;
  };
  reactions: Array<{
    emoji: string;
    count: number;
    users: string[];
  }>;
  attachments?: DbMessageAttachment[];
  isPinned?: boolean;
}

export interface DbServer {
  id: string;
  name: string;
  initials: string;
  iconBg: string;
  description: string;
  ownerId: string;
  inviteCode: string;
  createdAt: string;
}

export interface DbServerMember {
  serverId: string;
  userId: string;
  role: 'Owner' | 'Admin' | 'Member';
  joinedAt: string;
}

export interface DbChannel {
  id: string;
  serverId: string;
  name: string;
  type: 'text' | 'voice' | 'announcement';
  topic?: string;
  categoryId: string;
}

export interface DbCategory {
  id: string;
  serverId: string;
  name: string;
}

export interface DatabaseSchema {
  users: DbUser[];
  friendships: DbFriendship[];
  friend_requests: DbFriendRequest[];
  conversations: DbConversation[];
  conversation_members: DbConversationMember[];
  messages: DbMessage[];
  servers: DbServer[];
  server_members: DbServerMember[];
  channels: DbChannel[];
  channel_categories: DbCategory[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

const INITIAL_EMPTY_DB: DatabaseSchema = {
  users: [],
  friendships: [],
  friend_requests: [],
  conversations: [],
  conversation_members: [],
  messages: [],
  servers: [],
  server_members: [],
  channels: [],
  channel_categories: []
};

class JsonDatabase {
  private data: DatabaseSchema;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DB_FILE)) {
      this.data = JSON.parse(JSON.stringify(INITIAL_EMPTY_DB));
      this.saveSync();
    } else {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        // Ensure all arrays exist
        for (const key of Object.keys(INITIAL_EMPTY_DB) as (keyof DatabaseSchema)[]) {
          if (!Array.isArray(this.data[key])) {
            this.data[key] = [] as any;
          }
        }
      } catch (err) {
        console.error('Error reading database, reinitializing empty db:', err);
        this.data = JSON.parse(JSON.stringify(INITIAL_EMPTY_DB));
        this.saveSync();
      }
    }
  }

  private saveSync() {
    try {
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmp, DB_FILE);
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  // --- Users ---
  public findUserById(id: string): DbUser | undefined {
    return this.data.users.find(u => u.id === id);
  }

  public findUserByEmail(email: string): DbUser | undefined {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  }

  public findUserByUsername(username: string): DbUser | undefined {
    const clean = username.replace(/^@/, '').toLowerCase().trim();
    return this.data.users.find(u => u.username.toLowerCase() === clean);
  }

  public searchUsers(query: string, excludeUserId?: string): DbUser[] {
    const clean = query.replace(/^@/, '').toLowerCase().trim();
    if (!clean) return [];
    return this.data.users
      .filter(u => {
        if (excludeUserId && u.id === excludeUserId) return false;
        return (
          u.username.toLowerCase().includes(clean) ||
          u.displayName.toLowerCase().includes(clean)
        );
      })
      .slice(0, 10);
  }

  public createUser(user: DbUser): DbUser {
    this.data.users.push(user);
    this.saveSync();
    return user;
  }

  public updateUser(id: string, updates: Partial<DbUser>): DbUser | undefined {
    const user = this.findUserById(id);
    if (!user) return undefined;
    Object.assign(user, updates);
    this.saveSync();
    return user;
  }

  // --- Friendships & Requests ---
  public getFriends(userId: string): DbUser[] {
    const friendIds = new Set<string>();
    for (const f of this.data.friendships) {
      if (f.user1Id === userId) friendIds.add(f.user2Id);
      else if (f.user2Id === userId) friendIds.add(f.user1Id);
    }
    return Array.from(friendIds)
      .map(id => this.findUserById(id))
      .filter((u): u is DbUser => !!u);
  }

  public areFriends(user1Id: string, user2Id: string): boolean {
    return this.data.friendships.some(
      f => (f.user1Id === user1Id && f.user2Id === user2Id) ||
           (f.user1Id === user2Id && f.user2Id === user1Id)
    );
  }

  public getFriendRequests(userId: string) {
    const incoming = this.data.friend_requests
      .filter(r => r.receiverId === userId && r.status === 'pending')
      .map(r => ({
        request: r,
        sender: this.findUserById(r.senderId)
      }))
      .filter((item): item is { request: DbFriendRequest; sender: DbUser } => !!item.sender);

    const outgoing = this.data.friend_requests
      .filter(r => r.senderId === userId && r.status === 'pending')
      .map(r => ({
        request: r,
        receiver: this.findUserById(r.receiverId)
      }))
      .filter((item): item is { request: DbFriendRequest; receiver: DbUser } => !!item.receiver);

    return { incoming, outgoing };
  }

  public findPendingRequest(user1Id: string, user2Id: string): DbFriendRequest | undefined {
    return this.data.friend_requests.find(
      r => r.status === 'pending' &&
        ((r.senderId === user1Id && r.receiverId === user2Id) ||
         (r.senderId === user2Id && r.receiverId === user1Id))
    );
  }

  public createFriendRequest(senderId: string, receiverId: string): DbFriendRequest {
    const request: DbFriendRequest = {
      id: `freq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      senderId,
      receiverId,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    this.data.friend_requests.push(request);
    this.saveSync();
    return request;
  }

  public acceptFriendRequest(requestId: string, receiverId: string) {
    const req = this.data.friend_requests.find(r => r.id === requestId && r.receiverId === receiverId);
    if (!req) return null;
    req.status = 'accepted';

    // Add friendship if not exists
    if (!this.areFriends(req.senderId, req.receiverId)) {
      const friendship: DbFriendship = {
        id: `fr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user1Id: req.senderId,
        user2Id: req.receiverId,
        createdAt: new Date().toISOString()
      };
      this.data.friendships.push(friendship);
    }

    // Ensure DM conversation exists
    const conv = this.getOrCreateDmConversation(req.senderId, req.receiverId);

    this.saveSync();
    return { request: req, conversation: conv };
  }

  public rejectFriendRequest(requestId: string, receiverId: string): boolean {
    const idx = this.data.friend_requests.findIndex(r => r.id === requestId && r.receiverId === receiverId);
    if (idx === -1) return false;
    this.data.friend_requests.splice(idx, 1);
    this.saveSync();
    return true;
  }

  public cancelFriendRequest(requestId: string, senderId: string): boolean {
    const idx = this.data.friend_requests.findIndex(r => r.id === requestId && r.senderId === senderId);
    if (idx === -1) return false;
    this.data.friend_requests.splice(idx, 1);
    this.saveSync();
    return true;
  }

  public removeFriend(user1Id: string, user2Id: string): boolean {
    const idx = this.data.friendships.findIndex(
      f => (f.user1Id === user1Id && f.user2Id === user2Id) ||
           (f.user1Id === user2Id && f.user2Id === user1Id)
    );
    if (idx === -1) return false;
    this.data.friendships.splice(idx, 1);
    this.saveSync();
    return true;
  }

  public blockUser(userId: string, targetId: string): boolean {
    const user = this.findUserById(userId);
    if (!user) return false;
    if (!user.blockedUserIds) user.blockedUserIds = [];
    if (!user.blockedUserIds.includes(targetId)) {
      user.blockedUserIds.push(targetId);
    }
    // Remove friendship if any
    this.removeFriend(userId, targetId);
    // Cancel any pending requests between them
    const pending1 = this.findPendingRequest(userId, targetId);
    if (pending1) this.rejectFriendRequest(pending1.id, targetId);
    const pending2 = this.findPendingRequest(targetId, userId);
    if (pending2) this.rejectFriendRequest(pending2.id, userId);

    this.saveSync();
    return true;
  }

  public unblockUser(userId: string, targetId: string): boolean {
    const user = this.findUserById(userId);
    if (!user || !user.blockedUserIds) return false;
    user.blockedUserIds = user.blockedUserIds.filter(id => id !== targetId);
    this.saveSync();
    return true;
  }

  public isBlocked(user1Id: string, user2Id: string): boolean {
    const u1 = this.findUserById(user1Id);
    const u2 = this.findUserById(user2Id);
    if (u1?.blockedUserIds?.includes(user2Id)) return true;
    if (u2?.blockedUserIds?.includes(user1Id)) return true;
    return false;
  }

  public updateUsername(userId: string, newUsername: string): { success: boolean; error?: string; user?: DbUser } {
    const clean = newUsername.replace(/^@/, '').toLowerCase().trim();
    if (!clean || clean.length < 3) {
      return { success: false, error: 'O nome de usuário deve conter pelo menos 3 caracteres.' };
    }
    if (!/^[a-z0-9_.]+$/.test(clean)) {
      return { success: false, error: 'O nome de usuário pode conter apenas letras minúsculas, números, ponto e sublinhado.' };
    }
    const existing = this.findUserByUsername(clean);
    if (existing && existing.id !== userId) {
      return { success: false, error: 'Este nome de usuário já está em uso por outra pessoa.' };
    }
    const user = this.findUserById(userId);
    if (!user) return { success: false, error: 'Usuário não encontrado.' };
    user.username = clean;
    this.saveSync();
    return { success: true, user };
  }

  public getMutualServers(user1Id: string, user2Id: string) {
    const servers1 = new Set(
      this.data.server_members.filter(m => m.userId === user1Id).map(m => m.serverId)
    );
    const mutualServerIds = this.data.server_members
      .filter(m => m.userId === user2Id && servers1.has(m.serverId))
      .map(m => m.serverId);

    return mutualServerIds.map(sId => {
      const server = this.data.servers.find(s => s.id === sId);
      const memberCount = this.data.server_members.filter(m => m.serverId === sId).length;
      return {
        id: sId,
        name: server?.name || 'Servidor',
        initials: server?.initials || 'SRV',
        iconBg: server?.iconBg || 'bg-gradient-to-br from-indigo-500 to-purple-700',
        memberCount
      };
    });
  }

  public getPublicProfile(targetUserId: string, requesterUserId?: string) {
    const user = this.findUserById(targetUserId);
    if (!user) return null;

    let relationship: 'friend' | 'pending_incoming' | 'pending_outgoing' | 'blocked' | 'self' | 'none' = 'none';
    if (requesterUserId) {
      if (requesterUserId === targetUserId) {
        relationship = 'self';
      } else if (user.blockedUserIds?.includes(requesterUserId) || this.findUserById(requesterUserId)?.blockedUserIds?.includes(targetUserId)) {
        relationship = 'blocked';
      } else if (this.areFriends(requesterUserId, targetUserId)) {
        relationship = 'friend';
      } else if (this.findPendingRequest(requesterUserId, targetUserId)) {
        relationship = 'pending_outgoing';
      } else if (this.findPendingRequest(targetUserId, requesterUserId)) {
        relationship = 'pending_incoming';
      }
    }

    const mutualServers = requesterUserId && requesterUserId !== targetUserId
      ? this.getMutualServers(requesterUserId, targetUserId)
      : [];

    return {
      id: user.id,
      name: user.displayName,
      username: user.username,
      avatar: user.avatar,
      status: user.status,
      customStatus: user.customStatus || '',
      aboutMe: user.aboutMe || '',
      role: user.role,
      createdAt: user.createdAt,
      mutualServers,
      relationship
    };
  }

  // --- Conversations (DMs) ---
  public getOrCreateDmConversation(user1Id: string, user2Id: string): DbConversation {
    // Look for existing conversation between these two
    const memberConvs1 = this.data.conversation_members
      .filter(m => m.userId === user1Id)
      .map(m => m.conversationId);

    for (const cId of memberConvs1) {
      const isUser2Member = this.data.conversation_members.some(
        m => m.conversationId === cId && m.userId === user2Id
      );
      if (isUser2Member) {
        const existing = this.data.conversations.find(c => c.id === cId);
        if (existing) return existing;
      }
    }

    // Create new
    const sorted = [user1Id, user2Id].sort();
    const convId = `dm_${sorted[0]}_${sorted[1]}`;
    const newConv: DbConversation = {
      id: convId,
      type: 'dm',
      updatedAt: new Date().toISOString()
    };
    this.data.conversations.push(newConv);
    this.data.conversation_members.push(
      { conversationId: convId, userId: user1Id, joinedAt: new Date().toISOString() },
      { conversationId: convId, userId: user2Id, joinedAt: new Date().toISOString() }
    );
    this.saveSync();
    return newConv;
  }

  public getConversationById(id: string): DbConversation | undefined {
    return this.data.conversations.find(c => c.id === id);
  }

  public getConversationMembers(conversationId: string): string[] {
    return this.data.conversation_members
      .filter(m => m.conversationId === conversationId)
      .map(m => m.userId);
  }

  public getConversationsForUser(userId: string) {
    const convIds = this.data.conversation_members
      .filter(m => m.userId === userId)
      .map(m => m.conversationId);

    return convIds.map(cId => {
      const conv = this.data.conversations.find(c => c.id === cId);
      const memberIds = this.getConversationMembers(cId);
      const otherUserId = memberIds.find(id => id !== userId) || userId;
      const recipient = this.findUserById(otherUserId);
      const messages = this.getMessagesForConversation(cId);
      const lastMessage = messages[messages.length - 1];

      return {
        id: cId,
        recipient,
        updatedAt: conv?.updatedAt || new Date().toISOString(),
        lastMessage,
        unreadCount: 0
      };
    }).filter(c => !!c.recipient);
  }

  // --- Messages ---
  public getMessagesForConversation(conversationId: string): DbMessage[] {
    return this.data.messages.filter(m => m.conversationId === conversationId);
  }

  public getMessagesForChannel(channelId: string): DbMessage[] {
    return this.data.messages.filter(m => m.channelId === channelId);
  }

  public getAllMessages(): DbMessage[] {
    return this.data.messages;
  }

  public createMessage(messageData: Omit<DbMessage, 'id' | 'timestamp' | 'reactions'>): DbMessage {
    const newMsg: DbMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: 'Today at ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      reactions: [],
      ...messageData
    };
    this.data.messages.push(newMsg);

    if (newMsg.conversationId) {
      const conv = this.data.conversations.find(c => c.id === newMsg.conversationId);
      if (conv) conv.updatedAt = new Date().toISOString();
    }

    this.saveSync();
    return newMsg;
  }

  public deleteMessage(messageId: string, userId: string): boolean {
    const idx = this.data.messages.findIndex(m => m.id === messageId && m.authorId === userId);
    if (idx === -1) return false;
    this.data.messages.splice(idx, 1);
    this.saveSync();
    return true;
  }

  public toggleReaction(messageId: string, userId: string, emoji: string): DbMessage | null {
    const msg = this.data.messages.find(m => m.id === messageId);
    if (!msg) return null;

    let reaction = msg.reactions.find(r => r.emoji === emoji);
    if (!reaction) {
      reaction = { emoji, count: 1, users: [userId] };
      msg.reactions.push(reaction);
    } else {
      if (reaction.users.includes(userId)) {
        reaction.users = reaction.users.filter(u => u !== userId);
        reaction.count = reaction.users.length;
        if (reaction.count === 0) {
          msg.reactions = msg.reactions.filter(r => r.emoji !== emoji);
        }
      } else {
        reaction.users.push(userId);
        reaction.count = reaction.users.length;
      }
    }

    this.saveSync();
    return msg;
  }

  public togglePin(messageId: string): DbMessage | null {
    const msg = this.data.messages.find(m => m.id === messageId);
    if (!msg) return null;
    msg.isPinned = !msg.isPinned;
    this.saveSync();
    return msg;
  }

  // --- Servers & Channels ---
  public getServersForUser(userId: string): DbServer[] {
    const serverIds = this.data.server_members
      .filter(m => m.userId === userId)
      .map(m => m.serverId);

    return this.data.servers.filter(s => serverIds.includes(s.id));
  }

  public getServerById(serverId: string): DbServer | undefined {
    return this.data.servers.find(s => s.id === serverId);
  }

  public getServerMembers(serverId: string): DbUser[] {
    const userIds = this.data.server_members
      .filter(m => m.serverId === serverId)
      .map(m => m.userId);

    return userIds
      .map(id => this.findUserById(id))
      .filter((u): u is DbUser => !!u);
  }

  public createServer(name: string, description: string, ownerId: string): DbServer {
    const initials = name
      .split(' ')
      .map(w => w[0])
      .join('')
      .slice(0, 3)
      .toUpperCase() || 'SRV';

    const colors = [
      'bg-gradient-to-br from-indigo-500 to-purple-700',
      'bg-gradient-to-br from-emerald-500 to-teal-700',
      'bg-gradient-to-br from-amber-500 to-orange-600',
      'bg-gradient-to-br from-pink-500 to-rose-700',
      'bg-gradient-to-br from-blue-500 to-cyan-600'
    ];
    const iconBg = colors[Math.floor(Math.random() * colors.length)];

    const serverId = `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const server: DbServer = {
      id: serverId,
      name,
      initials,
      iconBg,
      description,
      ownerId,
      inviteCode,
      createdAt: new Date().toISOString()
    };

    this.data.servers.push(server);

    // Add owner as member
    this.data.server_members.push({
      serverId,
      userId: ownerId,
      role: 'Owner',
      joinedAt: new Date().toISOString()
    });

    // Create default categories & channels
    const catTextId = `cat_${Date.now()}_text`;
    const catVoiceId = `cat_${Date.now()}_voice`;

    this.data.channel_categories.push(
      { id: catTextId, serverId, name: 'Text Channels' },
      { id: catVoiceId, serverId, name: 'Voice Channels' }
    );

    this.data.channels.push(
      {
        id: `ch_${Date.now()}_gen`,
        serverId,
        name: 'general',
        type: 'text',
        topic: 'General discussion',
        categoryId: catTextId
      },
      {
        id: `ch_${Date.now()}_voi`,
        serverId,
        name: 'Lounge Voice',
        type: 'voice',
        categoryId: catVoiceId
      }
    );

    this.saveSync();
    return server;
  }

  public joinServerByInvite(inviteCode: string, userId: string): DbServer | null {
    const cleanCode = inviteCode.trim().toUpperCase();
    const server = this.data.servers.find(s => s.inviteCode === cleanCode);
    if (!server) return null;

    const alreadyMember = this.data.server_members.some(
      m => m.serverId === server.id && m.userId === userId
    );

    if (!alreadyMember) {
      this.data.server_members.push({
        serverId: server.id,
        userId,
        role: 'Member',
        joinedAt: new Date().toISOString()
      });
      this.saveSync();
    }

    return server;
  }

  public getServerCategories(serverId: string): DbCategory[] {
    return this.data.channel_categories.filter(c => c.serverId === serverId);
  }

  public getServerChannels(serverId: string): DbChannel[] {
    return this.data.channels.filter(c => c.serverId === serverId);
  }

  public createChannel(serverId: string, name: string, type: 'text' | 'voice' | 'announcement', topic?: string, categoryId?: string): DbChannel {
    let catId = categoryId;
    if (!catId) {
      const cats = this.getServerCategories(serverId);
      catId = cats[0]?.id || 'cat-default';
    }

    const cleanName = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const channel: DbChannel = {
      id: `ch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      serverId,
      name: cleanName || 'canal',
      type,
      topic: topic || '',
      categoryId: catId
    };

    this.data.channels.push(channel);
    this.saveSync();
    return channel;
  }
}

export const db = new JsonDatabase();
