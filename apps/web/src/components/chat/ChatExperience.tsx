'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
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
  MoreHorizontal,
  Reply,
  CornerUpRight,
  Pin,
  PinOff,
  Pencil,
  Trash2,
  Users,
  UserPlus,
  LogOut,
  Check,
  BarChart3,
  Timer,
  CalendarClock,
  CheckCircle2,
  Circle,
  MapPin,
  Languages,
  ExternalLink,
  Tag,
  MessageSquare,
  MoreVertical,
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  Mail,
  MailOpen,
  Images,
  Bookmark,
  BookmarkCheck,
  Link2,
  FileText,
  Sparkles,
  Megaphone,
  CalendarPlus,
  Wand2,
  Repeat,
  Command,
  Loader2,
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
  ReplyPreview,
  SearchResult,
  ScheduledItem,
  MediaItem,
  LinkItem,
  SavedItem,
  Meeting,
} from '@/lib/chatApi';
import { aiCatchUp, aiSuggestReplies, aiRewrite } from '@/lib/chat/ai';
import { matchCommands, isSlashDraft, exactCommand } from '@/lib/chat/commands';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { FileAttachment } from '@/components/chat/FileAttachment';
import { AuthAudio } from '@/components/chat/AuthAudio';
import { CallOverlay } from '@/components/chat/CallOverlay';
import { useCall } from '@/hooks/useCall';
import { callsSupported, screenShareSupported } from '@/lib/chat/webrtc';
import { renderMessageText, hasTable, tableTemplate } from '@/lib/chat/markdown';
import { isEmojiOnly, emojiGlyphCount } from '@/lib/chat/stickers';
import { parseStickerId, getSticker } from '@/lib/chat/stickerImages';
import {
  parseGif,
  parseLocation,
  parseContact,
  locToken,
  contactToken,
  gifToken,
  specialKind,
} from '@/lib/chat/tokens';
import { GifPicker } from '@/components/chat/GifPicker';
import { formatBytes, relativeTime, lastSeenLabel } from '@/lib/chat/format';
import { avatarStyle } from '@/lib/chat/avatar';
import { loadDraft, saveDraft } from '@/lib/chat/drafts';
import { QUICK_REACTIONS } from '@/lib/chat/emojis';

/** Set corto de reacciones rápidas (mini-picker del toolbar de cada mensaje). */
const REACTION_EMOJIS = QUICK_REACTIONS;

type PresenceStatus = 'available' | 'busy' | 'away';
const STATUS_META: Record<
  PresenceStatus | 'offline',
  { label: string; dot: string }
> = {
  available: { label: 'Disponible', dot: 'bg-green-500' },
  busy: { label: 'Ocupado', dot: 'bg-red-500' },
  away: { label: 'Ausente', dot: 'bg-amber-500' },
  offline: { label: 'Desconectado', dot: 'bg-gray-400' },
};
const STATUS_KEY = 'axos_chat_status';

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

/** Texto corto que representa un mensaje al citarlo/responderlo. */
function replySnippet(m: ChatMessage): string {
  if (m.deletedAt) return 'Mensaje eliminado';
  if (m.type === 'image') return '📷 Imagen';
  if (m.type === 'file') return m.fileName || '📎 Archivo';
  if (m.type === 'call') return '📞 Llamada';
  const kind = specialKind(m.body);
  if (kind === 'gif') return '🎞️ GIF';
  if (kind === 'loc') return '📍 Ubicación';
  if (kind === 'contact') return '👤 Contacto';
  if (m.body && parseStickerId(m.body)) return '🎟️ Sticker';
  return (m.body ?? '').slice(0, 140);
}

function toReplyPreview(m: ChatMessage): ReplyPreview {
  return { id: m.id, senderId: m.senderId, type: m.type, snippet: replySnippet(m) };
}

/** Vista previa del último mensaje en la lista de conversaciones. */
function conversationPreview(
  lm: { type: string; body: string | null } | null | undefined,
): string {
  if (!lm) return 'Sin mensajes';
  if (lm.type === 'image') return '📷 Imagen';
  if (lm.type === 'file') return '📎 Archivo';
  if (lm.type === 'call') return '📞 Llamada';
  if (lm.type === 'poll') return '📊 Encuesta';
  const kind = specialKind(lm.body);
  if (kind === 'gif') return '🎞️ GIF';
  if (kind === 'loc') return '📍 Ubicación';
  if (kind === 'contact') return '👤 Contacto';
  if (lm.body && parseStickerId(lm.body)) return '🎟️ Sticker';
  return lm.body || '';
}

