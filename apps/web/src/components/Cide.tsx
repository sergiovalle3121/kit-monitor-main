'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  X,
  Send,
  Settings,
  Loader2,
  Bot,
  Wrench,
  History,
  Plus,
  MessageSquare,
  Square,
  Trash2,
  Zap,
  Copy,
  Check,
  RefreshCw,
  Pencil,
  Newspaper,
  ShieldAlert,
} from 'lucide-react';
import { glass } from '@/lib/glass';
import { isAdminAccess } from '@/lib/owner';
import { useRouteChrome } from '@/lib/routeChrome';
import { useDashboardSession } from '@/hooks/useDashboardSession';
import { BRIEFING_PROMPT, suggestionsFor } from '@/lib/chat/cideSuggestions';

type CideCard =
  | { type: 'metric'; title: string; value: number; unit?: string | null }
  | {
      type: 'line';
      title: string;
      series: { x: string; y: number }[];
      projection?: { x: string; y: number }[];
    }
  | { type: 'bars'; title: string; bars: { label: string; value: number }[] }
  | {
      type: 'actions';
      title: string;
      items: { title: string; severity: string }[];
    }
  | {
      type: 'action_proposal';
      title: string;
      actionKey: string;
      summary: string;
      params: Record<string, unknown>;
    };

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  tools?: string[];
  cards?: CideCard[];
  model?: string;
  mock?: boolean;
  escalated?: boolean;
}

/** Conversation summary as returned by GET /api/ai/conversations. */
interface ConvSummary {
  id: string;
  title: string;
  updatedAt: string;
}

/** A proactive finding as returned by GET /api/ai/insights. */
interface Insight {
  area: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  suggestedQuestion: string;
}

/** A stored message as returned by GET /api/ai/conversations/:id. */
interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[] | null;
  cards?: CideCard[] | null;
  model?: string | null;
  escalated?: boolean | null;
}

/** Union of fields carried by the SSE events from POST /api/ai/chat/stream. */
interface StreamPayload {
  conversationId?: string;
  model?: string;
  escalated?: boolean;
  text?: string;
  name?: string;
  reply?: string;
  toolsUsed?: string[];
  cards?: CideCard[];
  mock?: boolean;
  message?: string;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString('es-MX');
}

