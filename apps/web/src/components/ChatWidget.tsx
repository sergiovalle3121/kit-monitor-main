'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, ChevronDown } from 'lucide-react';
import { glass } from '@/lib/glass';
import { DOMAINS, ICON_STROKE } from '@/lib/design/domains';
import { chatApi } from '@/lib/chatApi';
import { ChatExperience } from '@/components/chat/ChatExperience';

/**
 * Botón flotante (círculo inferior derecho) que ABRE/CIERRA la mensajería como
 * un dock estilo Teams/WhatsApp: se despliega un panel sobre lo que estés
 * haciendo y puedes cerrarlo para seguir. Reutiliza `ChatExperience` (la misma
 * lógica/visual del chat a pantalla completa) en su variante compacta.
 *
 * Se oculta dentro del propio chat a pantalla completa y del editor de Office.
 */
export function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const hidden =
    !pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/dashboard/chat') ||
    pathname?.startsWith('/dashboard/office/');

  // Cierra el dock si navegamos a una ruta donde no aplica.
  useEffect(() => {
    if (hidden && open) setOpen(false);
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

  return (
    <>
      {/* Panel (dock) */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className={`${glass} fixed bottom-44 right-6 z-[110] flex h-[min(70vh,620px)] w-[min(94vw,390px)] flex-col overflow-hidden rounded-[24px] shadow-2xl`}
            role="dialog"
            aria-label="Mensajería"
          >
            <ChatExperience variant="dock" onClose={() => setOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón flotante (abre/cierra) */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Cerrar mensajería' : 'Abrir mensajería'}
        aria-expanded={open}
        className="fixed bottom-28 right-8 z-[111] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
        style={{
          background: `linear-gradient(135deg, ${DOMAINS.messaging.from}, ${DOMAINS.messaging.to})`,
        }}
      >
        {open ? (
          <ChevronDown className="h-6 w-6" strokeWidth={ICON_STROKE} />
        ) : (
          <MessageSquare className="h-6 w-6" strokeWidth={ICON_STROKE} />
        )}
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white dark:ring-gray-900">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </>
  );
}
