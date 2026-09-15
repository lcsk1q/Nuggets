import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { db, DbUser, DbMessage } from './server/db';

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'nuggets_secret_jwt_key_development_2026';

// Storage directories
const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');
const AVATAR_DIR = path.join(UPLOAD_ROOT, 'avatars');
const MEDIA_DIR = path.join(UPLOAD_ROOT, 'media');
const FILES_DIR = path.join(UPLOAD_ROOT, 'files');

fs.mkdirSync(AVATAR_DIR, { recursive: true });
fs.mkdirSync(MEDIA_DIR, { recursive: true });
fs.mkdirSync(FILES_DIR, { recursive: true });

// Multer storage configurations
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `avatar_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
  }
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato inválido. Permitido: PNG, JPG, WEBP, GIF'));
    }
  }
});

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, MEDIA_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `media_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
  }
});
const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas fotos e vídeos são permitidos nesta opção.'));
    }
  }
});

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FILES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
  }
});
const uploadFile = multer({
  storage: fileStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const blockedExts = ['.exe', '.bat', '.sh', '.cmd', '.vbs', '.msi', '.com', '.scr', '.pif'];
    if (blockedExts.includes(ext)) {
      cb(new Error('Tipo de arquivo executável bloqueado por segurança.'));
    } else {
      cb(null, true);
    }
  }
});

// Global WebSocket connections map: userId -> Set of WebSockets
const userSockets = new Map<string, Set<WebSocket>>();
// Active WebRTC calls map: callId -> { callId, callerId, recipientId }
const activeCalls = new Map<string, { callId: string; callerId: string; recipientId: string }>();

function registerUserSocket(userId: string, ws: WebSocket) {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(ws);
}

function unregisterUserSocket(userId: string, ws: WebSocket) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.delete(ws);
    if (sockets.size === 0) {
      userSockets.delete(userId);
    }
  }
}