export function Cide() {
  const pathname = usePathname();
  const { hideFloatingWidgets } = useRouteChrome();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'chat' | 'history' | 'insights'>('chat');
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { session } = useDashboardSession();
  const isAdmin = isAdminAccess(session?.role, session?.email);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, loading]);

  const suggestions = suggestionsFor(pathname);

  // Oculto fuera del dashboard, en kiosko/bare y en cualquier workbench (donde
  // flotaba ENCIMA del lienzo del editor) — vía Shell Taxonomy.
  if (hideFloatingWidgets) return null;

  /** Update the trailing assistant message (the one being streamed). */
  function patchAssistant(fn: (a: ChatMsg) => ChatMsg) {
    setMessages((m) => {
      const copy = [...m];
      for (let i = copy.length - 1; i >= 0; i--) {
        if (copy[i].role === 'assistant') {
          copy[i] = fn(copy[i]);
          break;
        }
      }
      return copy;
    });
  }

  /** Drop a trailing empty assistant placeholder (e.g. after an error). */
  function dropEmptyPlaceholder() {
    setMessages((m) => {
      const last = m[m.length - 1];
      return last?.role === 'assistant' && !last.content ? m.slice(0, -1) : m;
    });
  }

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || loading) return;
    setError(null);
    // Add the user turn and an empty assistant bubble we fill as tokens arrive.
    setMessages((m) => [
      ...m,
      { role: 'user', content: msg },
      { role: 'assistant', content: '' },
    ]);
    setInput('');
    await runStream(msg);
  }

  /** Re-run the last user message, replacing the latest assistant answer. */
  async function regenerate() {
    if (loading) return;
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    setError(null);
    setMessages((m) => {
      const copy = [...m];
      while (copy.length && copy[copy.length - 1].role === 'assistant') {
        copy.pop();
      }
      copy.push({ role: 'assistant', content: '' });
      return copy;
    });
    await runStream(lastUser.content);
  }

  /** Stream one turn for `msg` into the trailing assistant bubble. */
  async function runStream(msg: string) {
    setLoading(true);

    let sawError = false;
    const handleFrame = (frame: string) => {
      let event = 'message';
      let data = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) return;
      let p: StreamPayload;
      try {
        p = JSON.parse(data) as StreamPayload;
      } catch {
        return;
      }
      if (event === 'meta') {
        if (p.conversationId) setConversationId(p.conversationId);
        patchAssistant((a) => ({ ...a, model: p.model, escalated: p.escalated }));
      } else if (event === 'delta') {
        patchAssistant((a) => ({ ...a, content: a.content + (p.text ?? '') }));
      } else if (event === 'tool' && p.name) {
        patchAssistant((a) => ({ ...a, tools: [...(a.tools ?? []), p.name!] }));
      } else if (event === 'done') {
        patchAssistant((a) => ({
          ...a,
          content: p.reply ?? a.content,
          tools: p.toolsUsed ?? a.tools,
          cards: p.cards ?? a.cards,
          model: p.model ?? a.model,
          escalated: p.escalated ?? a.escalated,
          mock: p.mock,
        }));
        if (p.conversationId) setConversationId(p.conversationId);
      } else if (event === 'error') {
        sawError = true;
        setError(p.message || 'CIDE no pudo responder.');
      }
    };

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, conversationId }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setError(data?.message || 'No se pudo contactar a CIDE.');
        dropEmptyPlaceholder();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split('\n\n');
        buf = frames.pop() ?? '';
        for (const f of frames) if (f.trim()) handleFrame(f);
      }
      if (buf.trim()) handleFrame(buf);
      if (sawError) dropEmptyPlaceholder();
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') {
        // User stopped generation: keep whatever streamed so far.
        patchAssistant((a) => ({
          ...a,
          content: a.content || '_(generación detenida)_',
        }));
      } else {
        setError('Error de red al contactar a CIDE.');
        dropEmptyPlaceholder();
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  /** Abort the in-flight streamed response. */
  function stop() {
    abortRef.current?.abort();
  }

  /** Copy an assistant answer to the clipboard, flashing a check briefly. */
  async function copyMsg(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(i);
      setTimeout(() => setCopiedIdx((c) => (c === i ? null : c)), 1500);
    } catch {
      /* clipboard blocked (insecure context) — no-op */
    }
  }

  async function openInsights() {
    setView('insights');
    setLoadingInsights(true);
    try {
      const res = await fetch('/api/ai/insights', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { insights?: Insight[] };
        setInsights(data.insights ?? []);
      } else {
        setInsights([]);
      }
    } catch {
      setInsights([]);
    } finally {
      setLoadingInsights(false);
    }
  }

  /** Jump from a Centinela finding into a chat deep-dive. */
  function analyzeInsight(question: string) {
    setView('chat');
    void send(question);
  }

  async function openHistory() {
    setView('history');
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/ai/conversations');
      if (res.ok) setConversations(await res.json());
    } catch {
      /* non-fatal: history panel just shows empty */
    } finally {
      setLoadingHistory(false);
    }
  }

  async function loadConversation(id: string) {
    setError(null);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/ai/conversations/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || 'No se pudo cargar la conversación.');
        return;
      }
      const msgs: ChatMsg[] = (data.messages ?? []).map((m: StoredMessage) => ({
        role: m.role,
        content: m.content,
        tools: m.toolsUsed ?? undefined,
        cards: m.cards ?? undefined,
        model: m.model ?? undefined,
        escalated: m.escalated ?? undefined,
      }));
      setMessages(msgs);
      setConversationId(id);
      setView('chat');
    } catch {
      setError('Error de red al cargar la conversación.');
    } finally {
      setLoadingHistory(false);
    }
  }

  function newConversation() {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setView('chat');
  }

  async function deleteConversation(id: string) {
    try {
      const res = await fetch(`/api/ai/conversations/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConversations((cs) => cs.filter((c) => c.id !== id));
        if (conversationId === id) newConversation();
      }
    } catch {
      /* non-fatal: leave the list as-is */
    }
  }

  async function renameConversation(id: string, title: string) {
    const clean = title.trim();
    if (!clean) return;
    // Optimistic: reflect the new title immediately.
    setConversations((cs) =>
      cs.map((c) => (c.id === id ? { ...c, title: clean } : c)),
    );
    try {
      await fetch(`/api/ai/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: clean }),
      });
    } catch {
      /* non-fatal: keep the optimistic title */
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir CIDE"
        className="fixed bottom-8 right-8 z-[101] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-pink-500 text-white shadow-2xl ring-1 ring-white/20 transition-all hover:scale-105 active:scale-95"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[119] bg-black/30 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className={`${glass} fixed inset-y-0 right-0 z-[120] flex w-full max-w-md flex-col border-l border-white/10`}
            >
              {/* Header */}
              <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 text-white">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold leading-tight">CIDE</h2>
                    <p className="text-xs text-black/50 dark:text-white/50">
                      Tu analista de datos · IA propia
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={newConversation}
                    aria-label="Nueva conversación"
                    title="Nueva conversación"
                    className="rounded-lg p-2 text-black/50 transition-colors hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      view === 'insights' ? setView('chat') : openInsights()
                    }
                    aria-label="Centinela · alertas"
                    title="Centinela · qué necesita tu atención"
                    className={`rounded-lg p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
                      view === 'insights'
                        ? 'text-violet-600 dark:text-violet-300'
                        : 'text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white'
                    }`}
                  >
                    <ShieldAlert className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => (view === 'history' ? setView('chat') : openHistory())}
                    aria-label="Historial de conversaciones"
                    title="Historial"
                    className={`rounded-lg p-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
                      view === 'history'
                        ? 'text-violet-600 dark:text-violet-300'
                        : 'text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white'
                    }`}
                  >
                    <History className="h-4 w-4" />
                  </button>
                  {isAdmin && (
                    <Link
                      href="/dashboard/admin/ai"
                      onClick={() => setOpen(false)}
                      aria-label="Configurar CIDE"
                      className="rounded-lg p-2 text-black/50 transition-colors hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
                    >
                      <Settings className="h-4 w-4" />
                    </Link>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar"
                    className="rounded-lg p-2 text-black/50 transition-colors hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </header>

              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
              >
                {view === 'history' ? (
                  <HistoryView
                    conversations={conversations}
                    loading={loadingHistory}
                    activeId={conversationId}
                    onPick={loadConversation}
                    onDelete={deleteConversation}
                    onRename={renameConversation}
                  />
                ) : view === 'insights' ? (
                  <InsightsView
                    insights={insights}
                    loading={loadingInsights}
                    onAnalyze={analyzeInsight}
                    onRefresh={openInsights}
                  />
                ) : (
                  <>
                {messages.length === 0 && (
                  <div className="space-y-4 pt-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500">
                      <Bot className="h-6 w-6" />
                    </div>
                    <p className="text-sm text-black/60 dark:text-white/60">
                      Soy CIDE, la IA propia de Axos OS. Analizo inventario,
                      producción, MRP, calidad, finanzas y la bitácora de eventos
                      — respetando tus permisos.
                    </p>
                    <button
                      onClick={() => send(BRIEFING_PROMPT)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-violet-600 to-pink-500 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    >
                      <Newspaper className="h-4 w-4" />
                      Ponme al día
                    </button>
                    <div className="flex flex-col gap-2">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          onClick={() => send(s)}
                          className="rounded-xl border border-black/10 px-3 py-2 text-left text-sm transition-colors hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === 'user' ? 'flex justify-end' : 'flex justify-start'
                    }
                  >
                    <div
                      className={
                        m.role === 'user'
                          ? 'max-w-[85%] rounded-2xl rounded-br-md bg-indigo-600 px-4 py-2.5 text-sm text-white'
                          : 'max-w-[90%] rounded-2xl rounded-bl-md bg-black/5 px-4 py-2.5 text-sm dark:bg-white/10'
                      }
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {m.content}
                        {m.role === 'assistant' &&
                          !m.content &&
                          loading && (
                            <span className="inline-flex items-center gap-2 text-black/50 dark:text-white/50">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Analizando…
                            </span>
                          )}
                      </p>
                      {m.role === 'assistant' && m.cards && m.cards.length > 0 && (
                        <div className="mt-2.5 space-y-2">
                          {m.cards.map((c, ci) => (
                            <CardView key={ci} card={c} />
                          ))}
                        </div>
                      )}
                      {m.role === 'assistant' &&
                        m.tools &&
                        m.tools.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {m.tools.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-300"
                              >
                                <Wrench className="h-2.5 w-2.5" />
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      {m.role === 'assistant' && m.mock && (
                        <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                          modo demo · motor CIDE no disponible
                        </p>
                      )}
                      {m.role === 'assistant' && !m.mock && m.model && (
                        <p className="mt-1 flex items-center gap-1.5 text-[10px] text-black/40 dark:text-white/40">
                          {m.model}
                          {m.escalated && (
                            <span className="inline-flex items-center gap-0.5 text-violet-500 dark:text-violet-300">
                              <Zap className="h-2.5 w-2.5" />
                              escalado
                            </span>
                          )}
                        </p>
                      )}
                      {m.role === 'assistant' &&
                        m.content &&
                        !(loading && i === messages.length - 1) && (
                          <div className="mt-1.5 flex items-center gap-1">
                            <button
                              onClick={() => copyMsg(i, m.content)}
                              aria-label="Copiar respuesta"
                              title="Copiar"
                              className="rounded-md p-1 text-black/35 transition-colors hover:bg-black/5 hover:text-black/70 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white/70"
                            >
                              {copiedIdx === i ? (
                                <Check className="h-3 w-3 text-emerald-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                            {i === messages.length - 1 && (
                              <button
                                onClick={regenerate}
                                aria-label="Regenerar respuesta"
                                title="Regenerar"
                                className="rounded-md p-1 text-black/35 transition-colors hover:bg-black/5 hover:text-black/70 dark:text-white/35 dark:hover:bg-white/10 dark:hover:text-white/70"
                              >
                                <RefreshCw className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                ))}

                {loading &&
                  messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-2xl bg-black/5 px-4 py-3 text-sm dark:bg-white/10">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Analizando…
                      </div>
                    </div>
                  )}

                {error && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
                    {error}
                    {isAdmin && (
                      <Link
                        href="/dashboard/admin/ai"
                        onClick={() => setOpen(false)}
                        className="ml-1 underline"
                      >
                        Configurar CIDE
                      </Link>
                    )}
                  </div>
                )}
                  </>
                )}
              </div>

              {/* Composer */}
              {view === 'chat' && (
              <div className="border-t border-white/10 p-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send(input);
                  }}
                  className="flex items-end gap-2"
                >
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send(input);
                      }
                    }}
                    rows={1}
                    placeholder="Pregúntale a CIDE…"
                    className="max-h-32 flex-1 resize-none rounded-xl border border-black/10 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5"
                  />
                  {loading ? (
                    <button
                      type="button"
                      onClick={stop}
                      aria-label="Detener"
                      title="Detener generación"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/10 text-black/70 transition-colors hover:bg-black/20 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20"
                    >
                      <Square className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={!input.trim()}
                      aria-label="Enviar"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </form>
              </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Conversation history ────────────────────────────────────────────────────

function HistoryView({
  conversations,
  loading,
  activeId,
  onPick,
  onDelete,
  onRename,
}: {
  conversations: ConvSummary[];
  loading: boolean;
  activeId: string | null;
  onPick: (id: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  function beginEdit(id: string, title: string) {
    setEditingId(id);
    setDraft(title);
  }
  function commitEdit() {
    if (editingId && draft.trim()) onRename(editingId, draft);
    setEditingId(null);
  }
  if (loading && conversations.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 pt-10 text-sm text-black/50 dark:text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando historial…
      </div>
    );
  }
  if (conversations.length === 0) {
    return (
      <div className="space-y-3 pt-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500">
          <History className="h-6 w-6" />
        </div>
        <p className="text-sm text-black/60 dark:text-white/60">
          Aún no tienes conversaciones guardadas. Cuando converses con CIDE,
          aparecerán aquí para que puedas retomarlas.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Conversaciones
      </p>
      {conversations.map((c) => (
        <div
          key={c.id}
          className={`group flex items-center gap-2 rounded-xl border pr-2 transition-colors ${
            c.id === activeId
              ? 'border-violet-400/60 bg-violet-500/10'
              : 'border-black/10 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10'
          }`}
        >
          {editingId === c.id ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                else if (e.key === 'Escape') setEditingId(null);
              }}
              className="min-w-0 flex-1 rounded-lg border border-violet-400/60 bg-white/70 px-3 py-2 text-sm outline-none dark:bg-white/5"
            />
          ) : (
            <button
              onClick={() => onPick(c.id)}
              className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
            >
              <MessageSquare className="h-4 w-4 shrink-0 text-violet-500" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{c.title}</span>
                <span className="block text-[11px] text-black/45 dark:text-white/45">
                  {relativeTime(c.updatedAt)}
                </span>
              </span>
            </button>
          )}
          {editingId !== c.id && (
            <>
              <button
                onClick={() => beginEdit(c.id, c.title)}
                aria-label="Renombrar conversación"
                title="Renombrar"
                className="shrink-0 rounded-lg p-1.5 text-black/35 opacity-0 transition-all hover:bg-black/5 hover:text-black/70 focus:opacity-100 group-hover:opacity-100 dark:text-white/35 dark:hover:bg-white/10"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(c.id)}
                aria-label="Borrar conversación"
                title="Borrar conversación"
                className="shrink-0 rounded-lg p-1.5 text-black/35 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-500 focus:opacity-100 group-hover:opacity-100 dark:text-white/35"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Centinela (proactive insights) ─────────────────────────────────────────

const INSIGHT_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

function InsightsView({
  insights,
  loading,
  onAnalyze,
  onRefresh,
}: {
  insights: Insight[] | null;
  loading: boolean;
  onAnalyze: (question: string) => void;
  onRefresh: () => void;
}) {
  if (loading && !insights) {
    return (
      <div className="flex items-center justify-center gap-2 pt-10 text-sm text-black/50 dark:text-white/50">
        <Loader2 className="h-4 w-4 animate-spin" />
        Revisando la operación…
      </div>
    );
  }
  if (!insights || insights.length === 0) {
    return (
      <div className="space-y-3 pt-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <p className="text-sm text-black/60 dark:text-white/60">
          Todo en orden por ahora. No hay alertas que requieran tu atención
          según tus permisos.
        </p>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Revisar de nuevo
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
          Qué necesita tu atención
        </p>
        <button
          onClick={onRefresh}
          aria-label="Actualizar"
          className="rounded-md p-1 text-black/40 hover:bg-black/5 hover:text-black/70 dark:text-white/40 dark:hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      {insights.map((it, i) => (
        <div
          key={i}
          className="rounded-xl border border-black/10 px-3 py-2.5 dark:border-white/10"
        >
          <div className="flex items-start gap-2">
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${INSIGHT_DOT[it.severity] ?? 'bg-zinc-400'}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
                  {it.area}
                </span>
              </div>
              <p className="text-sm font-medium leading-snug">{it.title}</p>
              {it.detail && (
                <p className="mt-0.5 text-xs text-black/55 dark:text-white/55">
                  {it.detail}
                </p>
              )}
              <button
                onClick={() => onAnalyze(it.suggestedQuestion)}
                className="mt-1.5 text-xs font-medium text-violet-600 hover:underline dark:text-violet-300"
              >
                Analizar con CIDE →
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Inline analysis cards (lightweight; no chart lib in the global bundle) ──

function fmtNum(v: number, unit?: string | null): string {
  if (unit === 'USD')
    return v.toLocaleString('es-MX', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    });
  if (unit === '%') return `${v.toLocaleString('es-MX')}%`;
  return v.toLocaleString('es-MX');
}

/** Build an SVG polyline path for a series scaled into a [w,h] box. */
function pathFor(
  values: number[],
  w: number,
  h: number,
  pad = 2,
  min?: number,
  max?: number,
): string {
  if (values.length === 0) return '';
  const lo = min ?? Math.min(...values);
  const hi = max ?? Math.max(...values);
  const span = hi - lo || 1;
  const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (v - lo) / span);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function Sparkline({
  series,
  projection,
}: {
  series: { x: string; y: number }[];
  projection?: { x: string; y: number }[];
}) {
  const w = 240;
  const h = 56;
  const histVals = series.map((p) => p.y);
  const projVals = projection?.map((p) => p.y) ?? [];
  const all = [...histVals, ...projVals];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const histPath = pathFor(histVals, w, h, 3, lo, hi);
  // Projection shares the x-grid continuing after history (offset by hist length).
  const combinedForProj = projection
    ? [...histVals.slice(-1), ...projVals]
    : [];
  const projPath = projection
    ? pathFor(combinedForProj, w, h, 3, lo, hi)
    : '';
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-14 w-full"
    >
      <path d={histPath} fill="none" stroke="#7c5cff" strokeWidth={2} />
      {projPath && (
        <path
          d={projPath}
          fill="none"
          stroke="#ec4899"
          strokeWidth={2}
          strokeDasharray="4 3"
        />
      )}
    </svg>
  );
}

/** Confirmation card for a CIDE-proposed write action. */
function ActionProposalCard({
  card,
}: {
  card: Extract<CideCard, { type: 'action_proposal' }>;
}) {
  const [state, setState] = useState<
    'idle' | 'running' | 'done' | 'error' | 'dismissed'
  >('idle');
  const [msg, setMsg] = useState<string | null>(null);

  async function confirm() {
    setState('running');
    setMsg(null);
    try {
      const res = await fetch('/api/ai/actions/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionKey: card.actionKey, params: card.params }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        result?: { folio?: string | null };
        message?: string;
      };
      if (res.ok && data.ok) {
        setState('done');
        setMsg(
          data.result?.folio
            ? `Hecho · folio ${data.result.folio}`
            : 'Acción ejecutada.',
        );
      } else {
        setState('error');
        setMsg(data.error || data.message || 'No se pudo ejecutar.');
      }
    } catch {
      setState('error');
      setMsg('Error de red al ejecutar.');
    }
  }

  return (
    <div className="rounded-xl border border-violet-400/40 bg-violet-500/5 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-violet-600 dark:text-violet-300">
        <Zap className="h-3 w-3" /> Acción propuesta · requiere tu confirmación
      </div>
      <p className="mt-1 text-sm">{card.summary}</p>
      {state === 'done' ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <Check className="h-3.5 w-3.5" /> {msg}
        </p>
      ) : state === 'dismissed' ? (
        <p className="mt-2 text-xs text-black/45 dark:text-white/45">
          Acción descartada.
        </p>
      ) : state === 'error' ? (
        <div className="mt-2">
          <p className="text-xs text-amber-600 dark:text-amber-400">{msg}</p>
          <button
            onClick={confirm}
            className="mt-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white"
          >
            Reintentar
          </button>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-2">
          <button
            onClick={confirm}
            disabled={state === 'running'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {state === 'running' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Confirmar
          </button>
          <button
            onClick={() => setState('dismissed')}
            disabled={state === 'running'}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-black/55 hover:bg-black/5 disabled:opacity-50 dark:text-white/55 dark:hover:bg-white/10"
          >
            Descartar
          </button>
        </div>
      )}
    </div>
  );
}

function CardView({ card }: { card: CideCard }) {
  if (card.type === 'action_proposal') {
    return <ActionProposalCard card={card} />;
  }
  if (card.type === 'metric') {
    return (
      <div className="rounded-xl border border-black/10 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
        <p className="text-[11px] text-black/55 dark:text-white/55">
          {card.title}
        </p>
        <p className="text-xl font-semibold tracking-tight">
          {fmtNum(card.value, card.unit)}
        </p>
      </div>
    );
  }
  if (card.type === 'line') {
    const last = card.series[card.series.length - 1]?.y ?? 0;
    return (
      <div className="rounded-xl border border-black/10 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[11px] text-black/55 dark:text-white/55">
            {card.title}
          </p>
          <p className="text-[11px] font-medium text-black/70 dark:text-white/70">
            {fmtNum(last)}
          </p>
        </div>
        <Sparkline series={card.series} projection={card.projection} />
        {card.projection && (
          <p className="mt-1 text-[10px] text-pink-500">— — proyección</p>
        )}
      </div>
    );
  }
  if (card.type === 'actions') {
    return (
      <div className="rounded-xl border border-black/10 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
        <p className="mb-1.5 text-[11px] text-black/55 dark:text-white/55">
          {card.title}
        </p>
        <ul className="space-y-1">
          {card.items.map((it, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[it.severity] ?? 'bg-zinc-400'}`}
              />
              <span className="leading-snug">{it.title}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  // bars
  const max = Math.max(...card.bars.map((b) => b.value), 1);
  return (
    <div className="rounded-xl border border-black/10 bg-white/60 px-3 py-2 dark:border-white/10 dark:bg-white/5">
      <p className="mb-1.5 text-[11px] text-black/55 dark:text-white/55">
        {card.title}
      </p>
      <div className="space-y-1">
        {card.bars.map((b) => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-[10px] text-black/60 dark:text-white/60">
              {b.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                style={{ width: `${(b.value / max) * 100}%` }}
              />
            </div>
            <span className="w-8 shrink-0 text-right text-[10px] font-medium">
              {b.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
