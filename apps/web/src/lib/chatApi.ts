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
  lastSeenAt?: string | null;
}

export interface SearchResult {
  id: string;
  conversationId: string;
  conversationTitle: string;
  conversationType: 'dm' | 'channel';
  senderId: string;
  snippet: string;
  createdAt: string;
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
  type: 'text' | 'image' | 'file' | 'call' | 'poll';
  snippet: string;
}

export interface PollOption {
  id: string;
  text: string;
  count: number;
  userIds: string[];
}
export interface PollData {
  question: string;
  multi: boolean;
  totalVoters: number;
  options: PollOption[];
}

export interface ScheduledItem {
  id: string;
  conversationId: string;
  body: string;
  sendAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'file' | 'call' | 'poll';
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
  expiresAt?: string | null;
  forwarded?: boolean;
  /** Solo para `type: 'poll'`. */
  poll?: PollData | null;
  /** Nº de respuestas directas a este mensaje (hilo). */
  threadCount?: number;
  /** ¿Lo tengo guardado/destacado? */
  saved?: boolean;
}

/** Hilo: mensaje raíz + sus respuestas. */
export interface ThreadData {
  root: ChatMessage;
  replies: ChatMessage[];
}

/** Elemento de la galería de multimedia/archivos de una conversación. */
export interface MediaItem {
  id: string;
  senderId: string;
  type: 'image' | 'file';
  fileName: string | null;
  fileMime: string | null;
  fileSize: number | null;
  imageMime: string | null;
  createdAt: string;
}

/** Elemento de la galería de enlaces compartidos. */
export interface LinkItem {
  id: string;
  senderId: string;
  url: string;
  body: string;
  createdAt: string;
}

/** Previsualización (OpenGraph) de un enlace. */
export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

/** Mensaje guardado con contexto de su conversación. */
export interface SavedItem {
  id: string;
  conversationId: string;
  conversationTitle: string;
  conversationType: 'dm' | 'channel';
  senderId: string;
  type: string;
  snippet: string;
  createdAt: string;
  savedAt: string;
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
  createdById?: string | null;
  disappearingSeconds?: number;
  memberIds: string[];
  lastMessage: { type: string; body: string | null; createdAt: string; senderId: string } | null;
  lastMessageAt: string | null;
  unread: number;
  /** Etiquetas/carpetas personales del usuario para esta conversación. */
  labels?: string[];
  /** Estado personal: fijar / archivar / silenciar / no leído. */
  pinned?: boolean;
  archived?: boolean;
  muted?: boolean;
  mutedUntil?: string | null;
  markedUnread?: boolean;
  /** Canal de anuncios: solo el creador publica. */
  announcement?: boolean;
}

/** Reunión/llamada programada en una conversación. */
export interface Meeting {
  id: string;
  conversationId: string;
  createdById: string;
  title: string;
  startAt: string;
  durationMin: number;
  recurrence: 'none' | 'daily' | 'weekly';
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

