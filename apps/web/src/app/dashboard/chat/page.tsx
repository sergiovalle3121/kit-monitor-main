'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import {
  ChevronLeft,
  Search,
  Send,
  ImageIcon,
  Smile,
  Hash,
  Plus,
  X,
  CheckCheck,
  AtSign,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { glass } from '@/lib/glass';
import { AuthImage } from '@/components/AuthImage';
import {
  chatApi,
  CHAT_API_BASE,
  ChatConversation,
  ChatMessage,
  ChatUser,
  MessageReaction,
  ReadReceipt,
} from '@/lib/chatApi';

/** Set corto de reacciones rápidas (mini-picker del toolbar de cada mensaje). */
const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '✅', '👀'];

const EMOJIS = ['😀', '😁', '😂', '😉', '😊', '😍', '👍', '🙏', '🔥', '✅', '⚠️', '❌', '🚀', '🛠️', '📦', '🏭'];

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function withinMinutes(a: string, b: string, mins: number): boolean {
  return Math.abs(new Date(b).getTime() - new Date(a).getTime()) <= mins * 60000;
}

/** "Hoy" / "Ayer" / fecha larga, para los separadores por día. */
function dateLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - that.getTime()) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Token `@parcial` al final del borrador (para autocompletar), o null. */
function getMentionQuery(draft: string): string | null {
  const m = /(?:^|\s)@([a-zA-Z0-9._-]*)$/.exec(draft);
  return m ? m[1] : null;
}

/**
 * Renderiza el cuerpo resaltando `@handle` y haciendo clickeables las URLs.
 * Sin `dangerouslySetInnerHTML` (XSS-safe): solo nodos de texto/elementos.
 */
function renderBody(body: string, mine: boolean): React.ReactNode {
  const mentionCls = mine
    ? 'font-semibold rounded bg-white/20 px-0.5'
    : 'font-semibold text-blue-600 dark:text-blue-400';
  const linkCls = mine
    ? 'underline decoration-white/60 break-all'
    : 'text-blue-600 underline break-all dark:text-blue-400';
  return body
    .split(/(https?:\/\/[^\s]+|@[a-zA-Z0-9._-]+)/g)
    .map((part, i) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={linkCls}
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      if (/^@[a-zA-Z0-9._-]+$/.test(part)) {
        return (
          <span key={i} className={mentionCls}>
            {part}
          </span>
        );
      }
      return part;
    });
}

