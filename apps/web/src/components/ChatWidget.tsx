'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X } from 'lucide-react';
import { useRouteChrome } from '@/lib/routeChrome';
import { DOMAINS, ICON_STROKE } from '@/lib/design/domains';
import { chatApi } from '@/lib/chatApi';
import { ChatExperience } from '@/components/chat/ChatExperience';

/**
 * Botón flotante (círculo inferior derecho) que ABRE/CIERRA la mensajería como
 * un dock estilo Teams/WhatsApp: se despliega un panel sobre lo que estés
 * haciendo y puedes cerrarlo para seguir. Reutiliza `ChatExperience` (la misma
 * lógica/visual del chat a pantalla completa) en su variante compacta.
 *
 * Se oculta donde estorbaría (kiosko, chat a pantalla completa y cualquier
 * workbench: Office, CAD…) según la Shell Taxonomy (`useRouteChrome`).
 */
export function ChatWidget() {
  const { hideFloatingWidgets: hidden } = useRouteChrome();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Cierra el dock al entrar a rutas donde no aplica; se difiere para no
  // disparar el lint de React Compiler sobre setState síncrono en effects.
  useEffect(() => {
    if (!hidden || !open) return;
    queueMicrotask(() => setOpen(false));
  }, [hidden, open]);

  // Sondeo ligero de no leídos para el badge (solo visible y cerrado).
  useEffect(() => {
    if (hidden || open) return;
    let alive = true;
    const load = async () => {
      try {
        const cs = await chatApi.listConversations();
        if (alive) setUnread(cs.reduce((s, c) => s + (c.unread || 0), 0));
      } catch {
        /* sin sesión todavía */
      }
    };
    load();
    const id = setInterval(load, 45000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [hidden, open]);

  // Cerrar con Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (hidden) return null;

  const attention = !open && unread > 0;

  return (
    <>
      {/* Panel a PANTALLA COMPLETA (no cuadro central) — misma experiencia que
          /dashboard/chat. Se abre/cierra desde el mismo botón flotante. */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[120] bg-background"
            role="dialog"
            aria-label="Mensajería"
          >
            <ChatExperience variant="page" onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante (toggle). z por ENCIMA del panel para cerrar desde aquí.
          Cambia de tono cuando hay mensajes sin leer. */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Cerrar mensajería' : 'Abrir mensajería'}
        aria-expanded={open}
        className={`fixed bottom-28 right-8 z-[130] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl ring-1 ring-white/20 transition-all hover:scale-105 active:scale-95 ${attention ? 'animate-pulse' : ''}`}
        style={{
          background: attention
            ? 'linear-gradient(135deg, #fb7185, #e11d48)'
            : `linear-gradient(135deg, ${DOMAINS.messaging.from}, ${DOMAINS.messaging.to})`,
        }}
      >
        {open ? (
          <X className="h-6 w-6" strokeWidth={ICON_STROKE} />
        ) : (
          <MessageSquare className="h-6 w-6" strokeWidth={ICON_STROKE} />
        )}
        {attention && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </>
  );
}
