'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { DOMAINS, ICON_STROKE } from '@/lib/design/domains';

/**
 * Botón flotante que lleva al chat interno real (/dashboard/chat).
 * Antes mostraba un panel con mensajes hardcodeados; ahora enlaza al chat
 * conectado al backend. Se oculta cuando ya estás dentro del chat.
 */
export function ChatWidget() {
  const pathname = usePathname();

  // No mostrar el botón dentro del propio chat ni fuera del dashboard, ni encima del
  // editor de Office a pantalla completa (`/dashboard/office/<id>`): ahí taparía la
  // hoja y sus controles. La lista de Office (`/dashboard/office`) sí lo conserva.
  if (
    !pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/dashboard/chat') ||
    pathname?.startsWith('/dashboard/office/')
  ) {
    return null;
  }

  return (
    <Link
      href="/dashboard/chat"
      aria-label="Abrir chat interno"
      className="fixed bottom-28 right-8 z-[100] flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
      style={{ background: `linear-gradient(135deg, ${DOMAINS.messaging.from}, ${DOMAINS.messaging.to})` }}
    >
      <MessageSquare className="h-6 w-6" strokeWidth={ICON_STROKE} />
    </Link>
  );
}
