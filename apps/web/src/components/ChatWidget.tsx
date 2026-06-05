'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare } from 'lucide-react';

/**
 * Botón flotante que lleva al chat interno real (/dashboard/chat).
 * Antes mostraba un panel con mensajes hardcodeados; ahora enlaza al chat
 * conectado al backend. Se oculta cuando ya estás dentro del chat.
 */
export function ChatWidget() {
  const pathname = usePathname();

  // No mostrar el botón dentro del propio chat ni fuera del dashboard.
  if (!pathname?.startsWith('/dashboard') || pathname?.startsWith('/dashboard/chat')) {
    return null;
  }

  return (
    <Link
      href="/dashboard/chat"
      aria-label="Abrir chat interno"
      className="fixed bottom-8 right-8 z-[100] flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xl transition-all hover:scale-105 hover:bg-blue-700 active:scale-95"
    >
      <MessageSquare className="h-6 w-6" />
    </Link>
  );
}
