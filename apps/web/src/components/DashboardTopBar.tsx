'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bell, User, ShieldAlert, LogOut, Building2, Search, Pencil, Check, X,
} from 'lucide-react';
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher';
import { glass } from '@/lib/glass';
import { positionLabel } from '@/config/positions';
import { IconTile } from '@/components/ui/IconTile';
import { DOMAINS, type DomainKey } from '@/lib/design/domains';
import { chatApi, type ChatConversation } from '@/lib/chatApi';
import { isAdminAccess } from '@/lib/owner';
import { timeAgo, ROLE_LABELS } from '@/lib/dashboardShared';

interface SessionInfo {
  kind: 'user' | 'demo';
  name: string;
  email: string | null;
  role: string;
  position?: string | null;
  userId: string | null;
}
interface AdminNotification { id: string; type: string; title: string; body: string; read: boolean; createdAt: string }
interface UnifiedNotif { id: string; domain: DomainKey; title: string; meta: string; at: string; read: boolean; href?: string }

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/** Unifica notificaciones de admin + no leídos del chat (datos reales). */
function buildNotifications(chatConvos: ChatConversation[], admin: AdminNotification[]): UnifiedNotif[] {
  const items: UnifiedNotif[] = [];
  for (const c of chatConvos) {
    if ((c.unread || 0) > 0) {
      items.push({
        id: `chat-${c.id}`,
        domain: 'messaging',
        title: `${c.unread} sin leer · ${c.title || 'Conversación'}`,
        meta: `${DOMAINS.messaging.label} · ${timeAgo(c.lastMessageAt)}`,
        at: c.lastMessageAt || new Date().toISOString(),
        read: false,
        href: '/dashboard/chat',
      });
    }
  }
  for (const n of admin) {
    items.push({
      id: `admin-${n.id}`,
      domain: 'people',
      title: n.title,
      meta: `${DOMAINS.people.label} · ${timeAgo(n.createdAt)}`,
      at: n.createdAt,
      read: n.read,
      href: n.type?.startsWith('user.') ? '/dashboard/admin/approvals' : undefined,
    });
  }
  return items.sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

function NotifGroup({ label, items, onGo }: { label: string; items: UnifiedNotif[]; onGo: (n: UnifiedNotif) => void }) {
  return (
    <div>
      <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
      <div className="space-y-1">
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => onGo(n)}
            disabled={!n.href}
            className="w-full flex items-start gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10 disabled:cursor-default disabled:hover:bg-transparent"
          >
            <IconTile domain={n.domain} size={34} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{n.title}</p>
              <p className="text-[10px] text-gray-500">{n.meta}</p>
            </div>
            {!n.read && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-violet-500" />}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Barra superior compartida del dashboard (logo, WorkspaceSwitcher, buscador
 * Spotlight, centro de notificaciones y menú de avatar). Vive en el layout para
 * que toda página /dashboard/* la herede. Datos reales (admin + chat).
 */
export function DashboardTopBar() {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [chatConvos, setChatConvos] = useState<ChatConversation[]>([]);

  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((d) => setSession(d.session)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const isAdminRole = isAdminAccess(session.role, session.email);
    async function load() {
      try {
        const convos = await chatApi.listConversations();
        if (active) setChatConvos(Array.isArray(convos) ? convos : []);
      } catch { /* sin sesión de chat todavía */ }
      if (isAdminRole) {
        const [n, p] = await Promise.all([
          fetch('/api/admin/notifications', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
          fetch('/api/admin/pending', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
        ]);
        if (!active) return;
        setNotifications(n.notifications || []);
        setPendingCount(p.users?.length || 0);
      }
    }
    load();
    const t = setInterval(load, 20000);
    return () => { active = false; clearInterval(t); };
  }, [session]);

  const isAdmin = isAdminAccess(session?.role, session?.email);
  const adminUnread = notifications.filter((n) => !n.read).length;
  const messagingUnread = chatConvos.reduce((s, c) => s + (c.unread || 0), 0);
  const badgeTotal = adminUnread + messagingUnread;
  const notifItems = buildNotifications(chatConvos, notifications);
  const todayItems = notifItems.filter((n) => isToday(n.at));
  const earlierItems = notifItems.filter((n) => !isToday(n.at));
  const initials = (session?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = positionLabel(session?.position) || ROLE_LABELS[session?.role || ''] || session?.role || '—';

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  function openNotifs() {
    setNotifOpen((o) => !o);
  }
  function goNotif(n: UnifiedNotif) {
    setNotifOpen(false);
    if (n.href) router.push(n.href);
  }
  async function markAllRead() {
    if (isAdmin && adminUnread > 0) {
      await fetch('/api/admin/notifications', { method: 'POST' }).catch(() => {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
    const unreadConvos = chatConvos.filter((c) => (c.unread || 0) > 0);
    if (unreadConvos.length) {
      await Promise.all(unreadConvos.map((c) => chatApi.markRead(c.id).catch(() => {})));
      setChatConvos((prev) => prev.map((c) => ({ ...c, unread: 0 })));
    }
  }
  async function saveName() {
    const name = nameDraft.trim();
    if (!name) return;
    setSavingName(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setSession((s) => (s ? { ...s, name } : s));
        setEditingName(false);
      }
    } finally {
      setSavingName(false);
    }
  }

  return (
    <nav className={`${glass} fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center gap-4 rounded-none border-x-0 border-t-0`}>
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="font-bold text-lg tracking-tight">Axos OS</Link>
        <WorkspaceSwitcher />
      </div>

      {/* Buscador "Spotlight" — abre la paleta de comandos (Ctrl/⌘+K) */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent('axos:open-search'))}
        aria-label="Buscar"
        className="hidden sm:flex items-center gap-2 rounded-full px-3.5 py-2 text-sm text-gray-500 dark:text-gray-400 w-full max-w-md bg-violet-500/[0.06] dark:bg-violet-400/10 border border-violet-500/15 dark:border-violet-400/15 hover:border-violet-500/30 hover:text-gray-700 dark:hover:text-gray-200 hover:shadow-[0_0_0_4px_rgba(124,92,255,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 transition-all"
      >
        <Search className="w-4 h-4 flex-shrink-0 text-violet-500" strokeWidth={1.75} />
        <span className="flex-1 text-left">Buscar departamento, WO, NCR, persona…</span>
        <kbd className="hidden md:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/10 dark:bg-violet-400/15 text-violet-500/80">⌘K</kbd>
      </button>

      <div className="flex items-center gap-3 relative">
        <div className="relative">
          <button onClick={openNotifs} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors relative" aria-label="Notificaciones">
            <Bell className="w-5 h-5" />
            {badgeTotal > 0 && (
              <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white dark:border-black text-[9px] font-bold text-white flex items-center justify-center">{badgeTotal > 99 ? '99+' : badgeTotal}</span>
            )}
          </button>
          <AnimatePresence>
            {notifOpen && (
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className={`${glass} absolute right-0 mt-4 w-96 rounded-[2rem] shadow-2xl p-4 z-[100]`}>
                <div className="flex justify-between items-center mb-3 px-2">
                  <h3 className="font-bold">Notificaciones</h3>
                  {badgeTotal > 0 && (
                    <button onClick={markAllRead} className="text-xs font-semibold text-violet-500 hover:underline">Marcar leídas</button>
                  )}
                </div>
                {notifItems.length === 0 ? (
                  <p className="text-xs text-gray-400 px-2 py-8 text-center">Estás al día. Sin notificaciones.</p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {todayItems.length > 0 && <NotifGroup label="Hoy" items={todayItems} onGo={goNotif} />}
                    {earlierItems.length > 0 && <NotifGroup label="Antes" items={earlierItems} onGo={goNotif} />}
                  </div>
                )}
                {isAdmin && pendingCount > 0 && (
                  <Link href="/dashboard/admin/approvals" onClick={() => setNotifOpen(false)} className="mt-3 block text-center text-xs font-semibold text-rose-500 hover:underline">Revisar {pendingCount} pendientes</Link>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="w-10 h-10 bg-black dark:bg-white rounded-full flex items-center justify-center text-white dark:text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all" aria-label="Cuenta">{initials}</button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className={`${glass} absolute right-0 mt-4 w-72 rounded-[2rem] shadow-2xl p-4 z-[100]`}>
                <div className="px-4 py-4 border-b border-gray-100 dark:border-white/5 mb-2 flex items-center gap-3">
                  <div className="w-12 h-12 bg-black dark:bg-white rounded-full flex items-center justify-center text-white dark:text-black font-bold">{initials}</div>
                  <div className="min-w-0 flex-1">
                    {editingName ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          autoFocus
                          value={nameDraft}
                          onChange={(e) => setNameDraft(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                          placeholder="Tu nombre"
                          className="min-w-0 flex-1 bg-gray-100 dark:bg-white/10 rounded-lg px-2 py-1 text-sm outline-none"
                        />
                        <button onClick={saveName} disabled={savingName} className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-50" aria-label="Guardar"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingName(false)} className="p-1 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10" aria-label="Cancelar"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm truncate">{session?.name ?? 'Visitor'}</p>
                        <button onClick={() => { setNameDraft(session?.name ?? ''); setEditingName(true); }} className="p-1 rounded-md text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 flex-shrink-0" aria-label="Editar nombre"><Pencil className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-500 truncate">{session?.email ?? '—'}</p>
                    <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">{roleLabel}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  {isAdmin && <Link href="/dashboard/admin/approvals" onClick={() => setMenuOpen(false)} className="w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-xs flex items-center gap-3"><ShieldAlert className="w-4 h-4" /> Aprobaciones{pendingCount > 0 && <span className="ml-auto px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold">{pendingCount}</span>}</Link>}
                  {isAdmin && <Link href="/dashboard/settings/users" onClick={() => setMenuOpen(false)} className="w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-xs flex items-center gap-3"><User className="w-4 h-4" /> Usuarios y accesos</Link>}
                  {isAdmin && <Link href="/dashboard/settings/organization" onClick={() => setMenuOpen(false)} className="w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-xs flex items-center gap-3"><Building2 className="w-4 h-4" /> Organización</Link>}
                  <button onClick={handleLogout} className="w-full px-4 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 rounded-xl text-xs flex items-center gap-3"><LogOut className="w-4 h-4" /> Cerrar sesión</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}
