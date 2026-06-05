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
} from '@/lib/chatApi';

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

  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

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
    const socket = io(`${CHAT_API_BASE}/chat`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
    });
    socket.on('connect', () => socket.emit('join', meId));
    socket.on('message:new', (msg: ChatMessage) => {
      if (msg.conversationId === activeIdRef.current) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
      refreshConversations();
    });
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [meId, refreshConversations]);

  // Cargar mensajes al cambiar de conversación + marcar leído
  useEffect(() => {
    if (!activeId) return;
    chatApi.listMessages(activeId).then(setMessages).catch(() => setMessages([]));
    chatApi.markRead(activeId).then(refreshConversations).catch(() => {});
  }, [activeId, refreshConversations]);

  // Autoscroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSendText() {
    const body = draft.trim();
    if (!body || !activeId) return;
    setDraft('');
    setShowEmoji(false);
    try {
      const msg = await chatApi.sendText(activeId, body);
      setMessages((prev) => [...prev, msg]);
      refreshConversations();
    } catch {
      setDraft(body); // restaura si falla
    }
  }

  async function handleSendImage(file: File) {
    if (!activeId) return;
    try {
      const msg = await chatApi.sendImage(activeId, file);
      setMessages((prev) => [...prev, msg]);
      refreshConversations();
    } catch (e) {
      alert('No se pudo enviar la imagen: ' + (e as Error).message);
    }
  }

  async function startDm(userId: string) {
    const convo = await chatApi.openDm(userId);
    await refreshConversations();
    setActiveId(convo.id);
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

  return (
    <div className="min-h-screen text-black dark:text-white font-sans">
      <div className="mx-auto flex h-screen max-w-7xl gap-4 p-4 pt-6">
        {/* ── Columna izquierda ── */}
        <aside className={`${glass} flex w-80 shrink-0 flex-col rounded-[24px] p-4`}>
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
                  <ConversationRow key={c.id} convo={c} active={c.id === activeId} onClick={() => setActiveId(c.id)} />
                ))}
              </div>
            )}

            <div className="space-y-1">
              <p className="px-1 text-xs font-medium text-gray-400">Mensajes directos</p>
              {dms.length === 0 && (
                <p className="px-1 text-xs text-gray-400">Busca un empleado para iniciar un chat.</p>
              )}
              {dms.map((c) => (
                <ConversationRow key={c.id} convo={c} active={c.id === activeId} onClick={() => setActiveId(c.id)} />
              ))}
            </div>
          </div>
        </aside>

        {/* ── Panel de mensajes ── */}
        <section className={`${glass} flex min-w-0 flex-1 flex-col rounded-[24px]`}>
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
                {active.type === 'channel' ? (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/5 dark:bg-white/10">
                    <Hash className="h-5 w-5" />
                  </span>
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white">
                    {initials(active.title || '?')}
                  </span>
                )}
                <div>
                  <p className="font-semibold">{active.title || 'Conversación'}</p>
                  <p className="text-xs text-gray-500">
                    {active.type === 'channel' ? `${active.memberIds.length} miembros` : 'Mensaje directo'}
                  </p>
                </div>
              </div>

              {/* Mensajes */}
              <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                {messages.map((m) => {
                  const mine = m.senderId === meId;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[70%] rounded-[18px] px-4 py-2 ${
                          mine
                            ? 'bg-blue-600 text-white'
                            : 'bg-black/5 text-gray-900 dark:bg-white/10 dark:text-gray-100'
                        }`}
                      >
                        {active.type === 'channel' && !mine && (
                          <p className="mb-0.5 text-[10px] font-semibold opacity-70">
                            {senderName(m.senderId, users)}
                          </p>
                        )}
                        {m.type === 'image' ? (
                          <AuthImage messageId={m.id} />
                        ) : (
                          <p className="whitespace-pre-wrap break-words text-sm">{m.body}</p>
                        )}
                        <p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-gray-500'}`}>
                          {timeOf(m.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowEmoji((s) => !s)}
                    className="rounded-full p-2 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label="Emojis"
                  >
                    <Smile className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="rounded-full p-2 text-gray-500 hover:bg-black/5 dark:hover:bg-white/10"
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
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendText();
                      }
                    }}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 rounded-full bg-black/5 px-4 py-2 text-sm outline-none placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:bg-white/10"
                  />
                  <button
                    onClick={handleSendText}
                    disabled={!draft.trim()}
                    className="rounded-full bg-blue-600 p-2.5 text-white disabled:opacity-40"
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
            setActiveId(id);
          }}
        />
      )}
    </div>
  );
}

function senderName(id: string, users: ChatUser[]): string {
  const u = users.find((x) => x.id === id);
  return u?.username || u?.email || 'Usuario';
}

function ConversationRow({
  convo,
  active,
  onClick,
}: {
  convo: ChatConversation;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors ${
        active ? 'bg-black/10 dark:bg-white/15' : 'hover:bg-black/5 dark:hover:bg-white/10'
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-bold text-white">
        {convo.type === 'channel' ? <Hash className="h-4 w-4" /> : initials(convo.title || '?')}
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
      {convo.unread > 0 && (
        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
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

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const convo = await chatApi.createChannel(name.trim(), selected);
      onCreated(convo.id);
    } catch (e) {
      alert('No se pudo crear el canal: ' + (e as Error).message);
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