/** Primera URL http(s) de un cuerpo de texto (sin tokens especiales), o null. */
function firstUrl(body: string | null | undefined): string | null {
  if (!body || body.trim().startsWith('[[')) return null;
  const m = /(https?:\/\/[^\s<>"']+)/i.exec(body);
  return m ? m[1].replace(/[.,;:!?)\]]+$/, '') : null;
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
  const confirm = useConfirm();

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
  // Acciones de hilo: responder, editar, reenviar, fijados.
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);
  const [pinned, setPinned] = useState<ChatMessage[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  // Presencia con estado (disponible/ocupado/ausente) por usuario.
  const [statuses, setStatuses] = useState<Map<string, PresenceStatus>>(new Map());
  const [myStatus, setMyStatus] = useState<PresenceStatus>('available');
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  // Búsqueda global de mensajes.
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  // Administración del canal abierto.
  const [channelSettings, setChannelSettings] = useState<ChatConversation | null>(
    null,
  );
  // Encuestas / programados / temporales.
  const [pollOpen, setPollOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);
  const [showScheduled, setShowScheduled] = useState(false);
  const [showDisappearMenu, setShowDisappearMenu] = useState(false);
  // GIFs / compartir contacto / traducciones (por id de mensaje).
  const [gifOpen, setGifOpen] = useState(false);
  const [contactPickerOpen, setContactPickerOpen] = useState(false);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  // Hilos: mensaje raíz abierto + sus respuestas.
  const [threadRoot, setThreadRoot] = useState<ChatMessage | null>(null);
  const [threadReplies, setThreadReplies] = useState<ChatMessage[]>([]);
  // Etiquetas/carpetas: filtro activo + conversación en edición de etiquetas.
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const [labelEditing, setLabelEditing] = useState<ChatConversation | null>(null);
  // Gestión de chats: expandir archivados + menú contextual de fila.
  const [showArchived, setShowArchived] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  // Galería de la conversación (fotos/archivos/enlaces).
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Mensajes guardados.
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  // Reuniones programadas de la conversación + recordatorio entrante.
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [meetingReminder, setMeetingReminder] = useState<{
    id: string;
    conversationId: string;
    title: string;
  } | null>(null);
  // IA en el chat: resumen, sugerencias y "mejorar".
  const [aiSummaryOpen, setAiSummaryOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [aiBusy, setAiBusy] = useState<'summary' | 'suggest' | 'rewrite' | null>(
    null,
  );
  // Paleta de comandos (Ctrl/Cmd+K).
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Socket en estado (además del ref) para que useCall enganche sus listeners.
  const [socket, setSocket] = useState<Socket | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const atBottomRef = useRef(true);
  const activeIdRef = useRef<string | null>(null);
  const usersRef = useRef<ChatUser[]>([]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef(0);
  const draftRef = useRef('');
  const editingRef = useRef<string | null>(null);
  const threadRootRef = useRef<string | null>(null);
  useEffect(() => {
    threadRootRef.current = threadRoot?.id ?? null;
  }, [threadRoot]);
  // Conversaciones silenciadas (para no notificar). Ref para usar en el socket.
  const mutedConvosRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    mutedConvosRef.current = new Set(
      conversations.filter((c) => c.muted).map((c) => c.id),
    );
  }, [conversations]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  useEffect(() => {
    editingRef.current = editingId;
  }, [editingId]);
  // Al desmontar (cerrar dock / cambiar de ruta), guarda el borrador en curso.
  useEffect(
    () => () => {
      const aid = activeIdRef.current;
      if (aid && !editingRef.current) saveDraft(aid, draftRef.current);
    },
    [],
  );

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

  // Estado de presencia propio (persistido + difundido por socket).
  const myStatusRef = useRef<PresenceStatus>('available');
  useEffect(() => {
    myStatusRef.current = myStatus;
  }, [myStatus]);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(STATUS_KEY);
      if (v === 'busy' || v === 'away' || v === 'available') setMyStatus(v);
    } catch {
      /* ignore */
    }
  }, []);
  function changeMyStatus(s: PresenceStatus) {
    setMyStatus(s);
    setShowStatusMenu(false);
    try {
      window.localStorage.setItem(STATUS_KEY, s);
    } catch {
      /* ignore */
    }
    socketRef.current?.emit('presence:set-status', { status: s });
    // Reflejo local inmediato.
    setStatuses((prev) => new Map(prev).set(meId, s));
  }

  /** Estado a mostrar para un usuario: su estado si está online, o 'offline'. */
  function statusFor(userId: string): PresenceStatus | 'offline' {
    if (userId === meId) return myStatus;
    return onlineIds.has(userId) ? (statuses.get(userId) ?? 'available') : 'offline';
  }

  // Llamadas WebRTC (1:1 en DMs).
  const {
    call,
    localStream,
    remotes,
    micOn,
    camOn,
    screenOn,
    startCall,
    acceptCall,
    rejectCall,
    hangup,
    toggleMic,
    toggleCam,
    toggleScreen,
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

  // Búsqueda global de mensajes (debounced).
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    let alive = true;
    const t = setTimeout(() => {
      chatApi
        .searchMessages(q)
        .then((r) => {
          if (alive) setSearchResults(r);
        })
        .catch(() => {});
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [search]);

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
    s.on('connect', () => {
      s.emit('join', meId);
      // Reanuncia mi estado de presencia al (re)conectar.
      if (myStatusRef.current !== 'available') {
        s.emit('presence:set-status', { status: myStatusRef.current });
      }
    });
    s.on('message:new', (msg: ChatMessage) => {
      if (msg.conversationId === activeIdRef.current) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          const next = [...prev, msg];
          // Si es respuesta a un mensaje cargado, súmale al contador de hilo.
          return msg.replyToId
            ? next.map((m) =>
                m.id === msg.replyToId
                  ? { ...m, threadCount: (m.threadCount ?? 0) + 1 }
                  : m,
              )
            : next;
        });
        if (msg.senderId !== meId && !atBottomRef.current) {
          setNewCount((c) => c + 1);
        }
        // Si el hilo abierto es el padre, refleja la respuesta en vivo.
        if (msg.replyToId && msg.replyToId === threadRootRef.current) {
          setThreadReplies((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          );
        }
      }
      // Notificación de escritorio si no es mío, no lo estoy viendo y no está
      // silenciada la conversación.
      if (
        msg.senderId !== meId &&
        !mutedConvosRef.current.has(msg.conversationId) &&
        (msg.conversationId !== activeIdRef.current ||
          (typeof document !== 'undefined' && document.hidden))
      ) {
        notifyDesktop(msg);
      }
      refreshConversations();
    });
    // Mensaje editado / eliminado / fijado: reemplazar en sitio.
    s.on('message:updated', (msg: ChatMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
      if (msg.conversationId === activeIdRef.current) {
        chatApi.listPinned(msg.conversationId).then(setPinned).catch(() => {});
      }
      refreshConversations();
    });
    // Mensaje temporal expirado: quitarlo del hilo.
    s.on('message:removed', (p: { id: string; conversationId: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== p.id));
    });
    s.on('typing', (p: { conversationId: string }) => {
      if (p?.conversationId !== activeIdRef.current) return;
      setTypingConvo(p.conversationId);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => setTypingConvo(null), 2500);
    });
    s.on(
      'presence:state',
      (arr: { userId: string; status: PresenceStatus }[]) => {
        setOnlineIds(new Set(arr.map((x) => x.userId)));
        setStatuses(new Map(arr.map((x) => [x.userId, x.status])));
      },
    );
    s.on(
      'presence:update',
      (p: { userId: string; online: boolean; status?: PresenceStatus }) => {
        setOnlineIds((prev) => {
          const next = new Set(prev);
          if (p.online) next.add(p.userId);
          else next.delete(p.userId);
          return next;
        });
        setStatuses((prev) => {
          const next = new Map(prev);
          if (p.online) next.set(p.userId, p.status ?? 'available');
          else next.delete(p.userId);
          return next;
        });
        // Al desconectarse en vivo, recuerda "visto hace" ahora.
        if (!p.online) {
          const now = new Date().toISOString();
          setUsers((prev) =>
            prev.map((u) => (u.id === p.userId ? { ...u, lastSeenAt: now } : u)),
          );
        }
      },
    );
    // Conversación cambió (miembros/nombre) → refrescar y recargar si es la activa.
    s.on('conversation:updated', (p: { conversationId: string }) => {
      refreshConversations();
      if (p?.conversationId === activeIdRef.current) {
        chatApi
          .listMessages(p.conversationId)
          .then(setMessages)
          .catch(() => {});
      }
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
        if (
          p.conversationId !== activeIdRef.current &&
          !mutedConvosRef.current.has(p.conversationId)
        ) {
          setToast({ byUserId: p.byUserId, conversationId: p.conversationId });
        }
        refreshConversations();
      },
    );
    // Recordatorio de reunión próxima → toast con "Unirse".
    s.on(
      'meeting:reminder',
      (p: { id: string; conversationId: string; title: string }) => {
        setMeetingReminder(p);
        if (p.conversationId === activeIdRef.current) {
          chatApi.listMeetings(p.conversationId).then(setMeetings).catch(() => {});
        }
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
    chatApi.listPinned(activeId).then(setPinned).catch(() => setPinned([]));
    chatApi.listScheduled(activeId).then(setScheduled).catch(() => setScheduled([]));
    chatApi.listMeetings(activeId).then(setMeetings).catch(() => setMeetings([]));
    chatApi.markRead(activeId).then(refreshConversations).catch(() => {});
  }, [activeId, refreshConversations]);

  // Atajo global: Ctrl/Cmd+K abre/cierra la paleta de comandos.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  // Envío optimista de texto (con cita opcional).
  async function enqueueText(
    conversationId: string,
    body: string,
    reply?: ChatMessage | null,
  ) {
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
      replyToId: reply?.id ?? null,
      replyTo: reply ? toReplyPreview(reply) : null,
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const msg = await chatApi.sendText(conversationId, body, reply?.id);
      setMessages((prev) => reconcileSent(prev, tempId, msg));
      refreshConversations();
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)),
      );
    }
  }

  // Envío optimista de imagen (con cita opcional).
  async function enqueueImage(
    conversationId: string,
    file: File,
    reply?: ChatMessage | null,
  ) {
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
      replyToId: reply?.id ?? null,
      replyTo: reply ? toReplyPreview(reply) : null,
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const msg = await chatApi.sendImage(conversationId, file, reply?.id);
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

  // Envío optimista de archivo genérico (con cita opcional).
  async function enqueueFile(
    conversationId: string,
    file: File,
    reply?: ChatMessage | null,
  ) {
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
      replyToId: reply?.id ?? null,
      replyTo: reply ? toReplyPreview(reply) : null,
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const msg = await chatApi.sendFile(conversationId, file, reply?.id);
      setMessages((prev) => reconcileSent(prev, tempId, msg));
      refreshConversations();
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'failed' } : m)),
      );
      setError(`No se pudo enviar el archivo: ${(e as Error).message}`);
    }
  }

  // Enviar: si estoy editando, guarda la edición; si no, envía (con cita).
  function submitText(text: string) {
    if (!activeId) return;
    // Comando slash exacto (p. ej. "/encuesta") → ejecuta la acción, no envía.
    if (!editingId) {
      const cmd = exactCommand(text);
      if (cmd) {
        runCommand(cmd.id);
        return;
      }
    }
    setSuggestions([]);
    if (editingId) {
      const id = editingId;
      setEditingId(null);
      chatApi
        .editText(id, text)
        .then((updated) =>
          setMessages((prev) =>
            prev.map((m) => (m.id === id ? { ...m, ...updated } : m)),
          ),
        )
        .catch((e) => setError(`No se pudo editar: ${(e as Error).message}`));
      return;
    }
    atBottomRef.current = true;
    const reply = replyingTo;
    setReplyingTo(null);
    enqueueText(activeId, text, reply);
    saveDraft(activeId, ''); // limpia el borrador al enviar
  }

  function attachImage(file: File) {
    setPendingImage({ file, url: URL.createObjectURL(file) });
  }

  function attachFile(file: File) {
    if (!activeId) return;
    atBottomRef.current = true;
    const reply = replyingTo;
    setReplyingTo(null);
    enqueueFile(activeId, file, reply);
  }

  // Confirma el envío de la imagen en preview.
  function confirmSendImage() {
    if (!pendingImage || !activeId) return;
    atBottomRef.current = true;
    const reply = replyingTo;
    setReplyingTo(null);
    enqueueImage(activeId, pendingImage.file, reply);
    setPendingImage(null);
  }

  // ── acciones de mensaje (responder / editar / eliminar / fijar / reenviar) ──
  function handleReply(m: ChatMessage) {
    setEditingId(null);
    setReplyingTo(m);
  }
  function handleEdit(m: ChatMessage) {
    if (m.type !== 'text' || m.deletedAt) return;
    setReplyingTo(null);
    setEditingId(m.id);
    setDraft(m.body ?? '');
  }
  function cancelCompose() {
    setReplyingTo(null);
    setEditingId(null);
    setDraft('');
  }
  async function handleDelete(m: ChatMessage) {
    const ok = await confirm({
      title: 'Eliminar mensaje',
      message: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      const updated = await chatApi.deleteMessage(m.id);
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, ...updated } : x)),
      );
    } catch (e) {
      setError(`No se pudo eliminar: ${(e as Error).message}`);
    }
  }
  async function handlePin(m: ChatMessage) {
    try {
      await chatApi.pinMessage(m.id, !m.pinnedAt);
      if (activeId) chatApi.listPinned(activeId).then(setPinned).catch(() => {});
    } catch (e) {
      setError(`No se pudo fijar: ${(e as Error).message}`);
    }
  }
  async function handleVote(messageId: string, optionId: string) {
    try {
      const updated = await chatApi.votePoll(messageId, optionId);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, ...updated } : m)),
      );
    } catch (e) {
      setError(`No se pudo votar: ${(e as Error).message}`);
    }
  }
  async function setDisappearing(seconds: number) {
    if (!activeId) return;
    setShowDisappearMenu(false);
    try {
      await chatApi.setDisappearing(activeId, seconds);
      refreshConversations();
    } catch (e) {
      setError(`No se pudo cambiar: ${(e as Error).message}`);
    }
  }
  async function cancelScheduledMsg(id: string) {
    try {
      await chatApi.cancelScheduled(id);
      setScheduled((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(`No se pudo cancelar: ${(e as Error).message}`);
    }
  }
  // Envía un token especial (gif/ubicación/contacto) como mensaje de inmediato.
  function sendToken(text: string) {
    if (!activeId) return;
    atBottomRef.current = true;
    enqueueText(activeId, text);
  }
  function shareLocation() {
    if (!activeId) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocalización no disponible en este navegador');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => sendToken(locToken(pos.coords.latitude, pos.coords.longitude)),
      () => setError('No se pudo obtener tu ubicación'),
    );
  }
  async function translateMessage(m: ChatMessage) {
    const text = m.body ?? '';
    if (!text) return;
    setTranslations((prev) => ({ ...prev, [m.id]: '…' }));
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Traduce al español el siguiente mensaje de chat. Devuelve SOLO la traducción, sin comillas ni explicaciones:\n\n${text}`,
        }),
      });
      const data = await res.json();
      setTranslations((prev) => ({
        ...prev,
        [m.id]: (data?.reply as string) || 'No se pudo traducir',
      }));
    } catch {
      setTranslations((prev) => ({ ...prev, [m.id]: 'No se pudo traducir' }));
    }
  }

  // ── hilos (respuestas anidadas a un mensaje) ────────────────────────────────
  async function openThread(m: ChatMessage) {
    setThreadRoot(m);
    setThreadReplies([]);
    try {
      const t = await chatApi.getThread(m.id);
      setThreadRoot(t.root);
      setThreadReplies(t.replies);
    } catch (e) {
      setError(`No se pudo abrir el hilo: ${(e as Error).message}`);
    }
  }
  function closeThread() {
    setThreadRoot(null);
    setThreadReplies([]);
  }
  async function sendThreadReply(text: string) {
    if (!activeId || !threadRoot) return;
    const root = threadRoot;
    try {
      const msg = await chatApi.sendText(activeId, text, root.id);
      // Refleja de inmediato en el panel (el socket actualizará el hilo principal).
      setThreadReplies((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
      );
    } catch (e) {
      setError(`No se pudo responder: ${(e as Error).message}`);
    }
  }

  // ── etiquetas / carpetas ────────────────────────────────────────────────────
  async function saveLabels(conversationId: string, labels: string[]) {
    setLabelEditing(null);
    try {
      await chatApi.setLabels(conversationId, labels);
      refreshConversations();
    } catch (e) {
      setError(`No se pudieron guardar las etiquetas: ${(e as Error).message}`);
    }
  }

  // ── gestión de chats (fijar / archivar / silenciar / no leído) ──────────────
  async function togglePin(c: ChatConversation) {
    setRowMenuId(null);
    try {
      await chatApi.setPinned(c.id, !c.pinned);
      refreshConversations();
    } catch (e) {
      setError(`No se pudo fijar: ${(e as Error).message}`);
    }
  }
  async function toggleArchive(c: ChatConversation) {
    setRowMenuId(null);
    try {
      await chatApi.setArchived(c.id, !c.archived);
      refreshConversations();
    } catch (e) {
      setError(`No se pudo archivar: ${(e as Error).message}`);
    }
  }
  async function muteFor(c: ChatConversation, hours: number | null) {
    setRowMenuId(null);
    const until =
      hours === null
        ? null
        : new Date(Date.now() + hours * 3600000).toISOString();
    try {
      // hours=0 → desactivar; null nunca llega aquí salvo "siempre" (100 años).
      await chatApi.setMuted(c.id, hours === 0 ? null : until);
      refreshConversations();
    } catch (e) {
      setError(`No se pudo silenciar: ${(e as Error).message}`);
    }
  }
  async function toggleUnread(c: ChatConversation) {
    setRowMenuId(null);
    const makeUnread = !(c.markedUnread || c.unread > 0);
    try {
      // "Marcar como leído" limpia tanto el flag como los no leídos reales.
      if (makeUnread) await chatApi.setUnread(c.id, true);
      else await chatApi.markRead(c.id);
      refreshConversations();
    } catch (e) {
      setError(`No se pudo cambiar: ${(e as Error).message}`);
    }
  }

  // ── mensajes guardados ──────────────────────────────────────────────────────
  async function toggleSaved(m: ChatMessage) {
    const next = !m.saved;
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, saved: next } : x)),
    );
    try {
      await chatApi.setSaved(m.id, next);
    } catch (e) {
      setMessages((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, saved: !next } : x)),
      );
      setError(`No se pudo guardar: ${(e as Error).message}`);
    }
  }
  async function openSaved() {
    setSavedOpen(true);
    try {
      setSavedItems(await chatApi.listSaved());
    } catch {
      setSavedItems([]);
    }
  }
  function openSavedItem(it: SavedItem) {
    setSavedOpen(false);
    openConversation(it.conversationId);
    setTimeout(() => {
      document
        .getElementById(`msg-${it.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 450);
  }

  // ── IA en el chat (resumen / sugerencias / mejorar) ─────────────────────────
  function recentTextLines(limit: number): string[] {
    return messages
      .filter((m) => m.type === 'text' && m.body && !specialKind(m.body))
      .slice(-limit)
      .map((m) => `${senderName(m.senderId, users)}: ${m.body}`);
  }
  async function catchUp() {
    if (!messages.length) return;
    setAiSummaryOpen(true);
    setAiSummary('');
    setAiBusy('summary');
    try {
      setAiSummary((await aiCatchUp(recentTextLines(40))) || 'Sin resumen.');
    } catch {
      setAiSummary('No se pudo generar el resumen.');
    } finally {
      setAiBusy(null);
    }
  }
  async function suggestReplies() {
    if (!messages.length) return;
    setAiBusy('suggest');
    try {
      setSuggestions(await aiSuggestReplies(recentTextLines(12)));
    } catch {
      setSuggestions([]);
    } finally {
      setAiBusy(null);
    }
  }
  async function rewriteDraft() {
    const text = draft.trim();
    if (!text) return;
    setAiBusy('rewrite');
    try {
      const r = await aiRewrite(text);
      if (r) setDraft(r);
      else setError('La IA no devolvió una mejora.');
    } catch (e) {
      setError(`No se pudo mejorar: ${(e as Error).message}`);
    } finally {
      setAiBusy(null);
    }
  }

  // ── reuniones programadas ───────────────────────────────────────────────────
  async function addMeeting(data: {
    title: string;
    startAt: string;
    durationMin: number;
    recurrence: 'none' | 'daily' | 'weekly';
  }) {
    if (!activeId) return;
    setMeetingOpen(false);
    try {
      const m = await chatApi.createMeeting(activeId, data);
      setMeetings((prev) =>
        [...prev, m].sort((a, b) => a.startAt.localeCompare(b.startAt)),
      );
    } catch (e) {
      setError(`No se pudo crear la reunión: ${(e as Error).message}`);
    }
  }
  async function removeMeeting(id: string) {
    try {
      await chatApi.cancelMeeting(id);
      setMeetings((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      setError(`No se pudo cancelar: ${(e as Error).message}`);
    }
  }
  function joinMeeting(conversationId: string) {
    setMeetingReminder(null);
    if (conversationId !== activeIdRef.current) openConversation(conversationId);
    startCall(conversationId, 'video');
  }

  // ── comandos slash ──────────────────────────────────────────────────────────
  function runCommand(id: string) {
    setDraft('');
    saveDraft(activeId ?? '', '');
    switch (id) {
      case 'encuesta':
        setPollOpen(true);
        break;
      case 'reunion':
        setMeetingOpen(true);
        break;
      case 'programar':
        setScheduleOpen(true);
        break;
      case 'ubicacion':
        shareLocation();
        break;
      case 'gif':
        setGifOpen(true);
        break;
      case 'contacto':
        setContactPickerOpen(true);
        break;
      case 'tabla':
        setDraft(tableTemplate());
        break;
      case 'aldia':
        catchUp();
        break;
      case 'silenciar':
        if (active) muteFor(active, 8);
        break;
    }
  }

  // ── notificaciones de escritorio ───────────────────────────────────────────
  function requestNotifyPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }
  function notifyDesktop(msg: ChatMessage) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const name = senderName(msg.senderId, usersRef.current);
    try {
      const n = new Notification(name, {
        body: replySnippet(msg),
        tag: msg.conversationId,
      });
      n.onclick = () => {
        window.focus();
        openConversation(msg.conversationId);
        n.close();
      };
    } catch {
      /* el navegador puede bloquear notificaciones: ignorar */
    }
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
    // Guarda el borrador de la conversación que dejo (salvo si estaba editando).
    if (activeIdRef.current && activeIdRef.current !== id && !editingRef.current) {
      saveDraft(activeIdRef.current, draftRef.current);
    }
    setActiveId(id);
    setLoadingMessages(true);
    setMessages([]);
    setReads([]);
    setPinned([]);
    setShowPinned(false);
    setScheduled([]);
    setShowScheduled(false);
    setShowDisappearMenu(false);
    setReplyingTo(null);
    setEditingId(null);
    setThreadRoot(null);
    setThreadReplies([]);
    setMeetings([]);
    setMeetingOpen(false);
    setSuggestions([]);
    setDraft(loadDraft(id));
    requestNotifyPermission();
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

  // Abre un resultado de búsqueda global y salta al mensaje (si está cargado).
  function openSearchResult(r: SearchResult) {
    openConversation(r.conversationId);
    setSearch('');
    setSearchResults([]);
    setTimeout(() => {
      document
        .getElementById(`msg-${r.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 450);
  }

  // Continuidad al ampliar desde el dock: /dashboard/chat?c=<id> abre ese hilo.
  const openedFromQueryRef = useRef(false);
  useEffect(() => {
    if (single || openedFromQueryRef.current || !meId) return;
    const c = new URLSearchParams(window.location.search).get('c');
    if (c) {
      openedFromQueryRef.current = true;
      openConversation(c);
    }
    // openConversation es estable en la práctica; el ref evita reejecuciones.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [single, meId]);

  const filteredUsers = users.filter(
    (u) =>
      search.trim() &&
      (u.username?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())),
  );

  // Etiquetas existentes (para los chips de filtro) y filtro activo.
  const allLabels = useMemo(() => {
    const set = new Set<string>();
    for (const c of conversations) for (const l of c.labels ?? []) set.add(l);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [conversations]);
  const matchesLabel = useCallback(
    (c: ChatConversation) => !labelFilter || (c.labels ?? []).includes(labelFilter),
    [labelFilter],
  );

  const visibleConvos = conversations.filter(
    (c) => matchesLabel(c) && !c.archived,
  );
  const channels = visibleConvos.filter((c) => c.type === 'channel');
  const dms = visibleConvos.filter((c) => c.type === 'dm');
  const archivedConvos = conversations.filter(
    (c) => matchesLabel(c) && c.archived,
  );

  // Props del menú contextual (⋯) de cada fila de conversación.
  const rowMenuProps = (c: ChatConversation) => ({
    menuOpen: rowMenuId === c.id,
    onMenuToggle: () =>
      setRowMenuId((id) => (id === c.id ? null : c.id)),
    onPin: () => togglePin(c),
    onArchive: () => toggleArchive(c),
    onMute: (hours: number | null) => muteFor(c, hours),
    onUnread: () => toggleUnread(c),
  });

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
  // Canal de anuncios: solo el creador publica; el resto ve un aviso de solo lectura.
  const canPost =
    !active || !active.announcement || active.createdById === meId;

  const aside = (
    <aside
      className={`${surface} ${
        single ? 'flex' : activeId ? 'hidden md:flex' : 'flex'
      } h-full w-full shrink-0 flex-col ${single ? 'min-h-0 p-3' : 'rounded-[24px] p-4 md:w-80'}`}
    >
      {/* Acento de dominio (mensajería) */}
      <div className="mb-3 flex items-center gap-2.5">
        <IconTile domain="messaging" size={single ? 28 : 34} />
        <span className="text-base font-bold tracking-tight">Mensajería</span>
        {single && (
          <div className="ml-auto flex items-center gap-1">
            <Link
              href={activeId ? `/dashboard/chat?c=${activeId}` : '/dashboard/chat'}
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

      {/* Selector de mi estado de presencia */}
      <div className="relative mb-3">
        <button
          onClick={() => setShowStatusMenu((s) => !s)}
          className="flex items-center gap-2 rounded-full px-2 py-1 text-xs hover:bg-black/5 dark:hover:bg-white/10"
        >
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[myStatus].dot}`} />
          <span className="font-medium">{STATUS_META[myStatus].label}</span>
          <ChevronDown className="h-3 w-3 text-gray-400" />
        </button>
        {showStatusMenu && (
          <div
            className={`${glass} absolute left-0 top-9 z-30 w-44 rounded-2xl p-1 shadow-xl`}
          >
            {(['available', 'busy', 'away'] as PresenceStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => changeMyStatus(s)}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[s].dot}`} />
                {STATUS_META[s].label}
                {myStatus === s && <Check className="ml-auto h-4 w-4 text-blue-500" />}
              </button>
            ))}
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
        <div className="flex items-center gap-1">
          <button
            onClick={openSaved}
            aria-label="Mensajes guardados"
            title="Mensajes guardados"
            className="rounded-full p-1.5 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Bookmark className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowNewChannel(true)}
            className="flex items-center gap-1 rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white dark:bg-white dark:text-black"
          >
            <Plus className="h-3.5 w-3.5" /> Canal
          </button>
        </div>
      </div>

      {/* Buscador de empleados */}
      <div className={`${glass} mb-3 flex items-center gap-2 rounded-full px-3 py-2`}>
        <Search className="h-4 w-4 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empleados o mensajes…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            aria-label="Limpiar búsqueda"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Chips de filtro por etiqueta/carpeta */}
      {allLabels.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setLabelFilter(null)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              labelFilter === null
                ? 'bg-blue-600 text-white'
                : 'bg-black/5 text-gray-600 hover:bg-black/10 dark:bg-white/10 dark:text-gray-300'
            }`}
          >
            Todas
          </button>
          {allLabels.map((l) => (
            <button
              key={l}
              onClick={() => setLabelFilter((cur) => (cur === l ? null : l))}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                labelFilter === l
                  ? 'bg-blue-600 text-white'
                  : 'bg-black/5 text-gray-600 hover:bg-black/10 dark:bg-white/10 dark:text-gray-300'
              }`}
            >
              <Tag className="h-3 w-3" /> {l}
            </button>
          ))}
        </div>
      )}

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
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={avatarStyle(u.id)}
                >
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

        {/* Resultados de búsqueda global de mensajes */}
        {searchResults.length > 0 && (
          <div className="space-y-1">
            <p className="px-1 text-xs font-medium text-gray-400">Mensajes</p>
            {searchResults.map((r) => (
              <button
                key={r.id}
                onClick={() => openSearchResult(r)}
                className="flex w-full items-start gap-3 rounded-2xl p-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={avatarStyle(r.conversationId)}
                >
                  {r.conversationType === 'channel' ? (
                    <Hash className="h-4 w-4" />
                  ) : (
                    initials(r.conversationTitle)
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {r.conversationTitle}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-400">
                      {relativeTime(r.createdAt)}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {senderName(r.senderId, users)}: {r.snippet}
                  </span>
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
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={avatarStyle(u.id)}
                  >
                    {initials(u.username || u.email)}
                  </span>
                  <PresenceDot status={statusFor(u.id)} />
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
                {...rowMenuProps(c)}
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
              status={c.counterpartId ? statusFor(c.counterpartId) : undefined}
              mentioned={mentionConvos.has(c.id)}
              onClick={() => openConversation(c.id)}
              {...rowMenuProps(c)}
            />
          ))}
        </div>

        {/* Conversaciones archivadas */}
        {archivedConvos.length > 0 && (
          <div className="space-y-1">
            <button
              onClick={() => setShowArchived((s) => !s)}
              className="flex w-full items-center gap-1.5 px-1 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <Archive className="h-3.5 w-3.5" />
              Archivados · {archivedConvos.length}
              {showArchived ? (
                <ChevronUp className="ml-auto h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-auto h-3.5 w-3.5" />
              )}
            </button>
            {showArchived &&
              archivedConvos.map((c) => (
                <ConversationRow
                  key={c.id}
                  convo={c}
                  active={c.id === activeId}
                  status={c.counterpartId ? statusFor(c.counterpartId) : undefined}
                  mentioned={mentionConvos.has(c.id)}
                  onClick={() => openConversation(c.id)}
                  {...rowMenuProps(c)}
                />
              ))}
          </div>
        )}
      </div>
    </aside>
  );

  const section = (
    <section
      className={`${surface} relative ${
        single ? 'flex' : activeId ? 'flex' : 'hidden md:flex'
      } h-full min-w-0 flex-1 flex-col ${single ? 'min-h-0' : 'rounded-[24px]'}`}
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
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={avatarStyle(active.counterpartId || active.id)}
                  >
                    {initials(active.title || '?')}
                  </span>
                  {active.counterpartId && (
                    <PresenceDot status={statusFor(active.counterpartId)} />
                  )}
                </span>
              )}
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate font-semibold">
                  <span className="truncate">{active.title || 'Conversación'}</span>
                  {active.announcement && (
                    <Megaphone
                      className="h-3.5 w-3.5 shrink-0 text-amber-500"
                      aria-label="Canal de anuncios"
                    />
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {active.type === 'channel'
                    ? `${active.memberIds.length} miembros`
                    : active.counterpartId && onlineIds.has(active.counterpartId)
                      ? STATUS_META[statusFor(active.counterpartId)].label
                      : (() => {
                          const u = active.counterpartId
                            ? users.find((x) => x.id === active.counterpartId)
                            : null;
                          return (
                            (u && lastSeenLabel(u.lastSeenAt)) || 'Desconectado'
                          );
                        })()}
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
                <button
                  onClick={catchUp}
                  disabled={messages.length === 0}
                  className="rounded-full p-2 text-gray-500 transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40 dark:hover:bg-white/10"
                  aria-label="Ponerme al día (IA)"
                  title="Ponerme al día (resumen con IA)"
                >
                  <Sparkles className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setMeetingOpen(true)}
                  className="rounded-full p-2 text-gray-500 transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-white/10"
                  aria-label="Programar reunión"
                  title="Reuniones programadas"
                >
                  <CalendarPlus className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setGalleryOpen(true)}
                  className="rounded-full p-2 text-gray-500 transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-white/10"
                  aria-label="Galería"
                  title="Multimedia, archivos y enlaces"
                >
                  <Images className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setLabelEditing(active)}
                  className={`rounded-full p-2 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                    (active.labels?.length ?? 0) > 0
                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300'
                      : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                  aria-label="Etiquetas"
                  title="Etiquetas y carpetas"
                >
                  <Tag className="h-5 w-5" />
                </button>
                {active.type === 'channel' && (
                  <button
                    onClick={() => setChannelSettings(active)}
                    className="rounded-full p-2 text-gray-500 transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-white/10"
                    aria-label="Información del canal"
                    title="Miembros y ajustes"
                  >
                    <Users className="h-5 w-5" />
                  </button>
                )}
                <div className="relative">
                  <button
                    onClick={() => setShowDisappearMenu((s) => !s)}
                    className={`rounded-full p-2 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
                      active.disappearingSeconds
                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300'
                        : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10'
                    }`}
                    aria-label="Mensajes temporales"
                    title="Mensajes temporales"
                  >
                    <Timer className="h-5 w-5" />
                  </button>
                  {showDisappearMenu && (
                    <div
                      className={`${glass} absolute right-0 top-11 z-30 w-44 rounded-2xl p-1 shadow-xl`}
                    >
                      <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        Mensajes temporales
                      </p>
                      {[
                        { l: 'Desactivado', s: 0 },
                        { l: '1 hora', s: 3600 },
                        { l: '24 horas', s: 86400 },
                        { l: '7 días', s: 604800 },
                      ].map((opt) => (
                        <button
                          key={opt.s}
                          onClick={() => setDisappearing(opt.s)}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                        >
                          {opt.l}
                          {(active.disappearingSeconds || 0) === opt.s && (
                            <Check className="ml-auto h-4 w-4 text-blue-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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

          {/* Barra de mensajes fijados */}
          {pinned.length > 0 && (
            <div className="border-b border-black/5 dark:border-white/10">
              <button
                onClick={() => setShowPinned((s) => !s)}
                className="flex w-full items-center gap-2 px-5 py-2 text-left text-xs hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Pin className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                <span className="shrink-0 font-medium">
                  {pinned.length}{' '}
                  {pinned.length === 1 ? 'fijado' : 'fijados'}
                </span>
                <span className="min-w-0 flex-1 truncate text-gray-500">
                  · {replySnippet(pinned[0])}
                </span>
                {showPinned ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                )}
              </button>
              {showPinned && (
                <div className="max-h-40 overflow-y-auto px-3 pb-2">
                  {pinned.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <button
                        onClick={() =>
                          document
                            .getElementById(`msg-${p.id}`)
                            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                        }
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <span className="shrink-0 text-[11px] font-semibold">
                          {senderName(p.senderId, users)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs text-gray-500">
                          {replySnippet(p)}
                        </span>
                      </button>
                      <button
                        onClick={() => handlePin(p)}
                        aria-label="Desfijar"
                        className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        <PinOff className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
                      onReply={handleReply}
                      onForward={setForwarding}
                      onPin={handlePin}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onVote={handleVote}
                      onTranslate={translateMessage}
                      translation={translations[m.id]}
                      onStartDm={startDm}
                      onOpenThread={openThread}
                      onToggleSaved={toggleSaved}
                      meId={meId}
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
            {/* Próximas reuniones (informativo, siempre visible) */}
            {meetings.length > 0 && (
              <div className="mb-2 space-y-1">
                {meetings.slice(0, 3).map((m) => (
                  <div
                    key={m.id}
                    className={`${glass} flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs`}
                  >
                    <Video className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{m.title}</span>
                      <span className="block text-gray-500">
                        {new Date(m.startAt).toLocaleString([], {
                          weekday: 'short',
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {m.recurrence !== 'none' &&
                          ` · ${m.recurrence === 'daily' ? 'cada día' : 'cada semana'}`}
                      </span>
                    </span>
                    <button
                      onClick={() => joinMeeting(m.conversationId)}
                      className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                    >
                      Unirse
                    </button>
                    {m.createdById === meId && (
                      <button
                        onClick={() => removeMeeting(m.id)}
                        aria-label="Cancelar reunión"
                        className="shrink-0 text-gray-400 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!canPost ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl bg-black/5 px-4 py-3 text-center text-sm text-gray-500 dark:bg-white/10">
                <Megaphone className="h-4 w-4 shrink-0" />
                Solo el administrador puede publicar en este canal de anuncios.
              </div>
            ) : (
              <>
            {/* Mensajes programados pendientes */}
            {scheduled.length > 0 && (
              <div className="mb-2">
                <button
                  onClick={() => setShowScheduled((s) => !s)}
                  className="flex w-full items-center gap-2 rounded-2xl bg-black/5 px-3 py-1.5 text-xs dark:bg-white/10"
                >
                  <CalendarClock className="h-3.5 w-3.5 text-sky-500" />
                  <span className="font-medium">
                    {scheduled.length} programado{scheduled.length > 1 ? 's' : ''}
                  </span>
                  {showScheduled ? (
                    <ChevronDown className="ml-auto h-3.5 w-3.5" />
                  ) : (
                    <ChevronUp className="ml-auto h-3.5 w-3.5" />
                  )}
                </button>
                {showScheduled && (
                  <div className="mt-1 space-y-1">
                    {scheduled.map((s) => (
                      <div
                        key={s.id}
                        className={`${glass} flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs`}
                      >
                        <span className="shrink-0 font-medium text-sky-600 dark:text-sky-400">
                          {new Date(s.sendAt).toLocaleString([], {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-gray-500">
                          {s.body}
                        </span>
                        <button
                          onClick={() => cancelScheduledMsg(s.id)}
                          aria-label="Cancelar programado"
                          className="shrink-0 text-gray-400 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Banner de responder / editar */}
            {(replyingTo || editingId) && (
              <div className={`${glass} mb-2 flex items-center gap-2 rounded-2xl px-3 py-2`}>
                {editingId ? (
                  <Pencil className="h-4 w-4 shrink-0 text-blue-500" />
                ) : (
                  <Reply className="h-4 w-4 shrink-0 text-blue-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">
                    {editingId
                      ? 'Editando mensaje'
                      : `Respondiendo a ${senderName(replyingTo!.senderId, users)}`}
                  </p>
                  {replyingTo && (
                    <p className="truncate text-xs text-gray-500">
                      {replySnippet(replyingTo)}
                    </p>
                  )}
                </div>
                <button
                  onClick={cancelCompose}
                  aria-label="Cancelar"
                  className="rounded-full p-1 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
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
            {/* Acciones de IA: sugerir respuesta / mejorar borrador */}
            {!editingId && (
              <div className="mb-1.5 flex items-center gap-1">
                <button
                  onClick={suggestReplies}
                  disabled={aiBusy === 'suggest' || messages.length === 0}
                  className="flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:bg-black/10 disabled:opacity-50 dark:bg-white/10 dark:text-gray-300"
                >
                  {aiBusy === 'suggest' ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3 text-violet-500" />
                  )}
                  Sugerir respuesta
                </button>
                {draft.trim() && (
                  <button
                    onClick={rewriteDraft}
                    disabled={aiBusy === 'rewrite'}
                    className="flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:bg-black/10 disabled:opacity-50 dark:bg-white/10 dark:text-gray-300"
                  >
                    {aiBusy === 'rewrite' ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3 text-violet-500" />
                    )}
                    Mejorar
                  </button>
                )}
              </div>
            )}

            {/* Menú de comandos slash */}
            {!editingId &&
              isSlashDraft(draft) &&
              matchCommands(draft).length > 0 && (
                <div className={`${glass} mb-2 overflow-hidden rounded-2xl`}>
                  {matchCommands(draft).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => runCommand(c.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10"
                    >
                      <span className="font-mono text-blue-600 dark:text-blue-400">
                        {c.label}
                      </span>
                      <span className="text-xs text-gray-500">{c.hint}</span>
                    </button>
                  ))}
                </div>
              )}

            {/* Sugerencias de respuesta (IA) */}
            {suggestions.length > 0 && !editingId && (
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setDraft(s);
                      setSuggestions([]);
                    }}
                    className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-700 hover:bg-blue-500/20 dark:text-blue-300"
                  >
                    {s}
                  </button>
                ))}
                <button
                  onClick={() => setSuggestions([])}
                  aria-label="Descartar sugerencias"
                  className="rounded-full p-1 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
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
              autoFocusKey={activeId ?? undefined}
              placeholder={editingId ? 'Edita tu mensaje…' : undefined}
              onCreatePoll={() => setPollOpen(true)}
              onSchedule={() => setScheduleOpen(true)}
              onPickGif={() => setGifOpen(true)}
              onShareLocation={shareLocation}
              onShareContact={() => setContactPickerOpen(true)}
            />
              </>
            )}
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
        <div className="relative flex h-full min-h-0 w-full overflow-hidden">
          <AnimatePresence initial={false}>
            {!activeId ? (
              <motion.div
                key="list"
                className="absolute inset-0 flex"
                initial={{ x: '-22%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '-22%', opacity: 0 }}
                transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              >
                {aside}
              </motion.div>
            ) : (
              <motion.div
                key="thread"
                className="absolute inset-0 flex"
                initial={{ x: '22%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '22%', opacity: 0 }}
                transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              >
                {section}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
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

      {forwarding && (
        <ForwardModal
          conversations={conversations}
          onClose={() => setForwarding(null)}
          onConfirm={async (cids) => {
            const msg = forwarding;
            setForwarding(null);
            try {
              await Promise.all(cids.map((cid) => chatApi.forwardMessage(msg.id, cid)));
              refreshConversations();
            } catch (e) {
              setError(`No se pudo reenviar: ${(e as Error).message}`);
            }
          }}
        />
      )}

      {channelSettings && (
        <ChannelSettingsModal
          convo={channelSettings}
          users={users}
          meId={meId}
          onClose={() => setChannelSettings(null)}
          onChanged={refreshConversations}
          onLeft={() => {
            setChannelSettings(null);
            setActiveId(null);
            refreshConversations();
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      {pollOpen && activeId && (
        <PollModal
          onClose={() => setPollOpen(false)}
          onCreate={async (q, opts, multi) => {
            setPollOpen(false);
            try {
              await chatApi.createPoll(activeId, q, opts, multi);
            } catch (e) {
              setError(`No se pudo crear la encuesta: ${(e as Error).message}`);
            }
          }}
        />
      )}

      {scheduleOpen && activeId && (
        <ScheduleModal
          initialText={draft}
          onClose={() => setScheduleOpen(false)}
          onSchedule={async (b, iso) => {
            setScheduleOpen(false);
            try {
              const it = await chatApi.scheduleMessage(activeId, b, iso);
              setScheduled((prev) =>
                [...prev, it].sort((a, z) => a.sendAt.localeCompare(z.sendAt)),
              );
              if (b.trim() === draft.trim()) {
                setDraft('');
                saveDraft(activeId, '');
              }
            } catch (e) {
              setError(`No se pudo programar: ${(e as Error).message}`);
            }
          }}
        />
      )}

      {/* Selector de GIFs (Giphy) */}
      {gifOpen && (
        <GifPicker
          onPick={(url) => {
            sendToken(gifToken(url));
            setGifOpen(false);
          }}
          onClose={() => setGifOpen(false)}
        />
      )}

      {/* Compartir un contacto del directorio */}
      {contactPickerOpen && (
        <ContactPickerModal
          users={users.filter((u) => u.id !== meId)}
          onClose={() => setContactPickerOpen(false)}
          onPick={(userId) => {
            setContactPickerOpen(false);
            sendToken(contactToken(userId));
          }}
        />
      )}

      {/* Panel de hilo (respuestas a un mensaje) */}
      {threadRoot && (
        <ThreadPanel
          root={threadRoot}
          replies={threadReplies}
          users={users}
          onClose={closeThread}
          onSend={sendThreadReply}
        />
      )}

      {/* Editor de etiquetas/carpetas de la conversación */}
      {labelEditing && (
        <LabelModal
          convo={labelEditing}
          suggestions={allLabels}
          onClose={() => setLabelEditing(null)}
          onSave={(labels) => saveLabels(labelEditing.id, labels)}
        />
      )}

      {/* Galería de la conversación (fotos / archivos / enlaces) */}
      {galleryOpen && activeId && (
        <GalleryModal
          conversationId={activeId}
          users={users}
          onClose={() => setGalleryOpen(false)}
          onJump={(messageId) => {
            setTimeout(() => {
              document
                .getElementById(`msg-${messageId}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }}
        />
      )}

      {/* Mensajes guardados */}
      {savedOpen && (
        <SavedModal
          items={savedItems}
          users={users}
          onClose={() => setSavedOpen(false)}
          onOpen={openSavedItem}
        />
      )}

      {/* Reuniones programadas (lista + crear) */}
      {meetingOpen && activeId && (
        <MeetingModal
          meetings={meetings}
          meId={meId}
          onClose={() => setMeetingOpen(false)}
          onCreate={addMeeting}
          onCancel={removeMeeting}
          onJoin={(cid) => {
            setMeetingOpen(false);
            joinMeeting(cid);
          }}
        />
      )}

      {/* Resumen "Ponerme al día" (IA) */}
      {aiSummaryOpen && (
        <AiSummaryModal
          summary={aiSummary}
          loading={aiBusy === 'summary'}
          onClose={() => setAiSummaryOpen(false)}
        />
      )}

      {/* Paleta de comandos (Ctrl/Cmd+K) */}
      {paletteOpen && (
        <CommandPalette
          conversations={conversations}
          onClose={() => setPaletteOpen(false)}
          onOpenConversation={(id) => {
            setPaletteOpen(false);
            openConversation(id);
          }}
          onAction={(id) => {
            setPaletteOpen(false);
            if (id === 'new-channel') setShowNewChannel(true);
            else if (id === 'saved') openSaved();
            else if (id === 'catchup') catchUp();
            else if (id === 'meeting') setMeetingOpen(true);
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
          screenOn={screenOn}
          canScreenShare={screenShareSupported()}
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
          onToggleScreen={toggleScreen}
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

      {/* Toast de recordatorio de reunión */}
      {meetingReminder && (
        <div
          className={`${glass} fixed bottom-6 left-1/2 z-[300] flex max-w-sm -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 shadow-lg`}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Video className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Reunión por empezar</span>
            <span className="block truncate text-xs text-gray-500">
              {meetingReminder.title}
            </span>
          </span>
          <button
            onClick={() => joinMeeting(meetingReminder.conversationId)}
            className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Unirse
          </button>
          <button
            onClick={() => setMeetingReminder(null)}
            aria-label="Descartar"
            className="shrink-0 rounded-full p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
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

/** Punto de presencia con color por estado (disponible/ocupado/ausente/offline). */
function PresenceDot({ status }: { status: PresenceStatus | 'offline' }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${meta.dot}`}
      title={meta.label}
      aria-label={meta.label}
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
/** Render de una encuesta: pregunta + opciones con barras y voto (toggle). */
function PollView({
  m,
  meId,
  onVote,
}: {
  m: ChatMessage;
  meId: string;
  onVote?: (messageId: string, optionId: string) => void;
}) {
  const poll = m.poll;
  if (!poll) return null;
  const total = poll.totalVoters;
  return (
    <div className="w-72 max-w-full rounded-2xl bg-black/5 p-3 dark:bg-white/10">
      <p className="mb-2 flex items-start gap-1.5 text-sm font-semibold">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-pink-500" />
        <span className="break-words">{poll.question}</span>
      </p>
      <div className="space-y-1.5">
        {poll.options.map((o) => {
          const voted = o.userIds.includes(meId);
          const pct = total > 0 ? Math.round((o.count / total) * 100) : 0;
          return (
            <button
              key={o.id}
              onClick={() => onVote?.(m.id, o.id)}
              className="relative block w-full overflow-hidden rounded-xl text-left ring-1 ring-black/10 dark:ring-white/10"
            >
              <span
                className={`absolute inset-y-0 left-0 transition-all ${
                  voted ? 'bg-pink-500/25' : 'bg-pink-500/10'
                }`}
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center gap-2 px-3 py-1.5 text-sm">
                {voted ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-pink-600 dark:text-pink-400" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-gray-400" />
                )}
                <span className="min-w-0 flex-1 truncate">{o.text}</span>
                <span className="shrink-0 text-xs tabular-nums text-gray-500">
                  {pct}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        {total} voto{total !== 1 ? 's' : ''}
        {poll.multi ? ' · opción múltiple' : ''}
      </p>
    </div>
  );
}

/** Ítem del menú de acciones de un mensaje. */
function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 ${
        danger ? 'text-red-600 dark:text-red-400' : ''
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/** Cita del mensaje al que se responde (clic → salta al original). */
function ReplyQuote({
  reply,
  users,
  onColored,
}: {
  reply: ReplyPreview;
  users: ChatUser[];
  onColored: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        document
          .getElementById(`msg-${reply.id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }}
      className={`mb-1 flex w-full items-start gap-2 rounded-lg border-l-2 px-2 py-1 text-left text-xs ${
        onColored
          ? 'border-white/70 bg-white/15'
          : 'border-blue-400 bg-black/5 dark:bg-white/10'
      }`}
    >
      <span className="min-w-0">
        <span
          className={`block text-[11px] font-semibold ${
            onColored ? 'text-white' : 'text-blue-600 dark:text-blue-300'
          }`}
        >
          {senderName(reply.senderId, users)}
        </span>
        <span
          className={`block truncate ${onColored ? 'text-white/80' : 'text-gray-500'}`}
        >
          {reply.snippet}
        </span>
      </span>
    </button>
  );
}

function MessageItem({
  m,
  mine,
  isChannel,
  users,
  onlineIds,
  onReact,
  onRetry,
  onReply,
  onForward,
  onPin,
  onEdit,
  onDelete,
  onVote,
  onTranslate,
  translation,
  onStartDm,
  onOpenThread,
  onToggleSaved,
  meId,
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
  onReply?: (m: ChatMessage) => void;
  onForward?: (m: ChatMessage) => void;
  onPin?: (m: ChatMessage) => void;
  onEdit?: (m: ChatMessage) => void;
  onDelete?: (m: ChatMessage) => void;
  onVote?: (messageId: string, optionId: string) => void;
  onTranslate?: (m: ChatMessage) => void;
  translation?: string;
  onStartDm?: (userId: string) => void;
  onOpenThread?: (m: ChatMessage) => void;
  onToggleSaved?: (m: ChatMessage) => void;
  meId: string;
  grouped: boolean;
  highlight?: string;
  isCurrentMatch?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Registro de llamada: chip centrado tipo sistema (no es una burbuja normal).
  if (m.type === 'call') return <CallLogItem m={m} mine={mine} />;

  // Mensaje eliminado: lápida discreta, sin acciones.
  if (m.deletedAt) {
    return (
      <div
        id={`msg-${m.id}`}
        className={`mt-3 flex scroll-mt-24 ${mine ? 'justify-end' : 'justify-start'}`}
      >
        <span className="inline-flex items-center gap-1.5 rounded-[18px] bg-black/5 px-4 py-2 text-sm italic text-gray-400 dark:bg-white/5">
          <Trash2 className="h-3.5 w-3.5" /> Mensaje eliminado
        </span>
      </div>
    );
  }

  const reactions = m.reactions ?? [];
  const sending = m.status === 'sending';
  const failed = m.status === 'failed';
  const showMeta = isChannel && !mine && !grouped;
  const canModify = mine && !sending && !failed;

  const body = m.body ?? '';
  const isFile = m.type === 'file';
  const isImage = m.type === 'image';
  const isPoll = m.type === 'poll';
  const isText = m.type === 'text';
  const gifUrl = isText ? parseGif(body) : null;
  const loc = isText && !gifUrl ? parseLocation(body) : null;
  const contactId = isText && !gifUrl && !loc ? parseContact(body) : null;
  const stickerId =
    isText && !gifUrl && !loc && !contactId ? parseStickerId(body) : null;
  const emojiOnly =
    isText && !stickerId && !gifUrl && !loc && !contactId && isEmojiOnly(body);
  const linkUrl =
    isText && !stickerId && !gifUrl && !loc && !contactId
      ? firstUrl(body)
      : null;
  const bare = emojiOnly || !!stickerId || !!gifUrl; // sin fondo de burbuja
  const wide =
    isPoll || (isText && !stickerId && !!body && hasTable(body));
  const onColored = !isFile && !bare && mine; // texto blanco sobre burbuja azul
  const forwardedTag = m.forwarded ? (
    <p
      className={`mb-0.5 flex items-center gap-1 text-[10px] italic ${
        onColored ? 'text-white/70' : 'text-gray-400'
      }`}
    >
      <CornerUpRight className="h-3 w-3" /> Reenviado
    </p>
  ) : null;
  const replyQuote = m.replyTo ? (
    <ReplyQuote reply={m.replyTo} users={users} onColored={onColored} />
  ) : null;

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
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={avatarStyle(m.senderId)}
              >
                {initials(senderName(m.senderId, users))}
              </span>
              <PresenceDot
                status={onlineIds.has(m.senderId) ? 'available' : 'offline'}
              />
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

            {/* Menú de acciones (responder / reenviar / fijar / editar / eliminar) */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowMenu((s) => !s);
                  setShowPicker(false);
                }}
                className={`${glass} flex h-7 w-7 items-center justify-center rounded-full text-gray-600 shadow hover:scale-105 dark:text-gray-200`}
                aria-label="Más acciones"
                aria-expanded={showMenu}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showMenu && (
                <div
                  className={`${glass} absolute bottom-9 z-20 ${
                    mine ? 'left-0' : 'right-0'
                  } w-44 rounded-2xl p-1 shadow-lg`}
                >
                  <MenuItem
                    icon={<Reply className="h-4 w-4" />}
                    label="Responder"
                    onClick={() => {
                      onReply?.(m);
                      setShowMenu(false);
                    }}
                  />
                  <MenuItem
                    icon={<MessageSquare className="h-4 w-4" />}
                    label="Responder en hilo"
                    onClick={() => {
                      onOpenThread?.(m);
                      setShowMenu(false);
                    }}
                  />
                  <MenuItem
                    icon={<CornerUpRight className="h-4 w-4" />}
                    label="Reenviar"
                    onClick={() => {
                      onForward?.(m);
                      setShowMenu(false);
                    }}
                  />
                  <MenuItem
                    icon={
                      m.pinnedAt ? (
                        <PinOff className="h-4 w-4" />
                      ) : (
                        <Pin className="h-4 w-4" />
                      )
                    }
                    label={m.pinnedAt ? 'Desfijar' : 'Fijar'}
                    onClick={() => {
                      onPin?.(m);
                      setShowMenu(false);
                    }}
                  />
                  <MenuItem
                    icon={
                      m.saved ? (
                        <BookmarkCheck className="h-4 w-4" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )
                    }
                    label={m.saved ? 'Quitar de guardados' : 'Guardar'}
                    onClick={() => {
                      onToggleSaved?.(m);
                      setShowMenu(false);
                    }}
                  />
                  {isText &&
                    !gifUrl &&
                    !loc &&
                    !contactId &&
                    !stickerId &&
                    !emojiOnly &&
                    body.trim().length > 0 && (
                      <MenuItem
                        icon={<Languages className="h-4 w-4" />}
                        label={translation ? 'Traducción ✓' : 'Traducir'}
                        onClick={() => {
                          onTranslate?.(m);
                          setShowMenu(false);
                        }}
                      />
                    )}
                  {canModify && m.type === 'text' && (
                    <MenuItem
                      icon={<Pencil className="h-4 w-4" />}
                      label="Editar"
                      onClick={() => {
                        onEdit?.(m);
                        setShowMenu(false);
                      }}
                    />
                  )}
                  {canModify && (
                    <MenuItem
                      icon={<Trash2 className="h-4 w-4" />}
                      label="Eliminar"
                      danger
                      onClick={() => {
                        onDelete?.(m);
                        setShowMenu(false);
                      }}
                    />
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
            {forwardedTag}
            {replyQuote}
            {sending ? (
              <div className="flex w-60 max-w-full items-center gap-3 rounded-2xl bg-black/5 p-2.5 opacity-70 dark:bg-white/10">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/10 dark:bg-white/15">
                  <Paperclip className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {m.fileMime?.startsWith('audio/') ? 'Nota de voz' : m.fileName}
                  </span>
                  <span className="block text-xs text-gray-500">Enviando…</span>
                </span>
              </div>
            ) : m.fileMime?.startsWith('audio/') ? (
              <AuthAudio messageId={m.id} mine={mine} />
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
              {m.editedAt && <span>· editado</span>}
            </div>
          </div>
        ) : isPoll ? (
          <div>
            {showMeta && (
              <p className="mb-0.5 text-[10px] font-semibold text-gray-500">
                {senderName(m.senderId, users)}
              </p>
            )}
            {forwardedTag}
            {replyQuote}
            <PollView m={m} meId={meId} onVote={onVote} />
            <div
              className={`mt-1 flex items-center gap-1 text-[10px] text-gray-500 ${
                mine ? 'justify-end' : ''
              }`}
            >
              <span>{timeOf(m.createdAt)}</span>
            </div>
          </div>
        ) : loc ? (
          <div>
            {showMeta && (
              <p className="mb-0.5 text-[10px] font-semibold text-gray-500">
                {senderName(m.senderId, users)}
              </p>
            )}
            {forwardedTag}
            {replyQuote}
            <a
              href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-60 max-w-full items-center gap-3 rounded-2xl bg-black/5 p-3 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-500">
                <MapPin className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Ubicación</span>
                <span className="block truncate text-xs text-gray-500">
                  {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                </span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-gray-400" />
            </a>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
              <span>{timeOf(m.createdAt)}</span>
            </div>
          </div>
        ) : contactId ? (
          <div>
            {showMeta && (
              <p className="mb-0.5 text-[10px] font-semibold text-gray-500">
                {senderName(m.senderId, users)}
              </p>
            )}
            {forwardedTag}
            {replyQuote}
            <div className="w-60 max-w-full rounded-2xl bg-black/5 p-3 dark:bg-white/10">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={avatarStyle(contactId)}
                >
                  {initials(senderName(contactId, users))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {senderName(contactId, users)}
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {users.find((u) => u.id === contactId)?.role ?? 'Contacto'}
                  </span>
                </span>
              </div>
              {onStartDm && contactId !== meId && (
                <button
                  onClick={() => onStartDm(contactId)}
                  className="mt-2 w-full rounded-full bg-blue-600 py-1.5 text-xs font-semibold text-white"
                >
                  Enviar mensaje
                </button>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[10px] text-gray-500">
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
            {forwardedTag}
            {replyQuote}
            {gifUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={gifUrl}
                alt="GIF"
                loading="lazy"
                className="max-h-72 max-w-[18rem] rounded-[18px] object-cover"
              />
            ) : isImage ? (
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
                {translation && (
                  <div
                    className={`mt-1.5 border-t pt-1.5 text-sm italic ${
                      onColored
                        ? 'border-white/25 text-white/90'
                        : 'border-black/10 text-gray-600 dark:border-white/15 dark:text-gray-300'
                    }`}
                  >
                    <span
                      className={`mb-0.5 flex items-center gap-1 text-[10px] not-italic ${
                        onColored ? 'text-white/70' : 'text-gray-400'
                      }`}
                    >
                      <Languages className="h-3 w-3" /> Traducción
                    </span>
                    {translation}
                  </div>
                )}
              </div>
            )}
            {linkUrl && <LinkPreviewCard url={linkUrl} onColored={onColored} />}
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
              {m.editedAt && !sending && <span>· editado</span>}
              {sending && (
                <>
                  <Clock className="h-3 w-3" />
                  <span>Enviando…</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Indicador de mensaje guardado */}
        {m.saved && (
          <div
            className={`mt-1 flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 ${
              mine ? 'justify-end' : ''
            }`}
          >
            <BookmarkCheck className="h-3 w-3" /> Guardado
          </div>
        )}

        {/* Enlace al hilo de respuestas */}
        {(m.threadCount ?? 0) > 0 && (
          <button
            onClick={() => onOpenThread?.(m)}
            className={`mt-1 flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400 ${
              mine ? 'ml-auto justify-end' : ''
            }`}
          >
            <MessageSquare className="h-3 w-3" />
            {m.threadCount} {m.threadCount === 1 ? 'respuesta' : 'respuestas'}
          </button>
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
  status,
  mentioned,
  onClick,
  menuOpen,
  onMenuToggle,
  onPin,
  onArchive,
  onMute,
  onUnread,
}: {
  convo: ChatConversation;
  active: boolean;
  status?: PresenceStatus | 'offline';
  mentioned?: boolean;
  onClick: () => void;
  menuOpen?: boolean;
  onMenuToggle?: () => void;
  onPin?: () => void;
  onArchive?: () => void;
  onMute?: (hours: number) => void;
  onUnread?: () => void;
}) {
  const lastPreview = conversationPreview(convo.lastMessage);
  const unread = convo.unread > 0 || !!convo.markedUnread;
  const when = relativeTime(convo.lastMessageAt);
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div
      className={`group relative flex items-center rounded-2xl transition-colors ${
        active ? 'bg-black/10 dark:bg-white/15' : 'hover:bg-black/5 dark:hover:bg-white/10'
      }`}
    >
      <button
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 p-2 text-left"
      >
        <span className="relative shrink-0">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white"
            style={avatarStyle(convo.counterpartId || convo.id)}
          >
            {convo.type === 'channel' ? <Hash className="h-4 w-4" /> : initials(convo.title || '?')}
          </span>
          {status && <PresenceDot status={status} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {convo.pinned && (
              <Pin className="h-3 w-3 shrink-0 -rotate-45 text-gray-400" />
            )}
            <span
              className={`min-w-0 flex-1 truncate text-sm ${unread ? 'font-bold' : 'font-medium'}`}
            >
              {convo.title || 'Conversación'}
            </span>
            {convo.muted && (
              <BellOff className="h-3 w-3 shrink-0 text-gray-400" />
            )}
            {when && (
              <span
                className={`shrink-0 text-[10px] ${unread ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
              >
                {when}
              </span>
            )}
          </span>
          <span
            className={`block truncate text-xs ${unread ? 'font-medium text-gray-700 dark:text-gray-200' : 'text-gray-500'}`}
          >
            {lastPreview}
          </span>
          {(convo.labels?.length ?? 0) > 0 && (
            <span className="mt-0.5 flex flex-wrap gap-1">
              {convo.labels!.slice(0, 3).map((l) => (
                <span
                  key={l}
                  className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-medium text-blue-600 dark:text-blue-300"
                >
                  {l}
                </span>
              ))}
            </span>
          )}
        </span>
        {mentioned && (
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white"
            title="Te mencionaron"
          >
            <AtSign className="h-3 w-3" />
          </span>
        )}
        {convo.unread > 0 ? (
          <span
            className={`flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${
              convo.muted ? 'bg-gray-400' : 'bg-red-500'
            }`}
          >
            {convo.unread}
          </span>
        ) : (
          convo.markedUnread && (
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                convo.muted ? 'bg-gray-400' : 'bg-blue-500'
              }`}
              title="No leído"
            />
          )
        )}
      </button>

      {/* Menú contextual (fijar / silenciar / no leído / archivar) */}
      {onMenuToggle && (
        <button
          onClick={(e) => {
            stop(e);
            onMenuToggle();
          }}
          aria-label="Opciones de conversación"
          className="mr-1 shrink-0 rounded-full p-1.5 text-gray-500 opacity-100 hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:bg-white/15"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      )}
      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={(e) => {
              stop(e);
              onMenuToggle?.();
            }}
          />
          <div
            onClick={stop}
            className={`${glass} absolute right-2 top-12 z-40 w-56 rounded-2xl p-1 shadow-xl`}
          >
            <MenuItem
              icon={
                convo.pinned ? (
                  <PinOff className="h-4 w-4" />
                ) : (
                  <Pin className="h-4 w-4" />
                )
              }
              label={convo.pinned ? 'Desfijar' : 'Fijar arriba'}
              onClick={() => onPin?.()}
            />
            <MenuItem
              icon={convo.unread || convo.markedUnread ? (
                <MailOpen className="h-4 w-4" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              label={
                convo.unread || convo.markedUnread
                  ? 'Marcar como leído'
                  : 'Marcar como no leído'
              }
              onClick={() => onUnread?.()}
            />
            {convo.muted ? (
              <MenuItem
                icon={<Bell className="h-4 w-4" />}
                label="Activar notificaciones"
                onClick={() => onMute?.(0)}
              />
            ) : (
              <>
                <p className="px-3 pb-0.5 pt-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  Silenciar
                </p>
                <MenuItem
                  icon={<BellOff className="h-4 w-4" />}
                  label="8 horas"
                  onClick={() => onMute?.(8)}
                />
                <MenuItem
                  icon={<BellOff className="h-4 w-4" />}
                  label="1 semana"
                  onClick={() => onMute?.(168)}
                />
                <MenuItem
                  icon={<BellOff className="h-4 w-4" />}
                  label="Siempre"
                  onClick={() => onMute?.(876000)}
                />
              </>
            )}
            <MenuItem
              icon={
                convo.archived ? (
                  <ArchiveRestore className="h-4 w-4" />
                ) : (
                  <Archive className="h-4 w-4" />
                )
              }
              label={convo.archived ? 'Desarchivar' : 'Archivar'}
              onClick={() => onArchive?.()}
            />
          </div>
        </>
      )}
    </div>
  );
}

function PollModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (question: string, options: string[], multi: boolean) => void;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [multi, setMulti] = useState(false);
  const clean = options.map((o) => o.trim()).filter(Boolean);
  const valid = question.trim().length > 0 && clean.length >= 2;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className={`${glass} w-full max-w-md rounded-[24px] p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Nueva encuesta</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pregunta…"
          className="mb-3 w-full rounded-xl bg-black/5 px-4 py-2 text-sm outline-none dark:bg-white/10"
        />
        <div className="space-y-2">
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={o}
                onChange={(e) =>
                  setOptions((prev) =>
                    prev.map((x, idx) => (idx === i ? e.target.value : x)),
                  )
                }
                placeholder={`Opción ${i + 1}`}
                className="flex-1 rounded-xl bg-black/5 px-4 py-2 text-sm outline-none dark:bg-white/10"
              />
              {options.length > 2 && (
                <button
                  onClick={() =>
                    setOptions((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  aria-label="Quitar opción"
                  className="rounded-full p-1.5 text-gray-400 hover:bg-black/5 hover:text-red-500 dark:hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 10 && (
          <button
            onClick={() => setOptions((prev) => [...prev, ''])}
            className="mt-2 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400"
          >
            <Plus className="h-3.5 w-3.5" /> Añadir opción
          </button>
        )}
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={multi}
            onChange={(e) => setMulti(e.target.checked)}
          />
          Permitir varias respuestas
        </label>
        <button
          onClick={() => onCreate(question.trim(), clean, multi)}
          disabled={!valid}
          className="mt-4 w-full rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Crear encuesta
        </button>
      </div>
    </div>
  );
}

/** Valor para <input type="datetime-local"> a partir de una fecha local. */
function localDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function ScheduleModal({
  initialText,
  onClose,
  onSchedule,
}: {
  initialText: string;
  onClose: () => void;
  onSchedule: (body: string, sendAtISO: string) => void;
}) {
  const [text, setText] = useState(initialText);
  const [when, setWhen] = useState(() =>
    localDatetimeValue(new Date(Date.now() + 3600000)),
  );
  const valid =
    text.trim().length > 0 &&
    !!when &&
    new Date(when).getTime() > Date.now() + 10000;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className={`${glass} w-full max-w-md rounded-[24px] p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Programar mensaje</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Mensaje…"
          className="mb-3 w-full resize-none rounded-xl bg-black/5 px-4 py-2 text-sm outline-none dark:bg-white/10"
        />
        <label className="mb-1 block text-xs font-medium text-gray-400">
          Enviar el
        </label>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="mb-4 w-full rounded-xl bg-black/5 px-4 py-2 text-sm outline-none dark:bg-white/10"
        />
        <button
          onClick={() => onSchedule(text.trim(), new Date(when).toISOString())}
          disabled={!valid}
          className="w-full rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Programar
        </button>
      </div>
    </div>
  );
}

function ChannelSettingsModal({
  convo,
  users,
  meId,
  onClose,
  onChanged,
  onLeft,
  onError,
}: {
  convo: ChatConversation;
  users: ChatUser[];
  meId: string;
  onClose: () => void;
  onChanged: () => void;
  onLeft: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(convo.title || '');
  const [memberIds, setMemberIds] = useState<string[]>(convo.memberIds);
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncementState] = useState(!!convo.announcement);
  const isCreator = (convo.createdById ?? null) === meId;

  async function toggleAnnouncement() {
    const next = !announcement;
    setAnnouncementState(next);
    try {
      await chatApi.setAnnouncement(convo.id, next);
      onChanged();
    } catch (e) {
      setAnnouncementState(!next);
      onError(`No se pudo cambiar: ${(e as Error).message}`);
    }
  }
  const memberUsers = users.filter((u) => memberIds.includes(u.id));
  const nonMembers = users.filter(
    (u) =>
      !memberIds.includes(u.id) &&
      (u.username || u.email || '')
        .toLowerCase()
        .includes(addQuery.toLowerCase()),
  );

  async function rename() {
    const n = name.trim();
    if (!n || n === convo.title) return;
    setBusy(true);
    try {
      await chatApi.renameChannel(convo.id, n);
      onChanged();
    } catch (e) {
      onError(`No se pudo renombrar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }
  async function addOne(userId: string) {
    try {
      await chatApi.addMembers(convo.id, [userId]);
      setMemberIds((ids) => [...ids, userId]);
      onChanged();
    } catch (e) {
      onError(`No se pudo agregar: ${(e as Error).message}`);
    }
  }
  async function removeOne(userId: string) {
    try {
      await chatApi.removeMember(convo.id, userId);
      setMemberIds((ids) => ids.filter((i) => i !== userId));
      onChanged();
    } catch (e) {
      onError(`No se pudo quitar: ${(e as Error).message}`);
    }
  }
  async function leave() {
    try {
      await chatApi.leaveChannel(convo.id);
      onLeft();
    } catch (e) {
      onError(`No se pudo salir: ${(e as Error).message}`);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className={`${glass} flex max-h-[85vh] w-full max-w-md flex-col rounded-[24px] p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Ajustes del canal</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nombre */}
        <label className="mb-1 block text-xs font-medium text-gray-400">Nombre</label>
        <div className="mb-4 flex items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-xl bg-black/5 px-4 py-2 text-sm outline-none dark:bg-white/10"
          />
          <button
            onClick={rename}
            disabled={busy || !name.trim() || name.trim() === convo.title}
            className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Guardar
          </button>
        </div>

        {/* Miembros */}
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-gray-400">
            Miembros · {memberIds.length}
          </p>
          <button
            onClick={() => setAdding((a) => !a)}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400"
          >
            <UserPlus className="h-3.5 w-3.5" /> Añadir
          </button>
        </div>

        {adding && (
          <div className="mb-3 rounded-2xl bg-black/5 p-2 dark:bg-white/10">
            <input
              autoFocus
              value={addQuery}
              onChange={(e) => setAddQuery(e.target.value)}
              placeholder="Buscar para añadir…"
              className="mb-1 w-full rounded-lg bg-transparent px-2 py-1 text-sm outline-none"
            />
            <div className="max-h-32 overflow-y-auto">
              {nonMembers.length === 0 && (
                <p className="px-2 py-1 text-xs text-gray-400">Sin resultados</p>
              )}
              {nonMembers.slice(0, 20).map((u) => (
                <button
                  key={u.id}
                  onClick={() => addOne(u.id)}
                  className="flex w-full items-center gap-2 rounded-xl p-1.5 text-left hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={avatarStyle(u.id)}
                  >
                    {initials(u.username || u.email)}
                  </span>
                  <span className="truncate text-sm">{u.username || u.email}</span>
                  <UserPlus className="ml-auto h-4 w-4 text-blue-500" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {/* Yo */}
          <div className="flex items-center gap-2 rounded-xl p-1.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={avatarStyle(meId)}
            >
              {initials('Tú')}
            </span>
            <span className="text-sm font-medium">Tú</span>
            {isCreator && (
              <span className="ml-auto text-[10px] text-gray-400">Creador</span>
            )}
          </div>
          {memberUsers.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={avatarStyle(u.id)}
              >
                {initials(u.username || u.email)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {u.username || u.email}
                </span>
                <span className="block truncate text-xs text-gray-500">{u.role}</span>
              </span>
              {isCreator && (
                <button
                  onClick={() => removeOne(u.id)}
                  aria-label="Quitar del canal"
                  className="ml-auto rounded-full p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {isCreator && (
          <label className="mt-4 flex items-start gap-2.5 rounded-2xl bg-black/5 p-3 text-sm dark:bg-white/10">
            <input
              type="checkbox"
              checked={announcement}
              onChange={toggleAnnouncement}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-medium">
                <Megaphone className="h-4 w-4 text-amber-500" /> Canal de anuncios
              </span>
              <span className="block text-xs text-gray-500">
                Solo el creador puede publicar; el resto solo lee.
              </span>
            </span>
          </label>
        )}

        <button
          onClick={leave}
          className="mt-4 flex items-center justify-center gap-2 rounded-full border border-red-500/30 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400"
        >
          <LogOut className="h-4 w-4" /> Salir del canal
        </button>
      </div>
    </div>
  );
}

function ForwardModal({
  conversations,
  onClose,
  onConfirm,
}: {
  conversations: ChatConversation[];
  onClose: () => void;
  onConfirm: (conversationIds: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const list = conversations.filter((c) =>
    (c.title || '').toLowerCase().includes(q.toLowerCase()),
  );
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className={`${glass} flex max-h-[85vh] w-full max-w-md flex-col rounded-[24px] p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Reenviar a…</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={`${glass} mb-3 flex items-center gap-2 rounded-full px-3 py-2`}>
          <Search className="h-4 w-4 text-gray-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar conversación…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
          />
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {list.length === 0 && (
            <p className="px-1 text-xs text-gray-400">Sin conversaciones</p>
          )}
          {list.map((c) => {
            const on = selected.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors ${
                  on ? 'bg-blue-500/15' : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={avatarStyle(c.counterpartId || c.id)}
                >
                  {c.type === 'channel' ? (
                    <Hash className="h-4 w-4" />
                  ) : (
                    initials(c.title || '?')
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {c.title || 'Conversación'}
                  </span>
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    on
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {on && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => onConfirm(selected)}
          disabled={selected.length === 0}
          className="mt-4 w-full rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {selected.length > 1
            ? `Reenviar a ${selected.length} chats`
            : 'Reenviar'}
        </button>
      </div>
    </div>
  );
}

/** Selector de un empleado del directorio para compartir su contacto. */
function ContactPickerModal({
  users,
  onClose,
  onPick,
}: {
  users: ChatUser[];
  onClose: () => void;
  onPick: (userId: string) => void;
}) {
  const [q, setQ] = useState('');
  const list = users.filter((u) =>
    (u.username || u.email || '').toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className={`${glass} flex max-h-[80vh] w-full max-w-md flex-col rounded-[24px] p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Compartir contacto</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={`${glass} mb-3 flex items-center gap-2 rounded-full px-3 py-2`}>
          <Search className="h-4 w-4 text-gray-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar empleado…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
          />
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {list.length === 0 && (
            <p className="px-1 text-xs text-gray-400">Sin resultados</p>
          )}
          {list.map((u) => (
            <button
              key={u.id}
              onClick={() => onPick(u.id)}
              className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                style={avatarStyle(u.id)}
              >
                {initials(u.username || u.email)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {u.username || u.email}
                </span>
                <span className="block truncate text-xs text-gray-500">{u.role}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Una fila de mensaje dentro del panel de hilo (versión ligera). */
function ThreadMessageRow({
  m,
  users,
  root,
}: {
  m: ChatMessage;
  users: ChatUser[];
  root?: boolean;
}) {
  const body = m.body ?? '';
  const isText = m.type === 'text';
  const gifUrl = isText ? parseGif(body) : null;
  const stickerId = isText && !gifUrl ? parseStickerId(body) : null;
  const plain =
    isText &&
    !gifUrl &&
    !stickerId &&
    !parseLocation(body) &&
    !parseContact(body);
  return (
    <div className={`flex gap-2 ${root ? '' : 'mt-3'}`}>
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={avatarStyle(m.senderId)}
      >
        {initials(senderName(m.senderId, users))}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold">
            {senderName(m.senderId, users)}
          </span>
          <span className="text-[10px] text-gray-400">{timeOf(m.createdAt)}</span>
        </div>
        <div className="break-words text-sm leading-relaxed text-gray-800 dark:text-gray-100">
          {m.deletedAt ? (
            <span className="italic text-gray-400">Mensaje eliminado</span>
          ) : gifUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={gifUrl}
              alt="GIF"
              loading="lazy"
              className="max-h-48 max-w-[14rem] rounded-xl object-cover"
            />
          ) : stickerId ? (
            <span className="block h-20 w-20">{getSticker(stickerId)?.node}</span>
          ) : plain ? (
            renderMessageText(body, { mine: false })
          ) : (
            <span className="text-gray-500">{replySnippet(m)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Panel lateral con el hilo de respuestas a un mensaje + composer propio. */
function ThreadPanel({
  root,
  replies,
  users,
  onClose,
  onSend,
}: {
  root: ChatMessage;
  replies: ChatMessage[];
  users: ChatUser[];
  onClose: () => void;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);
  function submit() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  }
  return (
    <div className="fixed inset-0 z-[210] flex items-stretch justify-end bg-black/40">
      <div
        className={`${glass} flex h-full w-full max-w-md flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-black/5 px-5 py-4 dark:border-white/10">
          <MessageSquare className="h-5 w-5 text-blue-500" />
          <h3 className="flex-1 text-base font-semibold">Hilo</h3>
          <button
            onClick={onClose}
            aria-label="Cerrar hilo"
            className="rounded-full p-1.5 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Mensaje raíz */}
          <div className="rounded-2xl bg-black/5 p-3 dark:bg-white/10">
            <ThreadMessageRow m={root} users={users} root />
          </div>
          <div className="my-3 flex items-center gap-3 text-[11px] text-gray-400">
            <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
            {replies.length}{' '}
            {replies.length === 1 ? 'respuesta' : 'respuestas'}
            <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          </div>
          {/* Respuestas */}
          {replies.map((r) => (
            <ThreadMessageRow key={r.id} m={r} users={users} />
          ))}
          <div ref={endRef} />
        </div>

        <div className="border-t border-black/5 p-3 dark:border-white/10">
          <div className={`${glass} flex items-end gap-2 rounded-2xl px-3 py-2`}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Responder en el hilo…"
              className="max-h-32 min-h-[1.5rem] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-gray-500"
            />
            <button
              onClick={submit}
              disabled={!text.trim()}
              aria-label="Enviar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Editor de etiquetas/carpetas personales de una conversación. */
function LabelModal({
  convo,
  suggestions,
  onClose,
  onSave,
}: {
  convo: ChatConversation;
  suggestions: string[];
  onClose: () => void;
  onSave: (labels: string[]) => void;
}) {
  const [labels, setLabels] = useState<string[]>(convo.labels ?? []);
  const [input, setInput] = useState('');
  function add(raw: string) {
    const l = raw.trim().slice(0, 40);
    if (!l || labels.includes(l) || labels.length >= 12) return;
    setLabels((prev) => [...prev, l]);
    setInput('');
  }
  const remaining = suggestions.filter((s) => !labels.includes(s));
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className={`${glass} w-full max-w-md rounded-[24px] p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Tag className="h-5 w-5 text-blue-500" /> Etiquetas
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 truncate text-xs text-gray-400">
          {convo.title || 'Conversación'}
        </p>

        {/* Etiquetas asignadas */}
        <div className="mb-3 flex min-h-[2rem] flex-wrap gap-1.5">
          {labels.length === 0 && (
            <span className="text-xs text-gray-400">Sin etiquetas todavía</span>
          )}
          {labels.map((l) => (
            <span
              key={l}
              className="flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300"
            >
              {l}
              <button
                onClick={() => setLabels((prev) => prev.filter((x) => x !== l))}
                aria-label={`Quitar ${l}`}
                className="rounded-full hover:text-red-500"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        {/* Añadir nueva */}
        <div className={`${glass} mb-3 flex items-center gap-2 rounded-full px-3 py-2`}>
          <Plus className="h-4 w-4 text-gray-500" />
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add(input);
              }
            }}
            placeholder="Nueva etiqueta…"
            maxLength={40}
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
          />
          {input.trim() && (
            <button
              onClick={() => add(input)}
              className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400"
            >
              Añadir
            </button>
          )}
        </div>

        {/* Sugerencias de etiquetas existentes */}
        {remaining.length > 0 && (
          <div className="mb-4">
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Existentes
            </p>
            <div className="flex flex-wrap gap-1.5">
              {remaining.map((s) => (
                <button
                  key={s}
                  onClick={() => add(s)}
                  className="flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1 text-xs text-gray-600 hover:bg-black/10 dark:bg-white/10 dark:text-gray-300"
                >
                  <Tag className="h-3 w-3" /> {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => onSave(labels)}
          className="w-full rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

/** Caché de previsualizaciones de enlaces (por URL, durante la sesión). */
const linkPreviewCache = new Map<string, LinkPreviewData | null>();
type LinkPreviewData = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
};

/** Tarjeta de previsualización (OpenGraph) bajo un mensaje con enlace. */
function LinkPreviewCard({
  url,
  onColored,
}: {
  url: string;
  onColored: boolean;
}) {
  const [data, setData] = useState<LinkPreviewData | null>(
    () => linkPreviewCache.get(url) ?? null,
  );
  const [done, setDone] = useState(() => linkPreviewCache.has(url));

  useEffect(() => {
    if (linkPreviewCache.has(url)) {
      setData(linkPreviewCache.get(url) ?? null);
      setDone(true);
      return;
    }
    let alive = true;
    chatApi
      .unfurl(url)
      .then((d) => {
        const useful = d && (d.title || d.description || d.image) ? d : null;
        linkPreviewCache.set(url, useful);
        if (alive) {
          setData(useful);
          setDone(true);
        }
      })
      .catch(() => {
        linkPreviewCache.set(url, null);
        if (alive) {
          setData(null);
          setDone(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [url]);

  if (!done || !data) return null;
  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`mt-1.5 block max-w-[18rem] overflow-hidden rounded-xl border ${
        onColored
          ? 'border-white/25 bg-white/10'
          : 'border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10'
      }`}
    >
      {data.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.image}
          alt=""
          loading="lazy"
          className="h-32 w-full object-cover"
        />
      )}
      <div className="p-2">
        {data.siteName && (
          <p
            className={`truncate text-[10px] uppercase tracking-wide ${
              onColored ? 'text-white/60' : 'text-gray-400'
            }`}
          >
            {data.siteName}
          </p>
        )}
        {data.title && (
          <p
            className={`line-clamp-2 text-xs font-semibold ${
              onColored ? 'text-white' : ''
            }`}
          >
            {data.title}
          </p>
        )}
        {data.description && (
          <p
            className={`mt-0.5 line-clamp-2 text-[11px] ${
              onColored ? 'text-white/80' : 'text-gray-500'
            }`}
          >
            {data.description}
          </p>
        )}
      </div>
    </a>
  );
}

/** Galería de la conversación: fotos, archivos y enlaces compartidos. */
function GalleryModal({
  conversationId,
  users,
  onClose,
  onJump,
}: {
  conversationId: string;
  users: ChatUser[];
  onClose: () => void;
  onJump: (messageId: string) => void;
}) {
  const [tab, setTab] = useState<'image' | 'file' | 'link'>('image');
  const [items, setItems] = useState<(MediaItem | LinkItem)[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    chatApi
      .listMedia(conversationId, tab)
      .then((r) => {
        if (alive) {
          setItems(r);
          setLoading(false);
        }
      })
      .catch(() => {
        if (alive) {
          setItems([]);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [conversationId, tab]);

  const tabs: { k: 'image' | 'file' | 'link'; label: string; icon: React.ReactNode }[] = [
    { k: 'image', label: 'Fotos', icon: <Images className="h-4 w-4" /> },
    { k: 'file', label: 'Archivos', icon: <FileText className="h-4 w-4" /> },
    { k: 'link', label: 'Enlaces', icon: <Link2 className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className={`${glass} flex h-[34rem] w-full max-w-lg flex-col rounded-[24px] p-5`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Galería</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-3 flex gap-1 rounded-full bg-black/5 p-1 dark:bg-white/10">
          {tabs.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-medium transition-colors ${
                tab === t.k
                  ? 'bg-white text-black shadow dark:bg-white/20 dark:text-white'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="py-10 text-center text-sm text-gray-400">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              No hay {tab === 'image' ? 'fotos' : tab === 'file' ? 'archivos' : 'enlaces'} todavía
            </p>
          ) : tab === 'image' ? (
            <div className="grid grid-cols-3 gap-1.5">
              {(items as MediaItem[]).map((it) => (
                <button
                  key={it.id}
                  onClick={() => {
                    onClose();
                    onJump(it.id);
                  }}
                  className="aspect-square overflow-hidden rounded-lg bg-black/5 dark:bg-white/10"
                >
                  <AuthImage messageId={it.id} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : tab === 'file' ? (
            <div className="space-y-1.5">
              {(items as MediaItem[]).map((it) => (
                <button
                  key={it.id}
                  onClick={() => {
                    onClose();
                    onJump(it.id);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/10 dark:bg-white/15">
                    <FileText className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {it.fileName || 'archivo'}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {senderName(it.senderId, users)} ·{' '}
                      {it.fileSize ? formatBytes(it.fileSize) : ''}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {(items as LinkItem[]).map((it) => (
                <button
                  key={it.id}
                  onClick={() => {
                    onClose();
                    onJump(it.id);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-black/10 dark:bg-white/15">
                    <Link2 className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-blue-600 dark:text-blue-400">
                      {it.url}
                    </span>
                    <span className="block truncate text-xs text-gray-500">
                      {senderName(it.senderId, users)} · {relativeTime(it.createdAt)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Lista de mensajes guardados (destacados) del usuario. */
function SavedModal({
  items,
  users,
  onClose,
  onOpen,
}: {
  items: SavedItem[];
  users: ChatUser[];
  onClose: () => void;
  onOpen: (it: SavedItem) => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className={`${glass} flex max-h-[80vh] w-full max-w-md flex-col rounded-[24px] p-5`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Bookmark className="h-5 w-5 text-amber-500" /> Guardados
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">
              Aún no has guardado mensajes. Usa “Guardar” en el menú de un mensaje.
            </p>
          ) : (
            items.map((it) => (
              <button
                key={it.id}
                onClick={() => onOpen(it)}
                className="flex w-full items-start gap-3 rounded-2xl p-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={avatarStyle(it.conversationId)}
                >
                  {it.conversationType === 'channel' ? (
                    <Hash className="h-4 w-4" />
                  ) : (
                    initials(it.conversationTitle)
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {it.conversationTitle}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-400">
                      {relativeTime(it.createdAt)}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-gray-500">
                    {senderName(it.senderId, users)}: {it.snippet}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** Reuniones programadas: lista de próximas + formulario para crear una nueva. */
function MeetingModal({
  meetings,
  meId,
  onClose,
  onCreate,
  onCancel,
  onJoin,
}: {
  meetings: Meeting[];
  meId: string;
  onClose: () => void;
  onCreate: (data: {
    title: string;
    startAt: string;
    durationMin: number;
    recurrence: 'none' | 'daily' | 'weekly';
  }) => void;
  onCancel: (id: string) => void;
  onJoin: (conversationId: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(() =>
    localDatetimeValue(new Date(Date.now() + 3600000)),
  );
  const [duration, setDuration] = useState(30);
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'weekly'>(
    'none',
  );
  const valid =
    title.trim().length > 0 &&
    !!when &&
    new Date(when).getTime() > Date.now() - 60000;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className={`${glass} flex max-h-[85vh] w-full max-w-md flex-col rounded-[24px] p-6`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarPlus className="h-5 w-5 text-emerald-500" /> Reuniones
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {meetings.length > 0 && (
          <div className="mb-4 space-y-1.5">
            {meetings.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2 text-sm dark:bg-white/10"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.title}</span>
                  <span className="block text-xs text-gray-500">
                    {new Date(m.startAt).toLocaleString([], {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {m.recurrence !== 'none' && (
                      <span className="ml-1 inline-flex items-center gap-0.5">
                        <Repeat className="h-3 w-3" />
                        {m.recurrence === 'daily' ? 'diaria' : 'semanal'}
                      </span>
                    )}
                  </span>
                </span>
                <button
                  onClick={() => onJoin(m.conversationId)}
                  className="shrink-0 rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                >
                  Unirse
                </button>
                {m.createdById === meId && (
                  <button
                    onClick={() => onCancel(m.id)}
                    aria-label="Cancelar reunión"
                    className="shrink-0 text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
          Nueva reunión
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título de la reunión…"
          className="mb-2 w-full rounded-xl bg-black/5 px-4 py-2 text-sm outline-none dark:bg-white/10"
        />
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="mb-2 w-full rounded-xl bg-black/5 px-4 py-2 text-sm outline-none dark:bg-white/10"
        />
        <div className="mb-4 flex gap-2">
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="flex-1 rounded-xl bg-black/5 px-3 py-2 text-sm outline-none dark:bg-white/10"
          >
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>1 hora</option>
          </select>
          <select
            value={recurrence}
            onChange={(e) =>
              setRecurrence(e.target.value as 'none' | 'daily' | 'weekly')
            }
            className="flex-1 rounded-xl bg-black/5 px-3 py-2 text-sm outline-none dark:bg-white/10"
          >
            <option value="none">No se repite</option>
            <option value="daily">Cada día</option>
            <option value="weekly">Cada semana</option>
          </select>
        </div>
        <button
          onClick={() =>
            onCreate({
              title: title.trim(),
              startAt: new Date(when).toISOString(),
              durationMin: duration,
              recurrence,
            })
          }
          disabled={!valid}
          className="w-full rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Programar reunión
        </button>
      </div>
    </div>
  );
}

/** Modal con el resumen "Ponerme al día" generado por IA. */
function AiSummaryModal({
  summary,
  loading,
  onClose,
}: {
  summary: string;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div className={`${glass} w-full max-w-md rounded-[24px] p-6`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-violet-500" /> Ponerme al día
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Resumiendo…
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
            {summary}
          </div>
        )}
        <p className="mt-3 text-[10px] text-gray-400">
          Generado por IA · puede contener errores.
        </p>
      </div>
    </div>
  );
}

/** Paleta de comandos (Ctrl/Cmd+K): saltar a chats y acciones rápidas. */
function CommandPalette({
  conversations,
  onClose,
  onOpenConversation,
  onAction,
}: {
  conversations: ChatConversation[];
  onClose: () => void;
  onOpenConversation: (id: string) => void;
  onAction: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const actions = [
    { id: 'catchup', label: 'Ponerme al día (IA)' },
    { id: 'meeting', label: 'Programar reunión' },
    { id: 'new-channel', label: 'Nuevo canal' },
    { id: 'saved', label: 'Mensajes guardados' },
  ];
  const ql = q.trim().toLowerCase();
  const acts = actions.filter((a) => a.label.toLowerCase().includes(ql));
  const convos = conversations
    .filter((c) => (c.title || '').toLowerCase().includes(ql))
    .slice(0, 8);
  type Item =
    | { kind: 'action'; id: string; label: string }
    | { kind: 'convo'; id: string; label: string; type: 'dm' | 'channel' };
  const items: Item[] = [
    ...acts.map((a) => ({ kind: 'action' as const, id: a.id, label: a.label })),
    ...convos.map((c) => ({
      kind: 'convo' as const,
      id: c.id,
      label: c.title || 'Conversación',
      type: c.type,
    })),
  ];
  const clampedIdx = items.length ? Math.min(idx, items.length - 1) : 0;
  const choose = (it: Item) => {
    if (it.kind === 'action') onAction(it.id);
    else onOpenConversation(it.id);
  };
  return (
    <div
      className="fixed inset-0 z-[350] flex items-start justify-center bg-black/40 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className={`${glass} flex max-h-[60vh] w-full max-w-lg flex-col overflow-hidden rounded-[20px] shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-black/5 px-4 py-3 dark:border-white/10">
          <Command className="h-4 w-4 text-gray-400" />
          <input
            autoFocus
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setIdx((i) => Math.min(i + 1, items.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setIdx((i) => Math.max(i - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (items[clampedIdx]) choose(items[clampedIdx]);
              }
            }}
            placeholder="Buscar chats o acciones…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-500"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Sin resultados</p>
          ) : (
            items.map((it, i) => (
              <button
                key={`${it.kind}-${it.id}`}
                onClick={() => choose(it)}
                onMouseEnter={() => setIdx(i)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm ${
                  i === clampedIdx
                    ? 'bg-blue-500/15'
                    : 'hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black/10 dark:bg-white/15">
                  {it.kind === 'action' ? (
                    <Command className="h-4 w-4" />
                  ) : it.type === 'channel' ? (
                    <Hash className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                {it.kind === 'action' && (
                  <span className="shrink-0 text-[10px] text-gray-400">acción</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
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
  const [announcement, setAnnouncement] = useState(false);
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
      const convo = await chatApi.createChannel(name.trim(), selected, announcement);
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
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={avatarStyle(u.id)}
              >
                {initials(u.username || u.email)}
              </span>
              <span className="text-sm">{u.username || u.email}</span>
              {selected.includes(u.id) && <span className="ml-auto text-xs text-blue-500">✓</span>}
            </button>
          ))}
        </div>
        <label className="mb-4 flex items-start gap-2.5 rounded-2xl bg-black/5 p-3 text-sm dark:bg-white/10">
          <input
            type="checkbox"
            checked={announcement}
            onChange={(e) => setAnnouncement(e.target.checked)}
            className="mt-0.5"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-medium">
              <Megaphone className="h-4 w-4 text-amber-500" /> Canal de anuncios
            </span>
            <span className="block text-xs text-gray-500">
              Solo tú podrás publicar; el resto solo lee.
            </span>
          </span>
        </label>
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
