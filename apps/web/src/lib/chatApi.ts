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

export interface ReplyPreview {
  id: string;
  senderId: string;
  type: 'text' | 'image' | 'file' | 'call';
  snippet: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'file' | 'call';
  body: string | null;
  imageMime: string | null;
  /** Solo para `type: 'file'`: nombre, mime y tamaño del adjunto. */
  fileName?: string | null;
  fileMime?: string | null;
  fileSize?: number | null;
  createdAt: string;
  reactions?: MessageReaction[];
  /** Acciones de hilo: cita, edición, eliminación, fijado, reenvío. */
  replyToId?: string | null;
  replyTo?: ReplyPreview | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  pinnedAt?: string | null;
  forwarded?: boolean;
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

  sendText: (conversationId: string, body: string, replyToId?: string) =>
    req<ChatMessage>('/messaging/messages', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ conversationId, body, replyToId }),
    }),

  sendImage: (conversationId: string, file: File, replyToId?: string) => {
    const fd = new FormData();
    fd.append('conversationId', conversationId);
    fd.append('file', file);
    if (replyToId) fd.append('replyToId', replyToId);
    return req<ChatMessage>('/messaging/messages/image', {
      method: 'POST',
      headers: authHeaders(false), // sin Content-Type: lo pone el navegador con boundary
      body: fd,
    });
  },

  sendFile: (conversationId: string, file: File, replyToId?: string) => {
    const fd = new FormData();
    fd.append('conversationId', conversationId);
    fd.append('file', file);
    if (replyToId) fd.append('replyToId', replyToId);
    return req<ChatMessage>('/messaging/messages/file', {
      method: 'POST',
      headers: authHeaders(false),
      body: fd,
    });
  },

  editText: (messageId: string, body: string) =>
    req<ChatMessage>(`/messaging/messages/${messageId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ body }),
    }),

  deleteMessage: (messageId: string) =>
    req<ChatMessage>(`/messaging/messages/${messageId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }),

  pinMessage: (messageId: string, pinned: boolean) =>
    req<ChatMessage>(`/messaging/messages/${messageId}/pin`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ pinned }),
    }),

  listPinned: (conversationId: string) =>
    req<ChatMessage[]>(`/messaging/conversations/${conversationId}/pinned`, {
      headers: authHeaders(),
    }),

  forwardMessage: (messageId: string, conversationId: string) =>
    req<ChatMessage>(`/messaging/messages/${messageId}/forward`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ conversationId }),
    }),

  sendCallLog: (
    conversationId: string,
    payload: { media: 'audio' | 'video'; status: string; durationSec: number },
  ) =>
    req<ChatMessage>('/messaging/messages/call', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ conversationId, ...payload }),
    }),

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

/**
 * Descarga un archivo protegido (con Bearer) y dispara el "Guardar como" del
 * navegador con su nombre original. Usa object URL temporal (se libera al
 * terminar). Lanza si la respuesta no es OK.
 */
export async function downloadFile(
  messageId: string,
  fileName: string,
): Promise<void> {
  const res = await fetch(`${CHAT_API_BASE}/messaging/messages/${messageId}/file`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error('No se pudo descargar el archivo');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'archivo';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Da margen al navegador para iniciar la descarga antes de revocar la URL.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