export function sendToUser(userId: string, payload: any) {
  const sockets = userSockets.get(userId);
  if (sockets) {
    const data = JSON.stringify(payload);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
}

export function sendToUsers(userIds: string[], payload: any) {
  for (const uid of userIds) {
    sendToUser(uid, payload);
  }
}

function sanitizeUser(u: DbUser | undefined | null) {
  if (!u) return null;
  const { passwordHash, ...safe } = u;
  return safe;
}

function formatMessage(msg: DbMessage) {
  const author = db.findUserById(msg.authorId);
  return {
    ...msg,
    author: sanitizeUser(author) || {
      id: msg.authorId,
      name: 'User',
      username: 'user',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      status: 'offline',
      role: 'Member'
    }
  };
}

// AI Optional
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

interface AuthenticatedRequest extends Request {
  user?: DbUser;
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const user = db.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = http.createServer(app);

  // Initialize WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let currentUserId: string | null = null;

    ws.on('message', (message: string) => {
      try {
        const payload = JSON.parse(message.toString());

        if (payload.type === 'auth') {
          const token = payload.token;
          if (!token) return;

          try {
            const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
            const user = db.findUserById(decoded.userId);
            if (user) {
              currentUserId = user.id;
              registerUserSocket(currentUserId, ws);

              // Update user status to online
              db.updateUser(currentUserId, { status: 'online' });

              // Notify user's friends that user is online
              const friends = db.getFriends(currentUserId);
              for (const friend of friends) {
                sendToUser(friend.id, {
                  type: 'presence:update',
                  data: { userId: currentUserId, status: 'online' }
                });
              }

              ws.send(JSON.stringify({ type: 'auth:success', userId: currentUserId }));
            }
          } catch (e) {
            ws.send(JSON.stringify({ type: 'auth:error', message: 'Token inválido' }));
          }
        } else if (payload.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        } else if (payload.type === 'call:initiate') {
          const { targetUserId, callType } = payload.data || {};
          if (!currentUserId) return;

          if (db.isBlocked(currentUserId, targetUserId)) {
            ws.send(JSON.stringify({
              type: 'call:user_offline',
              data: { targetUserId, message: 'Não é possível ligar para este usuário.' }
            }));
            return;
          }

          const targetSockets = userSockets.get(targetUserId);
          if (!targetSockets || targetSockets.size === 0) {
            ws.send(JSON.stringify({
              type: 'call:user_offline',
              data: { targetUserId, message: 'O usuário está offline no momento.' }
            }));
            return;
          }
          const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          activeCalls.set(callId, { callId, callerId: currentUserId, recipientId: targetUserId });
          const callerUser = db.findUserById(currentUserId);
          sendToUser(targetUserId, {
            type: 'call:incoming',
            data: {
              callId,
              caller: sanitizeUser(callerUser),
              callType: callType || 'audio'
            }
          });
          ws.send(JSON.stringify({
            type: 'call:ringing',
            data: { callId, targetUserId }
          }));
        } else if (payload.type === 'call:accept') {
          const { callId, callerId } = payload.data || {};
          if (!currentUserId) return;
          sendToUser(callerId, {
            type: 'call:accepted',
            data: { callId, recipientId: currentUserId }
          });
        } else if (payload.type === 'call:reject') {
          const { callId, callerId, reason } = payload.data || {};
          if (!currentUserId) return;
          if (callId) activeCalls.delete(callId);
          sendToUser(callerId, {
            type: 'call:rejected',
            data: { callId, recipientId: currentUserId, reason: reason || 'Chamada recusada' }
          });
        } else if (payload.type === 'call:end') {
          const { callId, targetUserId } = payload.data || {};
          if (callId) activeCalls.delete(callId);
          if (targetUserId) {
            sendToUser(targetUserId, {
              type: 'call:ended',
              data: { callId, endedBy: currentUserId }
            });
          }
        } else if (payload.type === 'call:signal') {
          const { targetUserId, callId, signal } = payload.data || {};
          if (targetUserId) {
            sendToUser(targetUserId, {
              type: 'call:signal',
              data: { callId, fromUserId: currentUserId, signal }
            });
          }
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    });

    ws.on('close', () => {
      if (currentUserId) {
        unregisterUserSocket(currentUserId, ws);

        // If no more open connections for this user, cleanup calls and mark as offline
        if (!userSockets.has(currentUserId)) {
          for (const [callId, call] of activeCalls.entries()) {
            if (call.callerId === currentUserId || call.recipientId === currentUserId) {
              const peerId = call.callerId === currentUserId ? call.recipientId : call.callerId;
              sendToUser(peerId, {
                type: 'call:ended',
                data: { callId, endedBy: currentUserId, reason: 'O outro usuário se desconectou.' }
              });
              activeCalls.delete(callId);
            }
          }

          db.updateUser(currentUserId, { status: 'offline' });
          const friends = db.getFriends(currentUserId);
          for (const friend of friends) {
            sendToUser(friend.id, {
              type: 'presence:update',
              data: { userId: currentUserId, status: 'offline' }
            });
          }
        }
      }
    });
  });

  // Serve persistent uploads
  app.use('/uploads', express.static(UPLOAD_ROOT));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'Nuggets' });
  });

  // ==========================================
  // AUTHENTICATION ROUTES
  // ==========================================

  // Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, displayName, email, password, confirmPassword } = req.body;

      if (!username || !displayName || !email || !password) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'As senhas não coincidem.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'A senha deve conter no mínimo 6 caracteres.' });
      }

      const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
      if (cleanUsername.length < 3) {
        return res.status(400).json({ error: 'O nome de usuário deve conter no mínimo 3 caracteres.' });
      }

      // Check if email already exists
      const existingEmail = db.findUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: 'Este e-mail já está em uso.' });
      }

      // Check if username already exists
      const existingUsername = db.findUserByUsername(cleanUsername);
      if (existingUsername) {
        return res.status(400).json({ error: 'Este nome de usuário já está em uso.' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Default avatar using stylized initials
      const avatar = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${cleanUsername}`;

      const newUser: DbUser = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        email: email.toLowerCase().trim(),
        username: cleanUsername,
        displayName: displayName.trim(),
        passwordHash,
        avatar,
        status: 'online',
        role: 'Member',
        createdAt: new Date().toISOString()
      };

      db.createUser(newUser);

      const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });

      res.status(201).json({
        token,
        user: sanitizeUser(newUser)
      });
    } catch (err: any) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Erro ao criar conta. Tente novamente.' });
    }
  });

  // Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Informe e-mail e senha.' });
      }

      // Search by email or username
      let user = db.findUserByEmail(email);
      if (!user) {
        user = db.findUserByUsername(email);
      }

      if (!user) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
      }

      db.updateUser(user.id, { status: 'online' });
      user.status = 'online';

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

      res.json({
        token,
        user: sanitizeUser(user)
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Erro ao realizar login.' });
    }
  });

  // Verify Session / Get Current User
  app.get('/api/auth/me', authMiddleware, (req: AuthenticatedRequest, res) => {
    res.json({ user: sanitizeUser(req.user!) });
  });

  // Update Profile
  app.put('/api/auth/profile', authMiddleware, (req: AuthenticatedRequest, res) => {
    const { displayName, username, customStatus, aboutMe, avatar } = req.body;

    if (username !== undefined && username !== req.user!.username) {
      const uRes = db.updateUsername(req.user!.id, username);
      if (!uRes.success) {
        return res.status(400).json({ error: uRes.error });
      }
    }

    const updated = db.updateUser(req.user!.id, {
      ...(displayName && { displayName: displayName.trim() }),
      ...(customStatus !== undefined && { customStatus }),
      ...(aboutMe !== undefined && { aboutMe }),
      ...(avatar && { avatar })
    });

    const safe = sanitizeUser(updated);

    // Broadcast user update across all active clients in real time
    for (const [userId] of userSockets) {
      sendToUser(userId, {
        type: 'user:updated',
        data: { user: safe }
      });
    }

    res.json({ user: safe });
  });

  // Get User Profile (Real public data, no private email)
  app.get('/api/users/:id/profile', authMiddleware, (req: AuthenticatedRequest, res) => {
    const profile = db.getPublicProfile(req.params.id, req.user!.id);
    if (!profile) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json({ profile });
  });

  // ==========================================
  // UPLOADS & FILE STORAGE ROUTES
  // ==========================================

  // Upload user avatar
  app.post('/api/upload/avatar', authMiddleware, uploadAvatar.single('avatar'), (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      const updated = db.updateUser(req.user!.id, { avatar: avatarUrl });
      const safe = sanitizeUser(updated);

      // Broadcast new avatar to all connected users
      for (const [userId] of userSockets) {
        sendToUser(userId, {
          type: 'user:updated',
          data: { user: safe }
        });
      }

      res.json({ success: true, avatarUrl, user: safe });
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      res.status(500).json({ error: err.message || 'Erro ao processar imagem.' });
    }
  });

  // Remove custom avatar (reset to default)
  app.delete('/api/upload/avatar', authMiddleware, (req: AuthenticatedRequest, res) => {
    const defaultAvatar = `https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${req.user!.username}`;
    const updated = db.updateUser(req.user!.id, { avatar: defaultAvatar });
    const safe = sanitizeUser(updated);

    for (const [userId] of userSockets) {
      sendToUser(userId, {
        type: 'user:updated',
        data: { user: safe }
      });
    }

    res.json({ success: true, avatarUrl: defaultAvatar, user: safe });
  });

  // Upload Photo or Video
  app.post('/api/upload/media', authMiddleware, uploadMedia.single('file'), (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }
      const isVideo = req.file.mimetype.startsWith('video/');
      const url = `/uploads/media/${req.file.filename}`;
      res.json({
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        url,
        name: req.file.originalname,
        type: isVideo ? 'video' : 'image',
        size: req.file.size,
        mimeType: req.file.mimetype
      });
    } catch (err: any) {
      console.error('Media upload error:', err);
      res.status(500).json({ error: err.message || 'Erro ao enviar mídia.' });
    }
  });

  // Upload Generic Document / File
  app.post('/api/upload/file', authMiddleware, uploadFile.single('file'), (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      }
      const url = `/uploads/files/${req.file.filename}`;
      res.json({
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        url,
        name: req.file.originalname,
        type: 'file',
        size: req.file.size,
        mimeType: req.file.mimetype
      });
    } catch (err: any) {
      console.error('File upload error:', err);
      res.status(500).json({ error: err.message || 'Erro ao enviar arquivo.' });
    }
  });

  // WebRTC ICE Servers Configuration
  app.get('/api/webrtc/config', (req, res) => {
    let iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ];
    if (process.env.ICE_SERVERS) {
      try {
        const parsed = JSON.parse(process.env.ICE_SERVERS);
        if (Array.isArray(parsed)) {
          iceServers = parsed;
        }
      } catch (e) {
        console.error('Failed to parse ICE_SERVERS env:', e);
      }
    }
    res.json({ iceServers });
  });

  // Update Notification Settings
  app.put('/api/users/me/notifications', authMiddleware, (req: AuthenticatedRequest, res) => {
    const { settings } = req.body;
    const current = req.user!.notificationSettings || {};
    const updated = db.updateUser(req.user!.id, {
      notificationSettings: {
        ...current,
        ...settings
      }
    });
    res.json({ success: true, user: sanitizeUser(updated) });
  });

  // Update Server Notification Settings
  app.put('/api/users/me/server-settings/:serverId', authMiddleware, (req: AuthenticatedRequest, res) => {
    const serverId = req.params.serverId;
    const { notifyLevel, mutedUntil } = req.body;
    const currentServerSettings = req.user!.serverSettings || {};
    const updated = db.updateUser(req.user!.id, {
      serverSettings: {
        ...currentServerSettings,
        [serverId]: {
          notifyLevel: notifyLevel || 'all',
          mutedUntil: mutedUntil !== undefined ? mutedUntil : null
        }
      }
    });
    res.json({ success: true, serverSettings: updated?.serverSettings?.[serverId] });
  });

  // Update Channel Notification Settings
  app.put('/api/users/me/channel-settings/:channelId', authMiddleware, (req: AuthenticatedRequest, res) => {
    const channelId = req.params.channelId;
    const { notifyLevel } = req.body;
    const currentChannelSettings = req.user!.channelSettings || {};
    const updated = db.updateUser(req.user!.id, {
      channelSettings: {
        ...currentChannelSettings,
        [channelId]: {
          notifyLevel: notifyLevel || 'all'
        }
      }
    });
    res.json({ success: true, channelSettings: updated?.channelSettings?.[channelId] });
  });

  // Update Status
  app.put('/api/auth/status', authMiddleware, (req: AuthenticatedRequest, res) => {
    const { status } = req.body;
    if (!['online', 'idle', 'dnd', 'offline'].includes(status)) {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const updated = db.updateUser(req.user!.id, { status });

    // Broadcast presence to friends
    const friends = db.getFriends(req.user!.id);
    for (const f of friends) {
      sendToUser(f.id, {
        type: 'presence:update',
        data: { userId: req.user!.id, status }
      });
    }

    res.json({ user: sanitizeUser(updated) });
  });

  // Google OAuth URL Check
  app.get('/api/auth/google/url', (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.json({
        configured: false,
        message: 'Para ativar o login com Google, configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no ambiente (.env).'
      });
    }

    const host = req.get('host') || 'localhost:3000';
    const proto = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const redirectUri = `${proto}://${host}/api/auth/google/callback`;

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=openid%20email%20profile&prompt=select_account`;

    res.json({ configured: true, url: authUrl });
  });

  // Search real users
  app.get('/api/users/search', authMiddleware, (req: AuthenticatedRequest, res) => {
    const q = req.query.q as string;
    if (!q || !q.trim()) {
      return res.json({ users: [] });
    }

    const users = db.searchUsers(q, req.user!.id);
    res.json({ users: users.map(u => sanitizeUser(u)) });
  });

  // ==========================================
  // FRIENDS & SOCIAL ROUTES
  // ==========================================

  // Get friends list & pending requests
  app.get('/api/friends', authMiddleware, (req: AuthenticatedRequest, res) => {
    const myId = req.user!.id;
    const friends = db.getFriends(myId).map(u => ({
      user: sanitizeUser(u),
      relationship: 'friend' as const
    }));

    const { incoming, outgoing } = db.getFriendRequests(myId);

    const pendingIncoming = incoming.map(item => ({
      requestId: item.request.id,
      user: sanitizeUser(item.sender),
      relationship: 'pending_incoming' as const,
      createdAt: item.request.createdAt
    }));

    const pendingOutgoing = outgoing.map(item => ({
      requestId: item.request.id,
      user: sanitizeUser(item.receiver),
      relationship: 'pending_outgoing' as const,
      createdAt: item.request.createdAt
    }));

    res.json({
      friends: [...friends, ...pendingIncoming, ...pendingOutgoing],
      counts: {
        online: friends.filter(f => f.user?.status !== 'offline').length,
        total: friends.length,
        pending: pendingIncoming.length
      }
    });
  });

  // Send friend request
  app.post('/api/friends/request', authMiddleware, (req: AuthenticatedRequest, res) => {
    const myId = req.user!.id;
    const { username } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Informe o nome de usuário.' });
    }

    const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
    const targetUser = db.findUserByUsername(cleanUsername);

    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (targetUser.id === myId) {
      return res.status(400).json({ error: 'Você não pode adicionar a si mesmo como amigo.' });
    }

    if (db.areFriends(myId, targetUser.id)) {
      return res.status(400).json({ error: 'Vocês já são amigos.' });
    }

    const existingPending = db.findPendingRequest(myId, targetUser.id);
    if (existingPending) {
      if (existingPending.senderId === myId) {
        return res.status(400).json({ error: 'Você já enviou uma solicitação para este usuário.' });
      } else {
        // Automatically accept if the other user already sent one!
        const result = db.acceptFriendRequest(existingPending.id, myId);
        if (result) {
          // Send WS events
          sendToUser(targetUser.id, {
            type: 'friend:accepted',
            data: { user: sanitizeUser(req.user!), conversationId: result.conversation.id }
          });
          sendToUser(myId, {
            type: 'friend:accepted',
            data: { user: sanitizeUser(targetUser), conversationId: result.conversation.id }
          });
          return res.json({ success: true, accepted: true, recipient: sanitizeUser(targetUser) });
        }
      }
    }

    const request = db.createFriendRequest(myId, targetUser.id);

    // Send real-time event to Computador B (recipient)
    sendToUser(targetUser.id, {
      type: 'friend:request',
      data: {
        requestId: request.id,
        sender: sanitizeUser(req.user!),
        relationship: 'pending_incoming',
        createdAt: request.createdAt
      }
    });

    res.status(201).json({
      success: true,
      requestId: request.id,
      recipient: sanitizeUser(targetUser)
    });
  });

  // Accept friend request
  app.post('/api/friends/accept', authMiddleware, (req: AuthenticatedRequest, res) => {
    const myId = req.user!.id;
    const { requestId, senderId } = req.body;

    let targetReqId = requestId;
    if (!targetReqId && senderId) {
      const pending = db.findPendingRequest(senderId, myId);
      if (pending && pending.receiverId === myId) {
        targetReqId = pending.id;
      }
    }

    if (!targetReqId) {
      return res.status(400).json({ error: 'Identificador da solicitação não fornecido.' });
    }

    const result = db.acceptFriendRequest(targetReqId, myId);
    if (!result) {
      return res.status(404).json({ error: 'Solicitação não encontrada ou não autorizada.' });
    }

    const otherUser = db.findUserById(result.request.senderId);

    // Broadcast WebSocket events to BOTH users in real time!
    sendToUser(result.request.senderId, {
      type: 'friend:accepted',
      data: {
        user: sanitizeUser(req.user!),
        conversationId: result.conversation.id
      }
    });

    sendToUser(myId, {
      type: 'friend:accepted',
      data: {
        user: sanitizeUser(otherUser),
        conversationId: result.conversation.id
      }
    });

    res.json({
      success: true,
      user: sanitizeUser(otherUser),
      conversationId: result.conversation.id
    });
  });

  // Reject friend request
  app.post('/api/friends/reject', authMiddleware, (req: AuthenticatedRequest, res) => {
    const myId = req.user!.id;
    const { requestId, senderId } = req.body;

    let targetReqId = requestId;
    if (!targetReqId && senderId) {
      const pending = db.findPendingRequest(senderId, myId);
      if (pending && pending.receiverId === myId) {
        targetReqId = pending.id;
      }
    }

    if (!targetReqId) {
      return res.status(400).json({ error: 'Solicitação não encontrada.' });
    }

    const ok = db.rejectFriendRequest(targetReqId, myId);
    if (!ok) {
      return res.status(404).json({ error: 'Não foi possível recusar a solicitação.' });
    }

    res.json({ success: true });
  });

  // ==========================================
  // CONVERSATIONS & DIRECT MESSAGES
  // ==========================================

  // List DM conversations for current user
  app.get('/api/conversations', authMiddleware, (req: AuthenticatedRequest, res) => {
    const convs = db.getConversationsForUser(req.user!.id);
    res.json({
      conversations: convs.map(c => ({
        id: c.id,
        recipient: sanitizeUser(c.recipient as DbUser),
        updatedAt: c.updatedAt,
        unreadCount: c.unreadCount,
        lastMessage: c.lastMessage ? formatMessage(c.lastMessage) : undefined
      }))
    });
  });

  // Open / Create DM conversation with another user
  app.post('/api/conversations/open', authMiddleware, (req: AuthenticatedRequest, res) => {
    const myId = req.user!.id;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId obrigatório' });
    }

    const targetUser = db.findUserById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const conv = db.getOrCreateDmConversation(myId, targetUser.id);
    res.json({
      conversation: {
        id: conv.id,
        recipient: sanitizeUser(targetUser),
        unreadCount: 0
      }
    });
  });

  // Get messages of a conversation
  app.get('/api/conversations/:id/messages', authMiddleware, (req: AuthenticatedRequest, res) => {
    const convId = req.params.id;
    const members = db.getConversationMembers(convId);

    if (!members.includes(req.user!.id)) {
      return res.status(403).json({ error: 'Acesso negado à conversa.' });
    }

    const rawMsgs = db.getMessagesForConversation(convId);
    res.json({ messages: rawMsgs.map(formatMessage) });
  });

  // Send a message in a conversation (DM)
  app.post('/api/conversations/:id/messages', authMiddleware, (req: AuthenticatedRequest, res) => {
    const convId = req.params.id;
    const members = db.getConversationMembers(convId);

    if (!members.includes(req.user!.id)) {
      return res.status(403).json({ error: 'Acesso negado à conversa.' });
    }

    const { content, replyTo, attachments } = req.body;
    if ((!content || !content.trim()) && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Mensagem vazia' });
    }

    const newMsg = db.createMessage({
      conversationId: convId,
      authorId: req.user!.id,
      content: (content || '').trim(),
      replyTo,
      attachments: attachments || []
    });

    const formatted = formatMessage(newMsg);

    // Broadcast message via WebSocket in REAL TIME to all conversation members!
    for (const memberId of members) {
      sendToUser(memberId, {
        type: 'chat:message',
        data: {
          conversationId: convId,
          message: formatted
        }
      });
    }

    res.status(201).json({ message: formatted });
  });

  // Toggle reaction on a message
  app.post('/api/messages/:id/reactions', authMiddleware, (req: AuthenticatedRequest, res) => {
    const msgId = req.params.id;
    const { emoji } = req.body;

    if (!emoji) return res.status(400).json({ error: 'Emoji obrigatório' });

    const updated = db.toggleReaction(msgId, req.user!.id, emoji);
    if (!updated) return res.status(404).json({ error: 'Mensagem não encontrada' });

    const formatted = formatMessage(updated);

    // Broadcast to conversation or server members
    if (updated.conversationId) {
      const members = db.getConversationMembers(updated.conversationId);
      for (const mid of members) {
        sendToUser(mid, {
          type: 'chat:reaction',
          data: { conversationId: updated.conversationId, messageId: updated.id, reactions: updated.reactions }
        });
      }
    } else if (updated.channelId) {
      // Find server
      const ch = db.getServerChannels('').find(c => c.id === updated.channelId);
      if (ch) {
        const members = db.getServerMembers(ch.serverId);
        for (const m of members) {
          sendToUser(m.id, {
            type: 'chat:reaction',
            data: { channelId: updated.channelId, messageId: updated.id, reactions: updated.reactions }
          });
        }
      }
    }

    res.json({ message: formatted });
  });

  // Delete a message
  app.delete('/api/messages/:id', authMiddleware, (req: AuthenticatedRequest, res) => {
    const msgId = req.params.id;
    const raw = db.getMessagesForConversation('').concat(db.getMessagesForChannel('')).find(m => m.id === msgId);

    const ok = db.deleteMessage(msgId, req.user!.id);
    if (!ok) return res.status(404).json({ error: 'Mensagem não encontrada ou não autorizada' });

    if (raw?.conversationId) {
      const members = db.getConversationMembers(raw.conversationId);
      for (const mid of members) {
        sendToUser(mid, {
          type: 'chat:delete',
          data: { conversationId: raw.conversationId, messageId: msgId }
        });
      }
    }

    res.json({ success: true });
  });

  // Toggle pin
  app.post('/api/messages/:id/pin', authMiddleware, (req: AuthenticatedRequest, res) => {
    const msgId = req.params.id;
    const updated = db.togglePin(msgId);
    if (!updated) return res.status(404).json({ error: 'Mensagem não encontrada' });

    const formatted = formatMessage(updated);

    if (updated.conversationId) {
      const members = db.getConversationMembers(updated.conversationId);
      for (const mid of members) {
        sendToUser(mid, {
          type: 'chat:pin',
          data: { conversationId: updated.conversationId, messageId: updated.id, isPinned: updated.isPinned }
        });
      }
    }

    res.json({ message: formatted });
  });

  // ==========================================
  // SERVERS & CHANNELS ROUTES
  // ==========================================

  // Get servers for current user
  app.get('/api/servers', authMiddleware, (req: AuthenticatedRequest, res) => {
    const servers = db.getServersForUser(req.user!.id);
    const enriched = servers.map(s => {
      const channels = db.getServerChannels(s.id);
      const categories = db.getServerCategories(s.id);
      const members = db.getServerMembers(s.id).map(u => sanitizeUser(u));

      return {
        ...s,
        channels,
        categories,
        members,
        isOwner: s.ownerId === req.user!.id
      };
    });

    res.json({ servers: enriched });
  });

  // Create server
  app.post('/api/servers', authMiddleware, (req: AuthenticatedRequest, res) => {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome do servidor obrigatório' });
    }

    const server = db.createServer(name.trim(), description || '', req.user!.id);
    const channels = db.getServerChannels(server.id);
    const categories = db.getServerCategories(server.id);
    const members = db.getServerMembers(server.id).map(u => sanitizeUser(u));

    res.status(201).json({
      server: {
        ...server,
        channels,
        categories,
        members,
        isOwner: true
      }
    });
  });

  // Join server with invite code
  app.post('/api/servers/join', authMiddleware, (req: AuthenticatedRequest, res) => {
    const { inviteCode } = req.body;
    if (!inviteCode || !inviteCode.trim()) {
      return res.status(400).json({ error: 'Código de convite obrigatório' });
    }

    const server = db.joinServerByInvite(inviteCode.trim(), req.user!.id);
    if (!server) {
      return res.status(404).json({ error: 'Servidor não encontrado com este código de convite.' });
    }

    const channels = db.getServerChannels(server.id);
    const categories = db.getServerCategories(server.id);
    const members = db.getServerMembers(server.id).map(u => sanitizeUser(u));

    // Notify other server members
    for (const m of members) {
      if (m && m.id !== req.user!.id) {
        sendToUser(m.id, {
          type: 'server:member_joined',
          data: { serverId: server.id, user: sanitizeUser(req.user!) }
        });
      }
    }

    res.json({
      server: {
        ...server,
        channels,
        categories,
        members,
        isOwner: server.ownerId === req.user!.id
      }
    });
  });

  // Create channel in server
  app.post('/api/servers/:serverId/channels', authMiddleware, (req: AuthenticatedRequest, res) => {
    const serverId = req.params.serverId;
    const server = db.getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'Servidor não encontrado' });

    const { name, type, topic, categoryId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nome do canal obrigatório' });

    const channel = db.createChannel(serverId, name.trim(), type || 'text', topic, categoryId);

    // Broadcast to server members
    const members = db.getServerMembers(serverId);
    for (const m of members) {
      sendToUser(m.id, {
        type: 'server:channel_created',
        data: { serverId, channel }
      });
    }

    res.status(201).json({ channel });
  });

  // Get messages of a server channel
  app.get('/api/servers/:serverId/channels/:channelId/messages', authMiddleware, (req: AuthenticatedRequest, res) => {
    const { serverId, channelId } = req.params;
    const server = db.getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'Servidor não encontrado' });

    const msgs = db.getMessagesForChannel(channelId);
    res.json({ messages: msgs.map(formatMessage) });
  });

  // Send message in a server channel
  app.post('/api/servers/:serverId/channels/:channelId/messages', authMiddleware, (req: AuthenticatedRequest, res) => {
    const { serverId, channelId } = req.params;
    const server = db.getServerById(serverId);
    if (!server) return res.status(404).json({ error: 'Servidor não encontrado' });

    const { content, replyTo, attachments } = req.body;
    if ((!content || !content.trim()) && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'Mensagem vazia' });
    }

    const newMsg = db.createMessage({
      channelId,
      authorId: req.user!.id,
      content: (content || '').trim(),
      replyTo,
      attachments: attachments || []
    });

    const formatted = formatMessage(newMsg);

    // Broadcast to all server members
    const members = db.getServerMembers(serverId);
    for (const m of members) {
      sendToUser(m.id, {
        type: 'chat:message',
        data: {
          serverId,
          channelId,
          message: formatted
        }
      });
    }

    res.status(201).json({ message: formatted });
  });

  // Global search (messages, friends, servers, attachments)
  app.get('/api/search', authMiddleware, (req: AuthenticatedRequest, res) => {
    const query = ((req.query.q as string) || '').trim().toLowerCase();
    if (!query) {
      return res.json({ messages: [], friends: [], servers: [], attachments: [] });
    }

    const myId = req.user!.id;
    const friends = db.getFriends(myId).filter(f =>
      f.username.toLowerCase().includes(query) || f.displayName.toLowerCase().includes(query)
    ).map(u => sanitizeUser(u));

    const servers = db.getServersForUser(myId).filter(s =>
      s.name.toLowerCase().includes(query) || (s.description && s.description.toLowerCase().includes(query))
    );

    // Messages user has access to
    const myConvs = db.getConversationsForUser(myId).map(c => c.id);
    const myServers = db.getServersForUser(myId).map(s => s.id);
    const myChannels = myServers.flatMap(sId => db.getServerChannels(sId).map(c => c.id));

    const matchedMessages = db.getAllMessages().filter(m => {
      const hasAccess = (m.conversationId && myConvs.includes(m.conversationId)) ||
                        (m.channelId && myChannels.includes(m.channelId));
      if (!hasAccess) return false;
      return m.content.toLowerCase().includes(query);
    }).slice(-30).map(formatMessage);

    const matchedAttachments: any[] = [];
    db.getAllMessages().forEach(m => {
      const hasAccess = (m.conversationId && myConvs.includes(m.conversationId)) ||
                        (m.channelId && myChannels.includes(m.channelId));
      if (!hasAccess || !m.attachments) return;
      for (const att of m.attachments) {
        if (att.name.toLowerCase().includes(query)) {
          matchedAttachments.push({
            ...att,
            messageId: m.id,
            timestamp: m.timestamp,
            author: sanitizeUser(db.findUserById(m.authorId))
          });
        }
      }
    });

    res.json({
      messages: matchedMessages,
      friends,
      servers,
      attachments: matchedAttachments.slice(0, 20)
    });
  });

  // Vite middleware in dev; static in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Nuggets Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
