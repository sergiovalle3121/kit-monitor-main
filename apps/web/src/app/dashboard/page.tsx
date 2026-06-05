"use client";

import React, { Suspense, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Settings,
  User,
  Search,
  Eye,
  ShieldAlert,
  AlertCircle,
  Lock,
  LayoutGrid,
} from "lucide-react";
import Link from "next/link";
import { TCodePalette } from "@/components/TCodePalette";
import { DomainGrid } from "@/components/DomainGrid";
import { useVisibleDomains } from "@/hooks/useVisibleDomains";
import { Role } from "@/config/domains";

interface SessionInfo {
  kind: "user" | "demo";
  name: string;
  email: string | null;
  role: string;
  userId: string | null;
}

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  userId: string;
  read: boolean;
  createdAt: string;
}

function DashboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const blocked = params.get("blocked");

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setSession(d.session));
  }, []);

  useEffect(() => {
    if (session?.role !== "admin") return;
    let active = true;
    async function load() {
      const [n, p] = await Promise.all([
        fetch("/api/admin/notifications", { cache: "no-store" }).then((r) =>
          r.json(),
        ),
        fetch("/api/admin/pending", { cache: "no-store" }).then((r) =>
          r.json(),
        ),
      ]);
      if (!active) return;
      setNotifications(n.notifications || []);
      setPendingCount(p.users?.length || 0);
    }
    load();
    const t = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [session]);

  const isAdmin = session?.role === "admin";
  const isDemo = session?.kind === "demo";
  const unread = notifications.filter((n) => !n.read).length;

  // Filtrar dominios por rol
  const visibleDomains = useVisibleDomains((session?.role as Role) || 'admin');

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function handleOpenNotifications() {
    setIsNotificationsOpen((open) => !open);
    if (!isNotificationsOpen && isAdmin) {
      await fetch("/api/admin/notifications", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  const initials = (session?.name || "??")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-black text-black dark:text-white font-sans overflow-hidden">
      {/* T-Code Palette - Command Center */}
      <TCodePalette />

      {/* Top Bar */}
      <nav className="fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center backdrop-blur-md bg-white/70 dark:bg-black/70 border-b border-gray-200/50 dark:border-white/5">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg tracking-tight">Axos OS</span>
          {isDemo && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 flex items-center gap-1">
              <Eye className="w-3 h-3" /> Demo · Solo lectura
            </span>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-gray-200/50 dark:bg-white/10 rounded-full focus-within:ring-2 ring-blue-500/20 transition-all cursor-pointer hover:bg-gray-300/50 dark:hover:bg-white/20" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', {'key': 'F1'}))}>
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search apps, T-Codes or data... (F1)"
              className="bg-transparent border-none outline-none text-sm w-48 placeholder:text-gray-500"
              readOnly
            />
          </div>

          <div className="flex items-center gap-3 relative">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={handleOpenNotifications}
                className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {(unread > 0 || pendingCount > 0) && (
                  <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white dark:border-black text-[9px] font-bold text-white flex items-center justify-center">
                    {Math.max(unread, pendingCount)}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-96 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-2xl p-6 z-[100] backdrop-blur-xl"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold">Notificaciones</h3>
                      {isAdmin && pendingCount > 0 && (
                        <Link
                          href="/dashboard/admin/approvals"
                          onClick={() => setIsNotificationsOpen(false)}
                          className="text-xs font-bold text-rose-500 hover:underline"
                        >
                          Revisar {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
                        </Link>
                      )}
                    </div>

                    {!isAdmin && (
                      <div className="space-y-4">
                        <div className="flex gap-3 items-start">
                          <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-bold">Stock Crítico</p>
                            <p className="text-[10px] text-gray-500">SKU-2055 por debajo del mínimo.</p>
                          </div>
                        </div>
                        <div className="flex gap-3 items-start">
                          <div className="w-2 h-2 bg-amber-500 rounded-full mt-1.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-bold">Línea A1 - OEE 85%</p>
                            <p className="text-[10px] text-gray-500">Rendimiento por debajo del objetivo.</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {isAdmin && (
                      <div className="space-y-3 max-h-72 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="text-xs text-gray-400">Sin notificaciones.</p>
                        ) : (
                          notifications.slice(0, 8).map((n) => (
                            <div key={n.id} className="flex gap-3 items-start">
                              <div
                                className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                                  n.type === "user.pending"
                                    ? "bg-rose-500"
                                    : n.type === "user.approved"
                                    ? "bg-green-500"
                                    : "bg-gray-400"
                                }`}
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-bold truncate">{n.title}</p>
                                <p className="text-[10px] text-gray-500">{n.body}</p>
                                <p className="text-[9px] text-gray-400 mt-0.5">
                                  {new Date(n.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-10 h-10 bg-black dark:bg-white rounded-full flex items-center justify-center text-white dark:text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all"
              >
                {initials}
              </button>

              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-64 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-2xl p-4 z-[100] backdrop-blur-xl"
                  >
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-white/5 mb-2 text-center">
                      <p className="font-bold text-sm">{session?.name ?? "Visitor"}</p>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                        {session?.role ?? "guest"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      {isAdmin && (
                        <Link
                          href="/dashboard/admin/approvals"
                          onClick={() => setIsUserMenuOpen(false)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-xs transition-colors flex items-center gap-3"
                        >
                          <ShieldAlert className="w-4 h-4" /> Approvals
                          {pendingCount > 0 && (
                            <span className="ml-auto px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold">
                              {pendingCount}
                            </span>
                          )}
                        </Link>
                      )}
                      <Link href="/dashboard/settings/users" className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-xs transition-colors flex items-center gap-3">
                        <User className="w-4 h-4" /> Account Settings
                      </Link>
                      <Link href="/dashboard/settings/users" className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl text-xs transition-colors flex items-center gap-3">
                        <Settings className="w-4 h-4" /> System Preferences
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 rounded-xl text-xs transition-colors flex items-center gap-3"
                      >
                        <Lock className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-32 px-6 md:px-12 lg:px-24 max-w-7xl mx-auto">
        {blocked && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-amber-800 dark:text-amber-200 flex gap-3 items-start"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold">Acceso restringido</p>
              <p className="text-xs">
                {blocked === "demo"
                  ? "La sesión demo no permite entrar a esa sección. Inicia sesión con una cuenta autorizada."
                  : "Necesitas rol de Administrador para esa sección."}
              </p>
            </div>
          </motion.div>
        )}

        <header className="mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h2 className="text-gray-500 dark:text-gray-400 font-medium text-lg mb-2">
              {new Date().toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </h2>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
              Hola, {session?.name?.split(' ')[0] || 'Usuario'}.
            </h1>
            <p className="text-xl text-gray-500 dark:text-gray-400 mt-2">
              Bienvenido a Axos OS.
            </p>
          </motion.div>
        </header>

        {/* Domain Grid - Agrupado por capas SCOR */}
        <DomainGrid domains={visibleDomains} />
      </main>

      {/* Floating Dock */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 backdrop-blur-2xl bg-white/30 dark:bg-black/30 border border-white/20 dark:border-white/10 rounded-[2.5rem] shadow-2xl flex items-center gap-8">
        <button className="p-3 hover:scale-110 active:scale-95 transition-all text-gray-600 dark:text-gray-300">
          <Settings className="w-6 h-6" />
        </button>
        <button className="p-3 bg-black dark:bg-white text-white dark:text-black rounded-full hover:scale-110 active:scale-95 transition-all">
          <LayoutGrid className="w-6 h-6" />
        </button>
        <Link href="/dashboard/settings/users" className="p-3 hover:scale-110 active:scale-95 transition-all text-gray-600 dark:text-gray-300">
          <User className="w-6 h-6" />
        </Link>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F2F2F7] dark:bg-black" />}>
      <DashboardInner />
    </Suspense>
  );
}
