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
} from 'lucide-react';
import { glass } from '@/lib/glass';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  tools?: string[];
  model?: string;
  mock?: boolean;
}

const SUGGESTIONS = [
  '¿Cómo va la planta hoy?',
  '¿Qué órdenes de producción están abiertas?',
  '¿Cómo está el inventario?',
  'Muéstrame el estado de resultados',
];

export function AiCopilot() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => setIsAdmin(d?.session?.role === 'admin'))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, loading]);

  if (!pathname?.startsWith('/dashboard')) return null;

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || loading) return;
    setError(null);
    setMessages((m) => [...m, { role: 'user', content: msg }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, conversationId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || 'No se pudo contactar al asistente.');
        return;
      }
      setConversationId(data.conversationId ?? null);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: data.reply ?? '—',
          tools: data.toolsUsed,
          model: data.model,
          mock: data.mock,
        },
      ]);
    } catch {
      setError('Error de red al contactar al asistente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir Axos Copilot"
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
                    <h2 className="text-sm font-semibold leading-tight">
                      Axos Copilot
                    </h2>
                    <p className="text-xs text-black/50 dark:text-white/50">
                      Pregúntame sobre tus datos
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {isAdmin && (
                    <Link
                      href="/dashboard/admin/ai"
                      onClick={() => setOpen(false)}
                      aria-label="Configurar IA"
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
                {messages.length === 0 && (
                  <div className="space-y-4 pt-6 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500">
                      <Bot className="h-6 w-6" />
                    </div>
                    <p className="text-sm text-black/60 dark:text-white/60">
                      Soy tu copiloto. Consulto inventario, producción, MRP,
                      calidad y finanzas — respetando tus permisos.
                    </p>
                    <div className="flex flex-col gap-2">
                      {SUGGESTIONS.map((s) => (
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
                      </p>
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
                          modo demo · sin API key
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl bg-black/5 px-4 py-3 text-sm dark:bg-white/10">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Pensando…
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
                        Configurar IA
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Composer */}
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
                    placeholder="Escribe tu pregunta…"
                    className="max-h-32 flex-1 resize-none rounded-xl border border-black/10 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-white/10 dark:bg-white/5"
                  />
                  <button
                    type="submit"
                    disabled={loading || !input.trim()}
                    aria-label="Enviar"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
