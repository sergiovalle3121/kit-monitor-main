'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import {
  ChevronLeft,
  Search,
  Send,
  Smile,
  Hash,
  Plus,
  X,
  CheckCheck,
  AtSign,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  RotateCcw,
  Phone,
  Video,
  PhoneMissed,
  Maximize2,
  Paperclip,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { glass } from '@/lib/glass';
import { AuthImage } from '@/components/AuthImage';
import { IconTile } from '@/components/ui/IconTile';
import {
  chatApi,
  CHAT_API_ORIGIN,
  ChatConversation,
  ChatMessage,
  ChatUser,
  MessageReaction,
  ReadReceipt,
} from '@/lib/chatApi';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { FileAttachment } from '@/components/chat/FileAttachment';
import { CallOverlay } from '@/components/chat/CallOverlay';
import { useCall } from '@/hooks/useCall';
import { callsSupported } from '@/lib/chat/webrtc';
import { renderMessageText, hasTable } from '@/lib/chat/markdown';
import { isEmojiOnly, emojiGlyphCount } from '@/lib/chat/stickers';
import { parseStickerId, getSticker } from '@/lib/chat/stickerImages';
import { formatBytes } from '@/lib/chat/format';
import { QUICK_REACTIONS } from '@/lib/chat/emojis';

/** Set corto de reacciones rápidas (mini-picker del toolbar de cada mensaje). */
const REACTION_EMOJIS = QUICK_REACTIONS;

/** Emojis del grid "más" del picker de reacciones de cada mensaje. */
const EMOJIS = ['😀', '😁', '😂', '😉', '😊', '😍', '👍', '🙏', '🔥', '✅', '⚠️', '❌', '🚀', '🛠️', '📦', '🏭'];

/**
 * Mensaje en UI = mensaje del servidor + metadatos optimistas de envío. Los
 * campos extra solo existen mientras un mensaje está "en vuelo" o falló; al
 * confirmarse, el temporal se reemplaza por el mensaje real del servidor.
 */
type UiMessage = ChatMessage & {
  status?: 'sending' | 'failed';
  localPreviewUrl?: string; // object URL para previsualizar la imagen optimista
  pendingFile?: File; // se conserva para reintentar una imagen/archivo fallido
  pendingText?: string; // se conserva para reintentar un texto fallido
};

/** Id temporal para el mensaje optimista (se descarta al reconciliar). */
function makeTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Reemplaza el temporal `tempId` por el mensaje real del servidor. Si el socket
 * ya lo había insertado (eco al emisor), solo quita el temporal (sin duplicar).
 */
function reconcileSent(
  prev: UiMessage[],
  tempId: string,
  serverMsg: ChatMessage,
): UiMessage[] {
  const withoutTemp = prev.filter((m) => m.id !== tempId);
  if (withoutTemp.some((m) => m.id === serverMsg.id)) return withoutTemp;
  return [...withoutTemp, serverMsg];
}

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

export interface ChatExperienceProps {
  /** 'page' = pantalla completa; 'dock' = panel flotante compacto (1 columna). */
  variant?: 'page' | 'dock';
  /** En el dock: cerrar el panel. */
  onClose?: () => void;
}

