'use client';

export const CHAT_API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
).replace(/\/$/, '');

/**
 * Origin (esquema+host, SIN path) del API. El WebSocket del chat vive en el
 * namespace `/chat` en el origin — el prefijo HTTP `/api` no aplica a los
 * namespaces de socket.io. Derivarlo así funciona tanto si el base trae `/api`
 * (prod: `…/up.railway.app/api`) como si no (local: `http://localhost:3000`).
 */
export const CHAT_API_ORIGIN = (() => {
  try {
    return new URL(CHAT_API_BASE).origin;
  } catch {
    return CHAT_API_BASE;
  }
})();

function token(): string | null {
  return typeof window !== 'undefined'
    ? window.localStorage.getItem('axos_access_token')
    : null;
}

function authHeaders(json = true): Record<string, string> {
  const t = token();
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CHAT_API_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${text}`.trim());
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

// ── Tipos ──────────────────────────────────────────────────────────────
export interface ChatUser {
  id: string;
  username: string;
  email: string;
  role: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  userIds: string[];
  mine: boolean;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'image';
  body: string | null;
  imageMime: string | null;
  createdAt: string;
  reactions?: MessageReaction[];
}

export interface ReadReceipt {
  userId: string;
  lastReadAt: string | null;
}

export interface ChatConversation {
  id: string;
  type: 'dm' | 'channel';
  title: string | null;
  counterpartId: string | null;
  memberIds: string[];
  lastMessage: { type: string; body: string | null; createdAt: string; senderId: string } | null;
  lastMessageAt: string | null;
  unread: number;
}

// ── Endpoints ──────────────────────────────────────────────────────────
export const chatApi = {
  listUsers: () => req<ChatUser[]>('/messaging/users', { headers: authHeaders() }),

  listConversations: () =>
    req<ChatConversation[]>('/messaging/conversations', { headers: authHeaders() }),

  listMessages: (conversationId: string) =>
    req<ChatMessage[]>(`/messaging/conversations/${conversationId}/messages`, {
      headers: authHeaders(),
    }),

  openDm: (userId: string) =>
    req<{ id: string }>(`/messaging/conversations/dm/${userId}`, {
      method: 'POST',
      headers: authHeaders(),
    }),

  createChannel: (name: string, memberIds: string[]) =>
    req<{ id: string }>('/messaging/conversations/channel', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, memberIds }),
    }),

  sendText: (conversationId: string, body: string) =>
    req<ChatMessage>('/messaging/messages', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ conversationId, body }),
    }),

  sendImage: (conversationId: string, file: File) => {
    const fd = new FormData();
    fd.append('conversationId', conversationId);
    fd.append('file', file);
    return req<ChatMessage>('/messaging/messages/image', {
      method: 'POST',
      headers: authHeaders(false), // sin Content-Type: lo pone el navegador con boundary
      body: fd,
    });
  },

  markRead: (conversationId: string) =>
    req<{ ok: boolean }>(`/messaging/conversations/${conversationId}/read`, {
      method: 'POST',
      headers: authHeaders(),
    }),

  toggleReaction: (messageId: string, emoji: string) =>
    req<MessageReaction[]>(`/messaging/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ emoji }),
    }),

  listReads: (conversationId: string) =>
    req<ReadReceipt[]>(`/messaging/conversations/${conversationId}/reads`, {
      headers: authHeaders(),
    }),
};

/** Trae una imagen protegida (con Bearer) y la devuelve como object URL. */
export async function fetchImageBlob(messageId: string): Promise<string> {
  const res = await fetch(`${CHAT_API_BASE}/messaging/messages/${messageId}/image`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error('No se pudo cargar la imagen');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