  createChannel: (name: string, memberIds: string[], announcement = false) =>
    req<{ id: string }>('/messaging/conversations/channel', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, memberIds, announcement }),
    }),

  setAnnouncement: (conversationId: string, announcement: boolean) =>
    req<{ ok: boolean; announcement: boolean }>(
      `/messaging/conversations/${conversationId}/announcement`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ announcement }),
      },
    ),

  listMeetings: (conversationId: string) =>
    req<Meeting[]>(`/messaging/conversations/${conversationId}/meetings`, {
      headers: authHeaders(),
    }),

  createMeeting: (
    conversationId: string,
    data: {
      title: string;
      startAt: string;
      durationMin: number;
      recurrence: 'none' | 'daily' | 'weekly';
    },
  ) =>
    req<Meeting>(`/messaging/conversations/${conversationId}/meetings`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(data),
    }),

  cancelMeeting: (id: string) =>
    req<{ ok: boolean }>(`/messaging/meetings/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }),

  searchMessages: (q: string) =>
    req<SearchResult[]>(`/messaging/search?q=${encodeURIComponent(q)}`, {
      headers: authHeaders(),
    }),

  addMembers: (conversationId: string, userIds: string[]) =>
    req<{ ok: boolean }>(`/messaging/conversations/${conversationId}/members`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ userIds }),
    }),

  removeMember: (conversationId: string, userId: string) =>
    req<{ ok: boolean }>(
      `/messaging/conversations/${conversationId}/members/${userId}`,
      { method: 'DELETE', headers: authHeaders() },
    ),

  renameChannel: (conversationId: string, name: string) =>
    req<{ ok: boolean }>(`/messaging/conversations/${conversationId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ name }),
    }),

  leaveChannel: (conversationId: string) =>
    req<{ ok: boolean }>(`/messaging/conversations/${conversationId}/leave`, {
      method: 'POST',
      headers: authHeaders(),
    }),

  setDisappearing: (conversationId: string, seconds: number) =>
    req<{ ok: boolean; disappearingSeconds: number }>(
      `/messaging/conversations/${conversationId}/disappearing`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ seconds }),
      },
    ),

  createPoll: (
    conversationId: string,
    question: string,
    options: string[],
    multi: boolean,
  ) =>
    req<ChatMessage>('/messaging/messages/poll', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ conversationId, question, options, multi }),
    }),

  votePoll: (messageId: string, optionId: string) =>
    req<ChatMessage>(`/messaging/messages/${messageId}/vote`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ optionId }),
    }),

  scheduleMessage: (conversationId: string, body: string, sendAt: string) =>
    req<ScheduledItem>('/messaging/messages/schedule', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ conversationId, body, sendAt }),
    }),

  listScheduled: (conversationId: string) =>
    req<ScheduledItem[]>(
      `/messaging/conversations/${conversationId}/scheduled`,
      { headers: authHeaders() },
    ),

  cancelScheduled: (id: string) =>
    req<{ ok: boolean }>(`/messaging/scheduled/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
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

  getThread: (messageId: string) =>
    req<ThreadData>(`/messaging/messages/${messageId}/thread`, {
      headers: authHeaders(),
    }),

  setLabels: (conversationId: string, labels: string[]) =>
    req<{ conversationId: string; labels: string[] }>(
      `/messaging/conversations/${conversationId}/labels`,
      {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ labels }),
      },
    ),

  // ── organización personal (fijar / archivar / silenciar / no leído) ──────
  setPinned: (conversationId: string, pinned: boolean) =>
    req<{ ok: boolean; pinned: boolean }>(
      `/messaging/conversations/${conversationId}/pin`,
      { method: 'POST', headers: authHeaders(), body: JSON.stringify({ pinned }) },
    ),

  setArchived: (conversationId: string, archived: boolean) =>
    req<{ ok: boolean; archived: boolean }>(
      `/messaging/conversations/${conversationId}/archive`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ archived }),
      },
    ),

  setMuted: (conversationId: string, until: string | null) =>
    req<{ ok: boolean; mutedUntil: string | null }>(
      `/messaging/conversations/${conversationId}/mute`,
      { method: 'POST', headers: authHeaders(), body: JSON.stringify({ until }) },
    ),

  setUnread: (conversationId: string, unread: boolean) =>
    req<{ ok: boolean; markedUnread: boolean }>(
      `/messaging/conversations/${conversationId}/unread`,
      { method: 'POST', headers: authHeaders(), body: JSON.stringify({ unread }) },
    ),

  // ── galería + previsualización de enlaces ────────────────────────────────
  listMedia: (conversationId: string, kind: 'image' | 'file' | 'link') =>
    req<MediaItem[] | LinkItem[]>(
      `/messaging/conversations/${conversationId}/media?kind=${kind}`,
      { headers: authHeaders() },
    ),

  unfurl: (url: string) =>
    req<LinkPreview>(`/messaging/unfurl?url=${encodeURIComponent(url)}`, {
      headers: authHeaders(),
    }),

  // ── mensajes guardados ───────────────────────────────────────────────────
  setSaved: (messageId: string, saved: boolean) =>
    req<{ ok: boolean; saved: boolean }>(
      `/messaging/messages/${messageId}/save`,
      { method: 'POST', headers: authHeaders(), body: JSON.stringify({ saved }) },
    ),

  listSaved: () =>
    req<SavedItem[]>('/messaging/saved', { headers: authHeaders() }),
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

/** Trae un archivo protegido (con Bearer) como object URL (p. ej. audio). */
export async function fetchFileBlobUrl(messageId: string): Promise<string> {
  const res = await fetch(`${CHAT_API_BASE}/messaging/messages/${messageId}/file`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error('No se pudo cargar el archivo');
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