export function ChatExperience({ variant = 'page', onClose }: ChatExperienceProps) {
  const single = variant === 'dock';
  const { user } = useAuth();
  const meId = user?.id ?? '';

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState('');
  // Imagen elegida, en preview antes de confirmar el envío.
  const [pendingImage, setPendingImage] = useState<{ file: File; url: string } | null>(null);
  const [search, setSearch] = useState('');
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
  // Búsqueda dentro de la conversación abierta (sobre los mensajes cargados).
  const [searchOpen, setSearchOpen] = useState(false);
  const [convoSearch, setConvoSearch] = useState('');
  const [searchIdx, setSearchIdx] = useState(0);
  // Autocorrector del composer (persistido).
  const [autocorrect, setAutocorrect] = useState(true);
  // Socket en estado (además del ref) para que useCall enganche sus listeners.
  const [socket, setSocket] = useState<Socket | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const activeIdRef = useRef<string | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef(0);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Hidrata la preferencia de autocorrector.
  useEffect(() => {
    try {
      const v = window.localStorage.getItem('axos_chat_autocorrect');
      if (v !== null) setAutocorrect(v === '1');
    } catch {
      /* almacenamiento no disponible */
    }
  }, []);
  const changeAutocorrect = useCallback((b: boolean) => {
    setAutocorrect(b);
    try {
      window.localStorage.setItem('axos_chat_autocorrect', b ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  // Llamadas WebRTC (1:1 en DMs).
  const {
    call,
    localStream,
    remotes,
    micOn,
    camOn,
    startCall,
    acceptCall,
    rejectCall,
    hangup,
    toggleMic,
    toggleCam,
  } = useCall({ socket, meId });

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  // Último mensaje MÍO leído por ≥1 otro miembro (para el indicador "Visto").
  const seenInfo = computeSeenInfo(messages, reads, meId);

  // Búsqueda en la conversación: índices de mensajes de texto que contienen el
  // término (los mensajes ya están cargados en cliente; no requiere backend).
  const searchTerm = searchOpen ? convoSearch.trim() : '';
  const searchMatches = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!q) return [] as number[];
    const out: number[] = [];
    messages.forEach((m, i) => {
      if (m.type === 'text' && (m.body ?? '').toLowerCase().includes(q)) out.push(i);
    });
    return out;
  }, [messages, searchTerm]);
  const activeMatchIndex =
    searchMatches.length > 0 ? Math.min(searchIdx, searchMatches.length - 1) : -1;
  const currentMatchMsgId =
    activeMatchIndex >= 0 ? messages[searchMatches[activeMatchIndex]].id : null;

  // Centra el resultado activo al navegar entre coincidencias (solo DOM).
  useEffect(() => {
    if (!currentMatchMsgId) return;
    document
      .getElementById(`msg-${currentMatchMsgId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentMatchMsgId]);

  function gotoMatch(dir: 1 | -1) {
    if (searchMatches.length === 0) return;
    setSearchIdx((i) => (i + dir + searchMatches.length) % searchMatches.length);
  }
  function closeConvoSearch() {
    setSearchOpen(false);
    setConvoSearch('');
    setSearchIdx(0);
  }

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
    let alive = true;
    (async () => {
      try {
        const c = await chatApi.listConversations();
        if (alive) setConversations(c);
      } catch {
        /* sin sesión todavía */
      }
      try {
        const u = await chatApi.listUsers();
        if (alive) setUsers(u);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [meId]);

  // Socket en tiempo real
  useEffect(() => {
    if (!meId) return;
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('axos_access_token')
        : null;
    const s = io(`${CHAT_API_ORIGIN}/chat`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      auth: { token },
    });
    s.on('connect', () => s.emit('join', meId));
    s.on('message:new', (msg: ChatMessage) => {
      if (msg.conversationId === activeIdRef.current) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (msg.senderId !== meId && !atBottomRef.current) {
          setNewCount((c) => c + 1);
        }
      }
      refreshConversations();
    });
    s.on('typing', (p: { conversationId: string }) => {
      if (p?.conversationId !== activeIdRef.current) return;
      setTypingConvo(p.conversationId);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setTypingConvo(null), 2500);
    });
    s.on('presence:state', (ids: string[]) => setOnlineIds(new Set(ids)));
    s.on('presence:update', (p: { userId: string; online: boolean }) => {
      setOnlineIds((prev) => {
        const next = new Set(prev);
        if (p.online) next.add(p.userId);
        else next.delete(p.userId);
        return next;
      });
    });
    s.on(
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
    s.on(
      'read:update',
      (p: { conversationId: string; userId: string; lastReadAt: string }) => {
        if (p.conversationId !== activeIdRef.current) return;
        setReads((prev) => [
          ...prev.filter((r) => r.userId !== p.userId),
          { userId: p.userId, lastReadAt: p.lastReadAt },
        ]);
      },
    );
    s.on(
      'mention:new',
      (p: { conversationId: string; messageId: string; byUserId: string }) => {
        setMentionConvos((prev) => new Set(prev).add(p.conversationId));
        if (p.conversationId !== activeIdRef.current) {
          setToast({ byUserId: p.byUserId, conversationId: p.conversationId });
        }
        refreshConversations();
      },
    );
    socketRef.current = s;
    setSocket(s);
    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
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

  // Autoscroll: solo si el usuario ya estaba al final.
  useEffect(() => {
    if (atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Badge de no leídos totales en el título de la pestaña (solo página completa).
  useEffect(() => {
    if (single) return;
    const total = conversations.reduce((s, c) => s + (c.unread || 0), 0);
    document.title = total > 0 ? `(${total}) Chat · AXOS` : 'Chat · AXOS';
    return () => {
      document.title = 'AXOS';
    };
  }, [conversations, single]);

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

  // Libera el object URL del preview al cambiar de imagen o desmontar.
  useEffect(() => {
    if (!pendingImage) return;
    return () => URL.revokeObjectURL(pendingImage.url);
  }, [pendingImage]);

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
    socketRef.current.emit('typing', { conversationId: active.id });
  }

  // Envío optimista de texto.
  async function enqueueText(conversationId: string, body: string) {
    const tempId = makeTempId();
    const optimistic: UiMessage = {
      id: tempId,
      conversationId,
      senderId: meId,
      type: 'text',
      body,
      imageMime: null,
      createdAt: new Date().toISOString(),
      status: 'sending',
      pendingText: body,
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const msg = await chatApi.sendText(conversationId, body);
      setMessages((prev) => reconcileSent(prev, tempId, msg));
      refreshConversations();
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)),
      );
    }
  }

  // Envío optimista de imagen.
  async function enqueueImage(conversationId: string, file: File) {
    const tempId = makeTempId();
    const localPreviewUrl = URL.createObjectURL(file);
    const optimistic: UiMessage = {
      id: tempId,
      conversationId,
      senderId: meId,
      type: 'image',
      body: null,
      imageMime: file.type || 'image/*',
      createdAt: new Date().toISOString(),
      status: 'sending',
      localPreviewUrl,
      pendingFile: file,
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const msg = await chatApi.sendImage(conversationId, file);
      setMessages((prev) => reconcileSent(prev, tempId, msg));
      refreshConversations();
      URL.revokeObjectURL(localPreviewUrl);
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)),
      );
      setError(`No se pudo enviar la imagen: ${(e as Error).message}`);
    }
  }

  // Envío optimista de archivo genérico.
  async function enqueueFile(conversationId: string, file: File) {
    const tempId = makeTempId();
    const optimistic: UiMessage = {
      id: tempId,
      conversationId,
      senderId: meId,
      type: 'file',
      body: null,
      imageMime: null,
      fileName: file.name,
      fileMime: file.type || 'application/octet-stream',
      fileSize: file.size,
      createdAt: new Date().toISOString(),
      status: 'sending',
      pendingFile: file,
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const msg = await chatApi.sendFile(conversationId, file);
      setMessages((prev) => reconcileSent(prev, tempId, msg));
      refreshConversations();
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)),
      );
      setError(`No se pudo enviar el archivo: ${(e as Error).message}`);
    }
  }

  function submitText(text: string) {
    if (!activeId) return;
    atBottomRef.current = true;
    enqueueText(activeId, text);
  }

  function attachImage(file: File) {
    setPendingImage({ file, url: URL.createObjectURL(file) });
  }

  function attachFile(file: File) {
    if (!activeId) return;
    atBottomRef.current = true;
    enqueueFile(activeId, file);
  }

  // Confirma el envío de la imagen en preview.
  function confirmSendImage() {
    if (!pendingImage || !activeId) return;
    atBottomRef.current = true;
    enqueueImage(activeId, pendingImage.file);
    setPendingImage(null);
  }

  // Reintenta un mensaje que falló (quita la burbuja fallida y reenvía).
  function retrySend(m: UiMessage) {
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    if (m.type === 'image' && m.pendingFile) {
      if (m.localPreviewUrl) URL.revokeObjectURL(m.localPreviewUrl);
      enqueueImage(m.conversationId, m.pendingFile);
    } else if (m.type === 'file' && m.pendingFile) {
      enqueueFile(m.conversationId, m.pendingFile);
    } else {
      const text = m.pendingText ?? m.body;
      if (text) enqueueText(m.conversationId, text);
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

  // Selecciona una conversación y limpia su acento de mención.
  function openConversation(id: string) {
    setActiveId(id);
    setLoadingMessages(true);
    setMessages([]);
    setReads([]);
    atBottomRef.current = true;
    setShowJump(false);
    setNewCount(0);
    setSearchOpen(false);
    setConvoSearch('');
    setSearchIdx(0);
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

  const filteredUsers = users.filter(
    (u) =>
      search.trim() &&
      (u.username?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())),
  );

  const channels = conversations.filter((c) => c.type === 'channel');
  const dms = conversations.filter((c) => c.type === 'dm');

  // Miembros de la conversación activa (para autocompletar @menciones).
  const activeMembers = useMemo(
    () => (active ? users.filter((u) => active.memberIds.includes(u.id)) : []),
    [active, users],
  );

  // Roster de "en línea": compañeros conectados ahora (sin contarme a mí).
  const onlineUsers = useMemo(
    () => users.filter((u) => u.id !== meId && onlineIds.has(u.id)),
    [users, onlineIds, meId],
  );

  const surface = single ? '' : glass;
  // Llamadas: DMs y canales (grupo). Necesita ≥2 miembros.
  const canCall = callsSupported() && !!active && active.memberIds.length >= 2;

  const aside = (
    <aside
      className={`${surface} ${
        single
          ? activeId
            ? 'hidden'
            : 'flex'
          : activeId
            ? 'hidden md:flex'
            : 'flex'
      } w-full shrink-0 flex-col ${single ? 'min-h-0 p-3' : 'rounded-[24px] p-4 md:w-80'}`}
    >
      {/* Acento de dominio (mensajería) */}
      <div className="mb-3 flex items-center gap-2.5">
        <IconTile domain="messaging" size={single ? 28 : 34} />
        <span className="text-base font-bold tracking-tight">Mensajería</span>
        {single && (
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/dashboard/chat"
              onClick={onClose}
              aria-label="Abrir en pantalla completa"
              title="Abrir en pantalla completa"
              className="rounded-full p-1.5 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Maximize2 className="h-4 w-4" />
            </Link>
            <button
              onClick={onClose}
              aria-label="Cerrar mensajería"
              className="rounded-full p-1.5 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
      <div className="mb-4 flex items-center justify-between">
        {single ? (
          <span className="text-xs text-gray-400">Tu chat interno</span>
        ) : (
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <ChevronLeft className="h-4 w-4" /> Inicio
          </Link>
        )}
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

        {onlineUsers.length > 0 && (
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 px-1 text-xs font-medium text-gray-400">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              En línea · {onlineUsers.length}
            </p>
            {onlineUsers.map((u) => (
              <button
                key={u.id}
                onClick={() => startDm(u.id)}
                className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="relative shrink-0">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-bold text-white">
                    {initials(u.username || u.email)}
                  </span>
                  <PresenceDot online />
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
              onClick={() => openConversation(c.id)}
            />
          ))}
        </div>
      </div>
    </aside>
  );

  const section = (
    <section
      className={`${surface} relative ${
        single
          ? activeId
            ? 'flex'
            : 'hidden'
          : activeId
            ? 'flex'
            : 'hidden md:flex'
      } min-w-0 flex-1 flex-col ${single ? 'min-h-0' : 'rounded-[24px]'}`}
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
          <div className="border-b border-black/5 dark:border-white/10">
            <div className="flex items-center gap-3 px-5 py-4">
              <button
                onClick={() => setActiveId(null)}
                className={`-ml-1 rounded-full p-1 text-gray-500 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-white/10 ${
                  single ? '' : 'md:hidden'
                }`}
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
              <div className="min-w-0">
                <p className="truncate font-semibold">{active.title || 'Conversación'}</p>
                <p className="text-xs text-gray-500">
                  {active.type === 'channel'
                    ? `${active.memberIds.length} miembros`
                    : active.counterpartId && onlineIds.has(active.counterpartId)
                      ? 'En línea'
                      : 'Desconectado'}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                {canCall && (
                  <>
                    <button
                      onClick={() => startCall(active.id, 'audio')}
                      disabled={!!call}
                      className="rounded-full p-2 text-gray-500 transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40 dark:hover:bg-white/10"
                      aria-label="Llamar"
                      title={active.type === 'channel' ? 'Llamada de grupo' : 'Llamada de voz'}
                    >
                      <Phone className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => startCall(active.id, 'video')}
                      disabled={!!call}
                      className="rounded-full p-2 text-gray-500 transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40 dark:hover:bg-white/10"
                      aria-label="Videollamada"
                      title={active.type === 'channel' ? 'Videollamada de grupo' : 'Videollamada'}
                    >
                      <Video className="h-5 w-5" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => (searchOpen ? closeConvoSearch() : setSearchOpen(true))}
                  className={`rounded-full p-2 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                    searchOpen
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300'
                      : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                  aria-label="Buscar en la conversación"
                  title="Buscar en la conversación"
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>
            </div>

            {searchOpen && (
              <ConvoSearchBar
                value={convoSearch}
                matchCount={searchMatches.length}
                activeIndex={activeMatchIndex}
                onChange={(v) => {
                  setConvoSearch(v);
                  setSearchIdx(0);
                }}
                onPrev={() => gotoMatch(-1)}
                onNext={() => gotoMatch(1)}
                onClose={closeConvoSearch}
              />
            )}
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
                      onRetry={retrySend}
                      grouped={grouped}
                      highlight={searchTerm}
                      isCurrentMatch={m.id === currentMatchMsgId}
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
                  messages[messages.length - 1].body ?? 'adjunto'
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

          {/* Composer */}
          <div className="border-t border-black/5 p-3 dark:border-white/10">
            {/* Preview de la imagen elegida (antes de confirmar el envío) */}
            {pendingImage && (
              <div className={`${glass} mb-2 flex items-center gap-3 rounded-2xl p-2`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingImage.url}
                  alt="Vista previa"
                  className="h-16 w-16 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{pendingImage.file.name}</p>
                  <p className="text-xs text-gray-500">
                    {formatBytes(pendingImage.file.size)} · listo para enviar
                  </p>
                </div>
                <button
                  onClick={() => setPendingImage(null)}
                  className="rounded-full p-1.5 text-gray-500 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-white/10"
                  aria-label="Descartar imagen"
                >
                  <X className="h-4 w-4" />
                </button>
                <button
                  onClick={confirmSendImage}
                  className="flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  <Send className="h-3.5 w-3.5" /> Enviar
                </button>
              </div>
            )}
            <MessageComposer
              value={draft}
              onChange={setDraft}
              onSubmitText={submitText}
              onAttachImage={attachImage}
              onAttachFile={attachFile}
              onTyping={emitTyping}
              mentionUsers={activeMembers}
              autocorrect={autocorrect}
              onAutocorrectChange={changeAutocorrect}
              compact={single}
            />
          </div>
        </>
      )}
    </section>
  );

  return (
    <div
      className={
        single
          ? 'flex h-full min-h-0 w-full text-black dark:text-white font-sans'
          : 'min-h-screen text-black dark:text-white font-sans'
      }
    >
      {single ? (
        <>
          {aside}
          {section}
        </>
      ) : (
        <div className="mx-auto flex h-screen max-w-7xl gap-4 p-4 pt-6">
          {aside}
          {section}
        </div>
      )}

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

      {/* Overlay de llamada (WebRTC, 1:1 y grupo) */}
      {call && (
        <CallOverlay
          call={call}
          localStream={localStream}
          remotes={remotes.map((r) => ({
            ...r,
            name: senderName(r.userId, users),
            initials: initials(senderName(r.userId, users)),
          }))}
          micOn={micOn}
          camOn={camOn}
          title={
            conversations.find((c) => c.id === call.conversationId)?.title ||
            'Llamada'
          }
          incomingName={
            call.initiatorId ? senderName(call.initiatorId, users) : 'Llamada'
          }
          incomingInitials={
            call.initiatorId
              ? initials(senderName(call.initiatorId, users))
              : '··'
          }
          onAccept={acceptCall}
          onReject={rejectCall}
          onHangup={hangup}
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
        />
      )}

      {/* Toast de error */}
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

/** Tamaño grande para mensajes de solo emoji ("stickers"). */
function jumboClass(body: string): string {
  const n = emojiGlyphCount(body);
  return n <= 1 ? 'text-5xl' : n <= 3 ? 'text-4xl' : 'text-3xl';
}

/** Parsea el cuerpo JSON de un mensaje de llamada (`type: 'call'`). */
function parseCallLog(body: string | null): {
  media: 'audio' | 'video';
  status: string;
  durationSec: number;
} {
  try {
    const o = JSON.parse(body ?? '{}');
    return {
      media: o.media === 'video' ? 'video' : 'audio',
      status: typeof o.status === 'string' ? o.status : 'completed',
      durationSec: Number(o.durationSec) || 0,
    };
  } catch {
    return { media: 'audio', status: 'completed', durationSec: 0 };
  }
}

function formatCallDuration(sec: number): string {
  if (sec <= 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} min ${s}s` : `${s}s`;
}

/** Chip centrado con el resultado de una llamada (historial / perdidas). */
function CallLogItem({ m, mine }: { m: UiMessage; mine: boolean }) {
  const info = parseCallLog(m.body);
  const missed = info.status === 'missed';
  const Icon = missed
    ? PhoneMissed
    : info.media === 'video'
      ? Video
      : Phone;
  let label: string;
  if (info.status === 'completed') {
    const dur = formatCallDuration(info.durationSec);
    label =
      (info.media === 'video' ? 'Videollamada' : 'Llamada') +
      (dur ? ` · ${dur}` : '');
  } else if (info.status === 'declined') {
    label = 'Llamada rechazada';
  } else if (info.status === 'canceled') {
    label = 'Llamada cancelada';
  } else {
    label = mine ? 'Llamada sin respuesta' : 'Llamada perdida';
  }
  return (
    <div className="my-3 flex justify-center">
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
          missed
            ? 'bg-red-500/10 text-red-600 dark:text-red-300'
            : 'bg-black/5 text-gray-600 dark:bg-white/10 dark:text-gray-300'
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        <span className="opacity-60">{timeOf(m.createdAt)}</span>
      </span>
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
  onRetry,
  grouped,
  highlight = '',
  isCurrentMatch = false,
}: {
  m: UiMessage;
  mine: boolean;
  isChannel: boolean;
  users: ChatUser[];
  onlineIds: Set<string>;
  onReact: (messageId: string, emoji: string) => void;
  onRetry?: (m: UiMessage) => void;
  grouped: boolean;
  highlight?: string;
  isCurrentMatch?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Registro de llamada: chip centrado tipo sistema (no es una burbuja normal).
  if (m.type === 'call') return <CallLogItem m={m} mine={mine} />;

  const reactions = m.reactions ?? [];
  const sending = m.status === 'sending';
  const failed = m.status === 'failed';
  const showMeta = isChannel && !mine && !grouped;

  const body = m.body ?? '';
  const isFile = m.type === 'file';
  const isImage = m.type === 'image';
  const stickerId = m.type === 'text' ? parseStickerId(body) : null;
  const emojiOnly = m.type === 'text' && !stickerId && isEmojiOnly(body);
  const bare = emojiOnly || !!stickerId; // sin fondo de burbuja
  const wide = m.type === 'text' && !stickerId && !!body && hasTable(body);

  return (
    <div
      id={`msg-${m.id}`}
      className={`group flex items-end gap-2 scroll-mt-24 rounded-2xl transition-colors ${
        mine ? 'justify-end' : 'justify-start'
      } ${grouped ? 'mt-0.5' : 'mt-3'} ${
        isCurrentMatch ? 'bg-yellow-300/10 ring-2 ring-yellow-400/70' : ''
      }`}
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
      <div className={`relative ${wide ? 'max-w-[92%]' : 'max-w-[78%]'}`}>
        {/* Toolbar al pasar el cursor (oculto en touch y en mensajes en vuelo) */}
        {!sending && !failed && (
          <div
            className={`pointer-events-none absolute -top-3 z-10 flex items-center gap-1 ${
              mine ? 'left-0' : 'right-0'
            } opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100`}
          >
            <div className="relative">
              <button
                onClick={() => {
                  setShowPicker((s) => !s);
                  setShowMore(false);
                }}
                className={`${glass} flex h-7 w-7 items-center justify-center rounded-full text-gray-600 shadow hover:scale-105 dark:text-gray-200`}
                aria-label="Reaccionar"
              >
                <Smile className="h-4 w-4" />
              </button>
              {showPicker && (
                <div
                  className={`${glass} absolute bottom-9 z-20 ${
                    mine ? 'left-0' : 'right-0'
                  } rounded-2xl p-1 shadow-lg`}
                >
                  <div className="flex items-center gap-0.5">
                    {REACTION_EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => {
                          onReact(m.id, e);
                          setShowPicker(false);
                          setShowMore(false);
                        }}
                        className="rounded-full p-1 text-lg leading-none transition-transform hover:scale-125"
                        aria-label={`Reaccionar ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowMore((s) => !s)}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-white/10"
                      aria-label="Más emojis"
                      aria-expanded={showMore}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {showMore && (
                    <div className="mt-1 grid w-52 grid-cols-8 gap-0.5 border-t border-black/10 pt-1 dark:border-white/10">
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          onClick={() => {
                            onReact(m.id, e);
                            setShowPicker(false);
                            setShowMore(false);
                          }}
                          className="rounded-lg p-1 text-lg leading-none transition-transform hover:scale-125"
                          aria-label={`Reaccionar ${e}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Contenido */}
        {isFile ? (
          <div>
            {showMeta && (
              <p className="mb-0.5 text-[10px] font-semibold text-gray-500">
                {senderName(m.senderId, users)}
              </p>
            )}
            {sending ? (
              <div className="flex w-60 max-w-full items-center gap-3 rounded-2xl bg-black/5 p-2.5 opacity-70 dark:bg-white/10">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/10 dark:bg-white/15">
                  <Paperclip className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{m.fileName}</span>
                  <span className="block text-xs text-gray-500">Enviando…</span>
                </span>
              </div>
            ) : (
              <FileAttachment
                messageId={m.id}
                fileName={m.fileName || 'archivo'}
                fileMime={m.fileMime}
                fileSize={m.fileSize ?? undefined}
                mine={mine}
              />
            )}
            <div
              className={`mt-1 flex items-center gap-1 text-[10px] text-gray-500 ${
                mine ? 'justify-end' : ''
              }`}
            >
              <span>{timeOf(m.createdAt)}</span>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-[18px] ${sending ? 'opacity-70' : ''} ${
              isImage ? 'p-1' : bare ? 'px-1 py-0.5' : 'px-4 py-2'
            } ${
              bare
                ? ''
                : mine
                  ? 'bg-blue-600 text-white'
                  : 'bg-black/5 text-gray-900 dark:bg-white/10 dark:text-gray-100'
            }`}
          >
            {showMeta && (
              <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                {senderName(m.senderId, users)}
              </p>
            )}
            {isImage ? (
              m.localPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.localPreviewUrl}
                  alt="imagen"
                  className="max-h-72 max-w-[18rem] rounded-[18px] object-cover"
                />
              ) : (
                <AuthImage messageId={m.id} />
              )
            ) : stickerId ? (
              <span className="block h-32 w-32">{getSticker(stickerId)?.node}</span>
            ) : emojiOnly ? (
              <p className={`${jumboClass(body)} leading-tight`}>{body}</p>
            ) : (
              <div className="break-words text-sm leading-relaxed">
                {renderMessageText(body, { mine, highlight })}
              </div>
            )}
            <div
              className={`mt-1 flex items-center gap-1 text-[10px] ${
                bare
                  ? 'text-gray-500'
                  : mine
                    ? 'justify-end text-white/70'
                    : 'text-gray-500'
              } ${bare && mine ? 'justify-end' : ''}`}
            >
              <span>{timeOf(m.createdAt)}</span>
              {sending && (
                <>
                  <Clock className="h-3 w-3" />
                  <span>Enviando…</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Estado "no enviado" + reintentar */}
        {failed && (
          <div className="mt-1 flex items-center justify-end gap-1.5 text-[11px] text-red-500">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>No se envió</span>
            <button
              onClick={() => onRetry?.(m)}
              className="inline-flex items-center gap-1 font-semibold underline hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/40"
            >
              <RotateCcw className="h-3 w-3" /> Reintentar
            </button>
          </div>
        )}

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

/** Barra de búsqueda dentro de la conversación abierta. */
function ConvoSearchBar({
  value,
  matchCount,
  activeIndex,
  onChange,
  onPrev,
  onNext,
  onClose,
}: {
  value: string;
  matchCount: number;
  activeIndex: number;
  onChange: (v: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-5 pb-3">
      <div className={`${glass} flex flex-1 items-center gap-2 rounded-full px-3 py-1.5`}>
        <Search className="h-4 w-4 shrink-0 text-gray-500" />
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (e.shiftKey) onPrev();
              else onNext();
            }
          }}
          placeholder="Buscar en esta conversación..."
          aria-label="Buscar en esta conversación"
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
        />
        {value.trim() !== '' && (
          <span className="shrink-0 text-xs tabular-nums text-gray-500">
            {matchCount === 0 ? 'Sin resultados' : `${activeIndex + 1} de ${matchCount}`}
          </span>
        )}
      </div>
      <button
        onClick={onPrev}
        disabled={matchCount === 0}
        className="rounded-full p-1.5 text-gray-500 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-30 dark:hover:bg-white/10"
        aria-label="Resultado anterior"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        onClick={onNext}
        disabled={matchCount === 0}
        className="rounded-full p-1.5 text-gray-500 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-30 dark:hover:bg-white/10"
        aria-label="Resultado siguiente"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      <button
        onClick={onClose}
        className="rounded-full p-1.5 text-gray-500 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-white/10"
        aria-label="Cerrar búsqueda"
      >
        <X className="h-4 w-4" />
      </button>
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
  const lastPreview = convo.lastMessage
    ? convo.lastMessage.type === 'image'
      ? '📷 Imagen'
      : convo.lastMessage.type === 'file'
        ? '📎 Archivo'
        : convo.lastMessage.type === 'call'
          ? '📞 Llamada'
          : convo.lastMessage.body && parseStickerId(convo.lastMessage.body)
            ? '🎟️ Sticker'
            : convo.lastMessage.body
    : 'Sin mensajes';
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
        <span className="block truncate text-xs text-gray-500">{lastPreview}</span>
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