export default function ChatPage() {
  const { user } = useAuth();
  const meId = user?.id ?? '';

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [typingConvo, setTypingConvo] = useState<string | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [reads, setReads] = useState<ReadReceipt[]>([]);
  const [mentionConvos, setMentionConvos] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{
    byUserId: string;
    conversationId: string;
  } | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef(0);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  // Último mensaje MÍO leído por ≥1 otro miembro (para el indicador "Visto").
  const seenInfo = computeSeenInfo(messages, reads, meId);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await chatApi.listConversations());
    } catch {
      /* sin sesión todavía */
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    if (!meId) return;
    let active = true;
    (async () => {
      try {
        const c = await chatApi.listConversations();
        if (active) setConversations(c);
      } catch {
        /* sin sesión todavía */
      }
      try {
        const u = await chatApi.listUsers();
        if (active) setUsers(u);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [meId]);

  // Socket en tiempo real
  useEffect(() => {
    if (!meId) return;
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('axos_access_token')
        : null;
    const socket = io(`${CHAT_API_BASE}/chat`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      // P0: el servidor autentica el handshake con este JWT y deriva el userId
      // del token. El payload de `join` ya no otorga acceso a rooms ajenos.
      auth: { token },
    });
    socket.on('connect', () => socket.emit('join', meId));
    socket.on('message:new', (msg: ChatMessage) => {
      if (msg.conversationId === activeIdRef.current) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        // Si estoy leyendo historial arriba, cuento los nuevos en vez de saltar.
        if (msg.senderId !== meId && !atBottomRef.current) {
          setNewCount((c) => c + 1);
        }
      }
      refreshConversations();
    });
    // Indicador "escribiendo…" (el backend reenvía 'typing' a los miembros).
    socket.on('typing', (p: { conversationId: string }) => {
      if (p?.conversationId !== activeIdRef.current) return;
      setTypingConvo(p.conversationId);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setTypingConvo(null), 2500);
    });
    // Presencia online/offline.
    socket.on('presence:state', (ids: string[]) => setOnlineIds(new Set(ids)));
    socket.on('presence:update', (p: { userId: string; online: boolean }) => {
      setOnlineIds((prev) => {
        const next = new Set(prev);
        if (p.online) next.add(p.userId);
        else next.delete(p.userId);
        return next;
      });
    });
    // Reacciones en vivo. `mine` se recalcula localmente (el broadcast trae la
    // perspectiva del que reaccionó, no la mía).
    socket.on(
      'reaction:update',
      (p: { messageId: string; reactions: MessageReaction[] }) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === p.messageId
              ? {
                  ...m,
                  reactions: p.reactions.map((r) => ({
                    ...r,
                    mine: r.userIds.includes(meId),
                  })),
                }
              : m,
          ),
        );
      },
    );
    // Recibos de lectura ("visto") en vivo.
    socket.on(
      'read:update',
      (p: { conversationId: string; userId: string; lastReadAt: string }) => {
        if (p.conversationId !== activeIdRef.current) return;
        setReads((prev) => [
          ...prev.filter((r) => r.userId !== p.userId),
          { userId: p.userId, lastReadAt: p.lastReadAt },
        ]);
      },
    );
    // @menciones: solo llega a los mencionados → badge + toast.
    socket.on(
      'mention:new',
      (p: { conversationId: string; messageId: string; byUserId: string }) => {
        setMentionConvos((prev) => new Set(prev).add(p.conversationId));
        if (p.conversationId !== activeIdRef.current) {
          setToast({ byUserId: p.byUserId, conversationId: p.conversationId });
        }
        refreshConversations();
      },
    );
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [meId, refreshConversations]);

  // Cargar mensajes al cambiar de conversación + marcar leído + cargar lecturas
  useEffect(() => {
    if (!activeId) return;
    chatApi
      .listMessages(activeId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
    chatApi.listReads(activeId).then(setReads).catch(() => setReads([]));
    chatApi.markRead(activeId).then(refreshConversations).catch(() => {});
  }, [activeId, refreshConversations]);

  // Autoscroll: solo si el usuario ya estaba al final (no lo arrancamos hacia
  // abajo si subió a leer historial).
  useEffect(() => {
    if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Autosize del textarea del composer (DOM, no setState → permitido).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  // Badge de no leídos totales en el título de la pestaña.
  useEffect(() => {
    const total = conversations.reduce((s, c) => s + (c.unread || 0), 0);
    document.title = total > 0 ? `(${total}) Chat · AXOS` : 'Chat · AXOS';
    return () => {
      document.title = 'AXOS';
    };
  }, [conversations]);

  // Auto-dismiss del toast de mención.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Auto-dismiss del toast de error.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(t);
  }, [error]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = dist < 80;
    atBottomRef.current = atBottom;
    setShowJump(!atBottom);
    if (atBottom && newCount !== 0) setNewCount(0);
  }

  function scrollToBottom() {
    atBottomRef.current = true;
    setShowJump(false);
    setNewCount(0);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // Avisa "escribiendo…" a los otros miembros (throttle ~1.5s).
  function emitTyping() {
    const now = Date.now();
    if (now - lastTypingEmitRef.current < 1500) return;
    if (!active || !meId || !socketRef.current) return;
    lastTypingEmitRef.current = now;
    // El servidor deriva miembros y emisor; solo mandamos la conversación.
    socketRef.current.emit('typing', { conversationId: active.id });
  }

  async function handleSendText() {
    const body = draft.trim();
    if (!body || !activeId) return;
    setDraft('');
    setShowEmoji(false);
    atBottomRef.current = true; // al enviar, vuelvo al final
    try {
      const msg = await chatApi.sendText(activeId, body);
      setMessages((prev) => [...prev, msg]);
      refreshConversations();
    } catch {
      setDraft(body); // restaura si falla
    }
  }

  async function handleReact(messageId: string, emoji: string) {
    try {
      const reactions = await chatApi.toggleReaction(messageId, emoji);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
      );
    } catch {
      /* ignore: el broadcast corregirá el estado si aplica */
    }
  }

  async function handleSendImage(file: File) {
    if (!activeId) return;
    atBottomRef.current = true;
    try {
      const msg = await chatApi.sendImage(activeId, file);
      setMessages((prev) => [...prev, msg]);
      refreshConversations();
    } catch (e) {
      setError(`No se pudo enviar la imagen: ${(e as Error).message}`);
    }
  }

  // Selecciona una conversación y limpia su acento de mención (sin setState
  // en efecto: el React Compiler lo prohíbe).
  function openConversation(id: string) {
    setActiveId(id);
    setLoadingMessages(true);
    setMessages([]);
    setReads([]);
    atBottomRef.current = true;
    setShowJump(false);
    setNewCount(0);
    setMentionConvos((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function startDm(userId: string) {
    const convo = await chatApi.openDm(userId);
    await refreshConversations();
    openConversation(convo.id);
    setSearch('');
  }

  // Reemplaza el token `@parcial` final del borrador por `@username `.
  function applyMention(username: string) {
    setDraft((d) => {
      const atIdx = d.lastIndexOf('@');
      if (atIdx < 0) return `${d}@${username} `;
      return `${d.slice(0, atIdx)}@${username} `;
    });
  }

  // Autocompletar @ contra los miembros de la conversación activa.
  const mentionQuery = getMentionQuery(draft);
  const mentionCandidates =
    mentionQuery !== null && active
      ? users
          .filter(
            (u) =>
              active.memberIds.includes(u.id) &&
              (u.username || u.email || '')
                .toLowerCase()
                .includes(mentionQuery.toLowerCase()),
          )
          .slice(0, 6)
      : [];

  const filteredUsers = users.filter(
    (u) =>
      search.trim() &&
      (u.username?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())),
  );

  const channels = conversations.filter((c) => c.type === 'channel');
  const dms = conversations.filter((c) => c.type === 'dm');

  return (
    <div className="min-h-screen text-black dark:text-white font-sans">
      <div className="mx-auto flex h-screen max-w-7xl gap-4 p-4 pt-6">
        {/* ── Columna izquierda ── */}
        <aside
          className={`${glass} ${
            activeId ? 'hidden md:flex' : 'flex'
          } w-full shrink-0 flex-col rounded-[24px] p-4 md:w-80`}
        >
          <div className="mb-4 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
              <ChevronLeft className="h-4 w-4" /> Inicio
            </Link>
            <button
              onClick={() => setShowNewChannel(true)}
              className="flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-black"
            >
              <Plus className="h-3.5 w-3.5" /> Canal
            </button>
          </div>

          {/* Buscador de empleados */}
          <div className={`${glass} mb-3 flex items-center gap-2 rounded-full px-3 py-2`}>
            <Search className="h-4 w-4 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empleado para chatear..."
              className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
            />
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto">
            {/* Resultados de búsqueda → iniciar DM */}
            {filteredUsers.length > 0 && (
              <div className="space-y-1">
                <p className="px-1 text-xs font-medium text-gray-400">Empleados</p>
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => startDm(u.id)}
                    className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-bold text-white">
                      {initials(u.username || u.email)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{u.username || u.email}</span>
                      <span className="block truncate text-xs text-gray-500">{u.role}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {channels.length > 0 && (
              <div className="space-y-1">
                <p className="px-1 text-xs font-medium text-gray-400">Canales</p>
                {channels.map((c) => (
                  <ConversationRow
                    key={c.id}
                    convo={c}
                    active={c.id === activeId}
                    mentioned={mentionConvos.has(c.id)}
                    onClick={() => openConversation(c.id)}
                  />
                ))}
              </div>
            )}

            <div className="space-y-1">
              <p className="px-1 text-xs font-medium text-gray-400">Mensajes directos</p>
              {dms.length === 0 && (
                <p className="px-1 text-xs text-gray-400">Busca un empleado para iniciar un chat.</p>
              )}
              {dms.map((c) => (
                <ConversationRow
                  key={c.id}
                  convo={c}
                  active={c.id === activeId}
                  online={c.counterpartId ? onlineIds.has(c.counterpartId) : undefined}
                  mentioned={mentionConvos.has(c.id)}
                  onClick={() => setActiveId(c.id)}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* ── Panel de mensajes ── */}
        <section
          className={`${glass} relative ${
            activeId ? 'flex' : 'hidden md:flex'
          } min-w-0 flex-1 flex-col rounded-[24px]`}
        >
          {!active ? (
            <div className="flex flex-1 items-center justify-center text-center text-gray-400">
              <div>
                <p className="text-lg font-semibold">Tu chat interno</p>
                <p className="text-sm">Elige una conversación o busca un empleado.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-black/5 px-5 py-4 dark:border-white/10">
                <button
                  onClick={() => setActiveId(null)}
                  className="-ml-1 rounded-full p-1 text-gray-500 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 md:hidden dark:hover:bg-white/10"
                  aria-label="Volver a la lista"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                {active.type === 'channel' ? (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 dark:bg-white/10">
                    <Hash className="h-5 w-5" />
                  </span>
                ) : (
                  <span className="relative">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white">
                      {initials(active.title || '?')}
                    </span>
                    {active.counterpartId && (
                      <PresenceDot online={onlineIds.has(active.counterpartId)} />
                    )}
                  </span>
                )}
                <div>
                  <p className="font-semibold">{active.title || 'Conversación'}</p>
                  <p className="text-xs text-gray-500">
                    {active.type === 'channel'
                      ? `${active.memberIds.length} miembros`
                      : active.counterpartId && onlineIds.has(active.counterpartId)
                        ? 'En línea'
                        : 'Desconectado'}
                  </p>
                </div>
              </div>

              {/* Mensajes */}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-5 py-4"
              >
                {loadingMessages ? (
                  <MessagesSkeleton />
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center text-gray-400">
                    <p className="text-sm font-medium">No hay mensajes todavía</p>
                    <p className="text-xs">Escribe el primero 👋</p>
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const prev = i > 0 ? messages[i - 1] : null;
                    const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
                    const grouped =
                      !!prev &&
                      prev.senderId === m.senderId &&
                      !newDay &&
                      withinMinutes(prev.createdAt, m.createdAt, 5);
                    return (
                      <React.Fragment key={m.id}>
                        {newDay && <DateSeparator iso={m.createdAt} />}
                        <MessageItem
                          m={m}
                          mine={m.senderId === meId}
                          isChannel={active.type === 'channel'}
                          users={users}
                          onlineIds={onlineIds}
                          onReact={handleReact}
                          grouped={grouped}
                        />
                        {i === seenInfo.index && (
                          <ReadIndicator
                            isChannel={active.type === 'channel'}
                            readerIds={seenInfo.readerIds}
                            users={users}
                          />
                        )}
                      </React.Fragment>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Región accesible: anuncia el último mensaje a lectores de pantalla. */}
              <div aria-live="polite" className="sr-only">
                {messages.length > 0
                  ? `${senderName(messages[messages.length - 1].senderId, users)}: ${
                      messages[messages.length - 1].body ?? 'imagen'
                    }`
                  : ''}
              </div>

              {/* Botón flotante "ir al final" con contador de nuevos */}
              {showJump && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-24 right-6 z-20 flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-lg transition-transform hover:scale-105"
                >
                  {newCount > 0
                    ? `${newCount} nuevo${newCount > 1 ? 's' : ''}`
                    : 'Ir al final'}
                  <ChevronDown className="h-4 w-4" />
                </button>
              )}

              {/* Indicador de "escribiendo…" */}
              {typingConvo === activeId && (
                <div className="px-5 pb-1 -mt-1 flex items-center gap-1.5 text-[12px] text-gray-400">
                  <span className="flex gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce" />
                  </span>
                  escribiendo…
                </div>
              )}

              {/* Input */}
              <div className="relative border-t border-black/5 p-3 dark:border-white/10">
                {showEmoji && (
                  <div className={`${glass} absolute bottom-16 left-3 grid grid-cols-8 gap-1 rounded-2xl p-2`}>
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => setDraft((d) => d + e)}
                        className="rounded-lg p-1 text-lg hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
                {mentionCandidates.length > 0 && (
                  <div className={`${glass} absolute bottom-16 left-3 right-3 z-20 max-h-48 overflow-y-auto rounded-2xl p-1`}>
                    {mentionCandidates.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => applyMention(u.username || u.email)}
                        className="flex w-full items-center gap-2 rounded-xl p-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-[10px] font-bold text-white">
                          {initials(u.username || u.email)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{u.username || u.email}</span>
                          <span className="block truncate text-xs text-gray-500">{u.role}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <button
                    onClick={() => setShowEmoji((s) => !s)}
                    className="rounded-full p-2 text-gray-500 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-white/10"
                    aria-label="Emojis"
                  >
                    <Smile className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="rounded-full p-2 text-gray-500 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-white/10"
                    aria-label="Adjuntar imagen"
                  >
                    <ImageIcon className="h-5 w-5" />
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSendImage(f);
                      e.target.value = '';
                    }}
                  />
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    rows={1}
                    aria-label="Escribe un mensaje"
                    onChange={(e) => { setDraft(e.target.value); emitTyping(); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        // Si el autocompletado está abierto, Enter elige el 1.º.
                        if (mentionCandidates.length > 0) {
                          e.preventDefault();
                          const first = mentionCandidates[0];
                          applyMention(first.username || first.email);
                          return;
                        }
                        e.preventDefault();
                        handleSendText();
                      }
                      // Shift+Enter inserta salto de línea (comportamiento nativo).
                    }}
                    placeholder="Escribe un mensaje... (Shift+Enter = salto de línea)"
                    className="max-h-40 flex-1 resize-none rounded-2xl bg-black/5 px-4 py-2 text-sm outline-none placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:bg-white/10"
                  />
                  <button
                    onClick={handleSendText}
                    disabled={!draft.trim()}
                    className="rounded-full bg-blue-600 p-2.5 text-white focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40"
                    aria-label="Enviar"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {showNewChannel && (
        <NewChannelModal
          users={users}
          onClose={() => setShowNewChannel(false)}
          onCreated={async (id) => {
            setShowNewChannel(false);
            await refreshConversations();
            openConversation(id);
          }}
        />
      )}

      {/* Toast de error (reemplaza alert) */}
      {error && (
        <div
          role="alert"
          className={`${glass} fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 rounded-2xl border border-red-500/30 px-4 py-3 text-sm text-red-600 shadow-lg dark:text-red-300`}
        >
          {error}
        </div>
      )}

      {/* Toast de @mención */}
      {toast && (
        <button
          onClick={() => {
            openConversation(toast.conversationId);
            setToast(null);
          }}
          className={`${glass} fixed bottom-6 right-6 z-[300] flex max-w-xs items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-lg`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
            <AtSign className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">
              {senderName(toast.byUserId, users)} te mencionó
            </span>
            <span className="block truncate text-xs text-gray-500">
              Toca para abrir la conversación
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

function senderName(id: string, users: ChatUser[]): string {
  const u = users.find((x) => x.id === id);
  return u?.username || u?.email || 'Usuario';
}

/** Índice del último mensaje mío leído por otro + quiénes lo leyeron. */
function computeSeenInfo(
  messages: ChatMessage[],
  reads: ReadReceipt[],
  meId: string,
): { index: number; readerIds: string[] } {
  const readBy = new Map<string, number>();
  for (const r of reads) {
    if (r.userId === meId || !r.lastReadAt) continue;
    readBy.set(r.userId, new Date(r.lastReadAt).getTime());
  }
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.senderId !== meId) continue;
    const t = new Date(m.createdAt).getTime();
    const readerIds: string[] = [];
    readBy.forEach((lr, uid) => {
      if (lr >= t) readerIds.push(uid);
    });
    if (readerIds.length > 0) return { index: i, readerIds };
  }
  return { index: -1, readerIds: [] };
}

/** Punto de presencia (verde = en línea, gris = desconectado) sobre un avatar. */
function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${
        online ? 'bg-green-500' : 'bg-gray-400'
      }`}
      title={online ? 'En línea' : 'Desconectado'}
      aria-label={online ? 'En línea' : 'Desconectado'}
    />
  );
}

/** Separador de día entre mensajes ("Hoy" / "Ayer" / fecha). */
function DateSeparator({ iso }: { iso: string }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      <span className="rounded-full bg-black/5 px-3 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:bg-white/10">
        {dateLabel(iso)}
      </span>
      <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
    </div>
  );
}

/** Skeleton mientras cargan los mensajes. */
function MessagesSkeleton() {
  const widths = ['w-40', 'w-56', 'w-32', 'w-48', 'w-44'];
  return (
    <div className="space-y-3">
      {widths.map((w, i) => (
        <div key={i} className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`h-8 ${w} animate-pulse rounded-[18px] ${
              i % 2 ? 'bg-blue-600/20' : 'bg-black/5 dark:bg-white/10'
            }`}
          />
        </div>
      ))}
    </div>
  );
}

/** Una burbuja de mensaje con toolbar (hover), reacciones y chips. */
function MessageItem({
  m,
  mine,
  isChannel,
  users,
  onlineIds,
  onReact,
  grouped,
}: {
  m: ChatMessage;
  mine: boolean;
  isChannel: boolean;
  users: ChatUser[];
  onlineIds: Set<string>;
  onReact: (messageId: string, emoji: string) => void;
  grouped: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const reactions = m.reactions ?? [];
  // En canales mostramos avatar + nombre del autor solo al iniciar un grupo.
  const showMeta = isChannel && !mine && !grouped;

  return (
    <div
      className={`group flex items-end gap-2 ${
        mine ? 'justify-end' : 'justify-start'
      } ${grouped ? 'mt-0.5' : 'mt-3'}`}
    >
      {isChannel && !mine && (
        <div className="w-7 shrink-0">
          {showMeta && (
            <span className="relative inline-block">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-[10px] font-bold text-white">
                {initials(senderName(m.senderId, users))}
              </span>
              <PresenceDot online={onlineIds.has(m.senderId)} />
            </span>
          )}
        </div>
      )}
      <div className="relative max-w-[70%]">
        {/* Toolbar al pasar el cursor (oculto en touch) */}
        <div
          className={`pointer-events-none absolute -top-3 z-10 flex items-center gap-1 ${
            mine ? 'left-0' : 'right-0'
          } opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100`}
        >
          <div className="relative">
            <button
              onClick={() => setShowPicker((s) => !s)}
              className={`${glass} flex h-7 w-7 items-center justify-center rounded-full text-gray-600 shadow hover:scale-105 dark:text-gray-200`}
              aria-label="Reaccionar"
            >
              <Smile className="h-4 w-4" />
            </button>
            {showPicker && (
              <div
                className={`${glass} absolute bottom-9 ${
                  mine ? 'left-0' : 'right-0'
                } flex gap-0.5 rounded-full p-1 shadow-lg`}
              >
                {REACTION_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      onReact(m.id, e);
                      setShowPicker(false);
                    }}
                    className="rounded-full p-1 text-lg leading-none transition-transform hover:scale-125"
                    aria-label={`Reaccionar ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Burbuja */}
        <div
          className={`rounded-[18px] px-4 py-2 ${
            mine
              ? 'bg-blue-600 text-white'
              : 'bg-black/5 text-gray-900 dark:bg-white/10 dark:text-gray-100'
          }`}
        >
          {showMeta && (
            <p className="mb-0.5 text-[10px] font-semibold opacity-70">
              {senderName(m.senderId, users)}
            </p>
          )}
          {m.type === 'image' ? (
            <AuthImage messageId={m.id} />
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm">
              {renderBody(m.body ?? '', mine)}
            </p>
          )}
          <p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-gray-500'}`}>
            {timeOf(m.createdAt)}
          </p>
        </div>

        {/* Chips de reacción */}
        {reactions.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${mine ? 'justify-end' : 'justify-start'}`}>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                onClick={() => onReact(m.id, r.emoji)}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors ${
                  r.mine
                    ? 'bg-blue-500/15 text-blue-700 ring-1 ring-blue-500/40 dark:text-blue-300'
                    : 'bg-black/5 text-gray-700 hover:bg-black/10 dark:bg-white/10 dark:text-gray-200'
                }`}
              >
                <span className="leading-none">{r.emoji}</span>
                <span className="font-medium tabular-nums">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Indicador "Visto" bajo mi último mensaje leído (DM: texto; canal: avatares). */
function ReadIndicator({
  isChannel,
  readerIds,
  users,
}: {
  isChannel: boolean;
  readerIds: string[];
  users: ChatUser[];
}) {
  if (readerIds.length === 0) return null;
  return (
    <div className="flex justify-end pr-1 -mt-1">
      {isChannel ? (
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <span>Visto por</span>
          <div className="flex -space-x-1.5">
            {readerIds.slice(0, 5).map((uid) => (
              <span
                key={uid}
                title={senderName(uid, users)}
                className="flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-[7px] font-bold text-white ring-1 ring-white dark:ring-gray-900"
              >
                {initials(senderName(uid, users))}
              </span>
            ))}
          </div>
          {readerIds.length > 5 && <span>+{readerIds.length - 5}</span>}
        </div>
      ) : (
        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
          <CheckCheck className="h-3 w-3" /> Visto
        </span>
      )}
    </div>
  );
}

function ConversationRow({
  convo,
  active,
  online,
  mentioned,
  onClick,
}: {
  convo: ChatConversation;
  active: boolean;
  online?: boolean;
  mentioned?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors ${
        active ? 'bg-black/10 dark:bg-white/15' : 'hover:bg-black/5 dark:hover:bg-white/10'
      }`}
    >
      <span className="relative shrink-0">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-bold text-white">
          {convo.type === 'channel' ? <Hash className="h-4 w-4" /> : initials(convo.title || '?')}
        </span>
        {online !== undefined && <PresenceDot online={online} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{convo.title || 'Conversación'}</span>
        <span className="block truncate text-xs text-gray-500">
          {convo.lastMessage
            ? convo.lastMessage.type === 'image'
              ? '📷 Imagen'
              : convo.lastMessage.body
            : 'Sin mensajes'}
        </span>
      </span>
      {mentioned && (
        <span
          className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white"
          title="Te mencionaron"
        >
          <AtSign className="h-3 w-3" />
        </span>
      )}
      {convo.unread > 0 && (
        <span
          className={`${mentioned ? 'ml-1' : 'ml-auto'} flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white`}
        >
          {convo.unread}
        </span>
      )}
    </button>
  );
}

function NewChannelModal({
  users,
  onClose,
  onCreated,
}: {
  users: ChatUser[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const convo = await chatApi.createChannel(name.trim(), selected);
      onCreated(convo.id);
    } catch (e) {
      setErr(`No se pudo crear el canal: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className={`${glass} w-full max-w-md rounded-[24px] p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Nuevo canal</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre del canal (ej. produccion)"
          className="mb-4 w-full rounded-xl bg-black/5 px-4 py-2 text-sm outline-none dark:bg-white/10"
        />
        <p className="mb-2 text-xs font-medium text-gray-400">Miembros</p>
        <div className="mb-4 max-h-56 space-y-1 overflow-y-auto">
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => toggle(u.id)}
              className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left ${
                selected.includes(u.id) ? 'bg-blue-500/15' : 'hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-[10px] font-bold text-white">
                {initials(u.username || u.email)}
              </span>
              <span className="text-sm">{u.username || u.email}</span>
              {selected.includes(u.id) && <span className="ml-auto text-xs text-blue-500">✓</span>}
            </button>
          ))}
        </div>
        {err && (
          <p className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">
            {err}
          </p>
        )}
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="w-full rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Creando...' : 'Crear canal'}
        </button>
      </div>
    </div>
  );
}
