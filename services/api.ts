import { User, Message, Friend, Server, DirectMessageConversation, UserStatus, Channel, MessageReaction } from '../types';

const TOKEN_KEY = 'nuggets_auth_token';

export const tokenStorage = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  remove: () => localStorage.removeItem(TOKEN_KEY)
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get();
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>)
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Erro na requisição: ${res.status}`);
  }

  return data;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; user: User }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }),

    register: (userData: {
      username: string;
      displayName: string;
      email: string;
      password: string;
      confirmPassword: string;
    }) =>
      request<{ token: string; user: User }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData)
      }),

    me: async (): Promise<User> => {
      const res = await request<{ user: User }>('/api/auth/me');
      return res.user;
    },

    updateStatus: async (status: UserStatus): Promise<User> => {
      const res = await request<{ user: User }>('/api/auth/status', {
        method: 'PUT',
        body: JSON.stringify({ status })
      });
      return res.user;
    },

    updateProfile: async (profile: Partial<User>): Promise<User> => {
      const res = await request<{ user: User }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profile)
      });
      return res.user;
    },

    getGoogleUrl: () =>
      request<{ configured: boolean; url?: string; message?: string }>('/api/auth/google/url')
  },

  users: {
    search: async (query: string): Promise<User[]> => {
      const res = await request<{ users: User[] }>(`/api/users/search?q=${encodeURIComponent(query)}`);
      return res.users || [];
    }
  },

  friends: {
    get: async (): Promise<Friend[]> => {
      const res = await request<{ friends: Friend[]; counts?: any }>('/api/friends');
      return res.friends || [];
    },

    sendRequest: (username: string) =>
      request<{ success: boolean; requestId: string; recipient: User }>('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ username })
      }),

    accept: (requestId?: string, senderId?: string) =>
      request<{ success: boolean; user: User; conversationId: string }>('/api/friends/accept', {
        method: 'POST',
        body: JSON.stringify({ requestId, senderId })
      }),

    reject: (requestId?: string, senderId?: string) =>
      request<{ success: boolean }>('/api/friends/reject', {
        method: 'POST',
        body: JSON.stringify({ requestId, senderId })
      })
  },

  conversations: {
    get: async (): Promise<DirectMessageConversation[]> => {
      const res = await request<{ conversations: DirectMessageConversation[] }>('/api/conversations');
      return res.conversations || [];
    },

    open: async (userId: string): Promise<DirectMessageConversation> => {
      const res = await request<{ conversation: DirectMessageConversation }>('/api/conversations/open', {
        method: 'POST',
        body: JSON.stringify({ userId })
      });
      return res.conversation;
    },

    getMessages: async (conversationId: string): Promise<Message[]> => {
      const res = await request<{ messages: Message[] }>(`/api/conversations/${conversationId}/messages`);
      return res.messages || [];
    },

    sendMessage: async (conversationId: string, content: string, replyTo?: any, attachments?: any[]): Promise<Message> => {
      const res = await request<{ message: Message }>(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, replyTo, attachments })
      });
      return res.message;
    }
  },

  upload: {
    avatar: async (file: File): Promise<{ success: boolean; avatarUrl: string; user: User }> => {
      const formData = new FormData();
      formData.append('avatar', file);
      return request<{ success: boolean; avatarUrl: string; user: User }>('/api/upload/avatar', {
        method: 'POST',
        body: formData
      });
    },

    removeAvatar: async (): Promise<{ success: boolean; avatarUrl: string; user: User }> => {
      return request<{ success: boolean; avatarUrl: string; user: User }>('/api/upload/avatar', {
        method: 'DELETE'
      });
    },

    media: async (file: File): Promise<{ id: string; url: string; name: string; type: 'image' | 'video'; size: number; mimeType: string }> => {
      const formData = new FormData();
      formData.append('file', file);
      return request<{ id: string; url: string; name: string; type: 'image' | 'video'; size: number; mimeType: string }>('/api/upload/media', {
        method: 'POST',
        body: formData
      });
    },

    file: async (file: File): Promise<{ id: string; url: string; name: string; type: 'file'; size: number; mimeType: string }> => {
      const formData = new FormData();
      formData.append('file', file);
      return request<{ id: string; url: string; name: string; type: 'file'; size: number; mimeType: string }>('/api/upload/file', {
        method: 'POST',
        body: formData
      });
    }
  },

  users: {
    updateNotifications: async (settings: any): Promise<{ success: boolean; user: User }> => {
      return request<{ success: boolean; user: User }>('/api/users/me/notifications', {
        method: 'PUT',
        body: JSON.stringify({ settings })
      });
    },

    updateServerSettings: async (serverId: string, settings: { notifyLevel?: string; mutedUntil?: string | null }): Promise<{ success: boolean; serverSettings: any }> => {
      return request<{ success: boolean; serverSettings: any }>(`/api/users/me/server-settings/${serverId}`, {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
    },

    updateChannelSettings: async (channelId: string, settings: { notifyLevel?: string }): Promise<{ success: boolean; channelSettings: any }> => {
      return request<{ success: boolean; channelSettings: any }>(`/api/users/me/channel-settings/${channelId}`, {
        method: 'PUT',
        body: JSON.stringify(settings)
      });
    }
  },

  webrtc: {
    getConfig: async (): Promise<{ iceServers: RTCIceServer[] }> => {
      return request<{ iceServers: RTCIceServer[] }>('/api/webrtc/config');
    }
  },

  search: {
    query: async (q: string): Promise<{ messages: Message[]; friends: User[]; servers: Server[]; attachments: any[] }> => {
      return request<{ messages: Message[]; friends: User[]; servers: Server[]; attachments: any[] }>(`/api/search?q=${encodeURIComponent(q)}`);
    }
  },

  messages: {
    react: async (messageId: string, emoji: string): Promise<MessageReaction[]> => {
      const res = await request<{ reactions: MessageReaction[] }>(`/api/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji })
      });
      return res.reactions || [];
    },

    delete: async (messageId: string): Promise<boolean> => {
      const res = await request<{ success: boolean }>(`/api/messages/${messageId}`, {
        method: 'DELETE'
      });
      return res.success;
    },

    pin: (messageId: string) =>
      request<{ isPinned: boolean }>(`/api/messages/${messageId}/pin`, {
        method: 'POST'
      })
  },

  servers: {
    get: async (): Promise<Server[]> => {
      const res = await request<{ servers: Server[] }>('/api/servers');
      return res.servers || [];
    },

    create: async (name: string, description: string): Promise<Server> => {
      const res = await request<{ server: Server }>('/api/servers', {
        method: 'POST',
        body: JSON.stringify({ name, description })
      });
      return res.server;
    },

    join: async (inviteCode: string): Promise<Server> => {
      const res = await request<{ server: Server }>('/api/servers/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode })
      });
      return res.server;
    },

    createChannel: async (serverId: string, channelData: { name: string; type: string; topic?: string; categoryId?: string }): Promise<Channel> => {
      const res = await request<{ channel: Channel }>(`/api/servers/${serverId}/channels`, {
        method: 'POST',
        body: JSON.stringify(channelData)
      });
      return res.channel;
    },

    getChannelMessages: async (serverId: string, channelId: string): Promise<Message[]> => {
      const res = await request<{ messages: Message[] }>(`/api/servers/${serverId}/channels/${channelId}/messages`);
      return res.messages || [];
    },

    sendChannelMessage: async (serverId: string, channelId: string, content: string, replyTo?: any, attachments?: any[]): Promise<Message> => {
      const res = await request<{ message: Message }>(`/api/servers/${serverId}/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, replyTo, attachments })
      });
      return res.message;
    }
  }
};
