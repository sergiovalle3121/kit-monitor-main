"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bell, User, ShieldAlert, AlertCircle, LogOut, Megaphone,
  HandHelping, PackageCheck, Warehouse, LineChart, Building2, Settings, Boxes,
  Factory, ShieldCheck, Cpu, DollarSign, RadioTower, FileText, Search, Pencil, Check, X,
} from "lucide-react";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { glass } from "@/lib/glass";
import { containerRM, itemRM, hoverRM, pressRM } from "@/lib/motion";
import { useApi } from "@/hooks/useApi";
import { positionLabel } from "@/config/positions";
import { IconTile } from "@/components/ui/IconTile";
import { HoverArrow } from "@/components/ui/HoverArrow";
import { DOMAINS, type DomainKey } from "@/lib/design/domains";
import { chatApi, type ChatConversation } from "@/lib/chatApi";

const MotionLink = motion.create(Link);

interface SessionInfo {
  kind: "user" | "demo";
  name: string; email: string | null; role: string; position?: string | null; userId: string | null;
}
interface AdminNotification { id: string; type: string; title: string; body: string; read: boolean; createdAt: string }
interface UnifiedNotif { id: string; domain: DomainKey; title: string; meta: string; at: string; read: boolean; href?: string }
interface PlanRow { id: number; model: string; workOrder: string; status: string; publishedBy?: string | null; publishedAt?: string | null }
interface RequestRow { id: number; model?: string | null; status: string; requestedBy?: string; createdAt?: string }

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador", executive: "Dirección", plant_manager: "Gerencia de planta",
  planner: "Planeación", buyer: "Compras",
  production_supervisor: "Producción", operator: "Operador de línea",
  quality_engineer: "Calidad", mrb_member: "MRB / Calidad", engineering: "Ingeniería",
  industrial_engineer: "Ing. Industrial", materialist: "Materialista",
  cycle_count_analyst: "Conteos cíclicos", maintenance_tech: "Mantenimiento",
  warehouse_operator: "Almacén / Inventario", finance: "Finanzas", hr: "Personas",
};

// The working areas of the app. Each user sees only the ones for their role
// (admin/executive see all). One uniform grid → predictable, symmetric, calm.
const AREAS: { name: string; desc: string; href: string; icon: LucideIcon; domain: DomainKey; roles: string[] }[] = [
  { name: "Planeación", desc: "Publicar planes", href: "/dashboard/planning", icon: LineChart, domain: "planning", roles: ["planner"] },
  { name: "Muro del plan", desc: "Publicar WOs en vivo", href: "/dashboard/production-plan", icon: Megaphone, domain: "plan", roles: ["planner", "production_supervisor", "operator", "materialist"] },
  { name: "Almacén", desc: "Surtir y autorizar", href: "/dashboard/almacen", icon: Warehouse, domain: "warehouse", roles: ["warehouse_operator", "materialist"] },
  { name: "Surtido a línea", desc: "Kitting y e-kanban", href: "/dashboard/material-staging", icon: Icons.PackagePlus, domain: "staging", roles: ["materialist", "warehouse_operator", "production_supervisor"] },
  { name: "Inventario", desc: "Existencias y kitting", href: "/dashboard/inventory", icon: Boxes, domain: "inventory", roles: ["warehouse_operator", "materialist", "cycle_count_analyst", "planner"] },
  { name: "Producción", desc: "Órdenes y piso", href: "/dashboard/production", icon: Factory, domain: "production", roles: ["production_supervisor", "operator", "warehouse_operator"] },
  { name: "Operador MES", desc: "Ejecución en estación", href: "/dashboard/operador", icon: Icons.HardHat, domain: "production", roles: ["production_supervisor", "operator"] },
  { name: "Terminal de operador", desc: "Poka-yoke, backflush, andon", href: "/dashboard/operator-terminal", icon: Icons.ScanLine, domain: "production", roles: ["operator", "production_supervisor"] },
  { name: "Calidad", desc: "Inspección y NCR", href: "/dashboard/quality", icon: ShieldCheck, domain: "quality", roles: ["quality_engineer", "mrb_member"] },
  { name: "Calidad de piso · MRB", desc: "Holds y disposición", href: "/dashboard/floor-quality", icon: Icons.ShieldX, domain: "quality", roles: ["quality_engineer", "mrb_member", "production_supervisor"] },
  { name: "Ingeniería", desc: "BOM y proceso", href: "/dashboard/engineering", icon: Cpu, domain: "engineering", roles: ["engineering", "industrial_engineer", "quality_engineer", "production_supervisor"] },
  { name: "Finanzas", desc: "Costos y P&L", href: "/dashboard/finance", icon: DollarSign, domain: "finance", roles: ["finance"] },
  { name: "Mission Control", desc: "Vista ejecutiva", href: "/dashboard/mission-control", icon: RadioTower, domain: "mes", roles: ["planner", "production_supervisor", "finance"] },
  { name: "Torre de control de línea", desc: "Readiness y semáforo por línea", href: "/dashboard/line-control-tower", icon: RadioTower, domain: "mes", roles: ["production_supervisor", "planner", "plant_manager"] },
  { name: "Costos y métricas", desc: "Dinero y eficiencia", href: "/dashboard/metrics", icon: Icons.Activity, domain: "finance", roles: ["finance", "planner", "production_supervisor"] },
  { name: "Axos ERP", desc: "FIN · MM · PP · SD · T-Codes", href: "/dashboard/erp", icon: Icons.Landmark, domain: "erp", roles: ["finance", "planner", "production_supervisor", "buyer"] },
  { name: "Pruebas / Lab", desc: "Inspección y validación", href: "/dashboard/lab", icon: Icons.FlaskConical, domain: "quality", roles: ["quality_engineer", "engineering"] },
  { name: "Ing. Industrial", desc: "Proceso, capacidad y mejora", href: "/dashboard/industrial-engineering", icon: Icons.Gauge, domain: "engineering", roles: ["engineering", "industrial_engineer", "production_supervisor"] },
  { name: "Disposición de líneas", desc: "Layout, ruteo y balanceo", href: "/dashboard/line-engineering", icon: Icons.Gauge, domain: "engineering", roles: ["industrial_engineer", "engineering", "production_supervisor"] },
  { name: "Personas (RH)", desc: "Plantilla y accesos", href: "/dashboard/rh", icon: Icons.Users, domain: "people", roles: ["hr"] },
  { name: "Office", desc: "Docs · Hojas · Slides", href: "/dashboard/office", icon: FileText, domain: "office", roles: ["engineering", "planner", "quality_engineer", "production_supervisor", "warehouse_operator", "finance", "buyer", "hr"] },
];

function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

/**
 * Unifica notificaciones de admin + no leídos del chat en una sola lista, con el
 * dominio (color/ícono) de cada una. Datos reales — sin nada hardcodeado.
 */
function buildNotifications(chatConvos: ChatConversation[], admin: AdminNotification[]): UnifiedNotif[] {
  const items: UnifiedNotif[] = [];
  for (const c of chatConvos) {
    if ((c.unread || 0) > 0) {
      items.push({
        id: `chat-${c.id}`,
        domain: "messaging",
        title: `${c.unread} sin leer · ${c.title || "Conversación"}`,
        meta: `${DOMAINS.messaging.label} · ${timeAgo(c.lastMessageAt)}`,
        at: c.lastMessageAt || new Date().toISOString(),
        read: false,
        href: "/dashboard/chat",
      });
    }
  }
  for (const n of admin) {
    items.push({
      id: `admin-${n.id}`,
      domain: "people",
      title: n.title,
      meta: `${DOMAINS.people.label} · ${timeAgo(n.createdAt)}`,
      at: n.createdAt,
      read: n.read,
      href: n.type?.startsWith("user.") ? "/dashboard/admin/approvals" : undefined,
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

function DashboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const blocked = params.get("blocked");
  const reduce = useReducedMotion();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [chatConvos, setChatConvos] = useState<ChatConversation[]>([]);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setSession(d.session));
  }, []);

  // Carga unificada: el chat es para TODOS; las notificaciones de admin solo si
  // el rol es admin. Polling cada 20 s (mismo patrón existente).
  useEffect(() => {
    if (!session) return;
    let active = true;
    const isAdminRole = session.role === "admin";
    async function load() {
      try {
        const convos = await chatApi.listConversations();
        if (active) setChatConvos(Array.isArray(convos) ? convos : []);
      } catch { /* sin sesión de chat todavía */ }
      if (isAdminRole) {
        const [n, p] = await Promise.all([
          fetch("/api/admin/notifications", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
          fetch("/api/admin/pending", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
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

  const { data: plansData } = useApi<PlanRow[]>("/plans");
  const { data: reqData } = useApi<RequestRow[]>("/material-requests");
  const plans = Array.isArray(plansData) ? plansData : [];
  const requests = Array.isArray(reqData) ? reqData : [];

  const kpis = useMemo(() => ([
    { label: "Planes por publicar", value: plans.filter((p) => p.status === "pending").length, icon: Megaphone, domain: "plan" as DomainKey, href: "/dashboard/planning" },
    { label: "Publicados", value: plans.filter((p) => ["published", "released", "active"].includes(p.status)).length, icon: PackageCheck, domain: "planning" as DomainKey, href: "/dashboard/planning" },
    { label: "Solicitudes pendientes", value: requests.filter((r) => r.status === "pending").length, icon: HandHelping, domain: "warehouse" as DomainKey, href: "/dashboard/almacen" },
  ]), [plans, requests]);

  const activity = useMemo(() => {
    const a = plans.filter((p) => p.publishedAt).map((p) => ({ key: `plan-${p.id}`, icon: Megaphone, domain: "plan" as DomainKey, text: `Plan ${p.model} publicado`, who: p.publishedBy ?? "", at: p.publishedAt as string }));
    const b = requests.map((r) => ({ key: `req-${r.id}`, icon: HandHelping, domain: "warehouse" as DomainKey, text: `Solicitud de ${r.model ?? "material"}`, who: r.requestedBy ?? "", at: r.createdAt as string }));
    return [...a, ...b].filter((x) => x.at).sort((x, y) => +new Date(y.at) - +new Date(x.at)).slice(0, 5);
  }, [plans, requests]);

  const isAdmin = session?.role === "admin";
  const seesAll = isAdmin || session?.role === "executive";
  const adminUnread = notifications.filter((n) => !n.read).length;
  const messagingUnread = chatConvos.reduce((s, c) => s + (c.unread || 0), 0);
  const badgeTotal = adminUnread + messagingUnread;
  const notifItems = buildNotifications(chatConvos, notifications);
  const todayItems = notifItems.filter((n) => isToday(n.at));
  const earlierItems = notifItems.filter((n) => !isToday(n.at));
  const firstName = session?.name?.split(" ")[0] || "Usuario";
  const initials = (session?.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const roleLabel = positionLabel(session?.position) || ROLE_LABELS[session?.role || ""] || session?.role || "—";
  const areas = AREAS.filter((a) => seesAll || a.roles.includes(session?.role || ""));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login"); router.refresh();
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
      await fetch("/api/admin/notifications", { method: "POST" }).catch(() => {});
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
      const res = await fetch("/api/auth/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    <div className="min-h-screen text-black dark:text-white font-sans">
      {/* Fondo aurora provisto por el layout del dashboard. */}
      {/* Top bar */}
      <nav className={`${glass} fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center gap-4 rounded-none border-x-0 border-t-0`}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg tracking-tight">Axos OS</span>
          <WorkspaceSwitcher />
        </div>

        {/* Buscador "Spotlight" — abre la paleta de comandos (Ctrl/⌘+K) */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("axos:open-search"))}
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
                <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white dark:border-black text-[9px] font-bold text-white flex items-center justify-center">{badgeTotal > 99 ? "99+" : badgeTotal}</span>
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
            <button onClick={() => setMenuOpen(!menuOpen)} className="w-10 h-10 bg-black dark:bg-white rounded-full flex items-center justify-center text-white dark:text-black font-bold text-xs hover:scale-105 active:scale-95 transition-all">{initials}</button>
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
                            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                            placeholder="Tu nombre"
                            className="min-w-0 flex-1 bg-gray-100 dark:bg-white/10 rounded-lg px-2 py-1 text-sm outline-none"
                          />
                          <button onClick={saveName} disabled={savingName} className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:opacity-50" aria-label="Guardar"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingName(false)} className="p-1 rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10" aria-label="Cancelar"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm truncate">{session?.name ?? "Visitor"}</p>
                          <button onClick={() => { setNameDraft(session?.name ?? ""); setEditingName(true); }} className="p-1 rounded-md text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 flex-shrink-0" aria-label="Editar nombre"><Pencil className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                      <p className="text-[11px] text-gray-500 truncate">{session?.email ?? "—"}</p>
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

      <main className="pt-28 pb-24 px-6 md:px-10 lg:px-16 max-w-5xl mx-auto">
        {blocked && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-amber-800 dark:text-amber-200 flex gap-3 items-start">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><p className="text-sm">No tienes acceso a esa sección con tu puesto actual.</p>
          </motion.div>
        )}

        {/* Hero */}
        <header className="mb-8">
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-1 capitalize">
            {new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · {roleLabel}
          </p>
          <motion.h1 initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-4xl md:text-5xl font-bold tracking-tight">
            Hola, {firstName}.
          </motion.h1>
        </header>

        {/* KPIs — fila simétrica de 3 */}
        <motion.section variants={containerRM(reduce)} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {kpis.map((k) => (
            <MotionLink key={k.label} href={k.href} variants={itemRM(reduce)} whileHover={hoverRM(reduce)} whileTap={pressRM(reduce)} className="block h-full">
              <div className={`${glass} group rounded-3xl p-5 h-full`}>
                <div className="flex items-center justify-between mb-3">
                  <IconTile domain={k.domain} size={46} icon={k.icon} />
                  <HoverArrow />
                </div>
                <div className="text-4xl font-bold tracking-tight tabular-nums" style={{ color: DOMAINS[k.domain].text }}>{k.value}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{k.label}</div>
              </div>
            </MotionLink>
          ))}
        </motion.section>

        {/* Tus áreas — bento grid (tamaños variados, ritmo visual) */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-4">Tus áreas de trabajo</h2>
          {areas.length > 0 ? (
            <motion.div variants={containerRM(reduce)} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 auto-rows-[128px] gap-4 [grid-auto-flow:dense]">
              {areas.map((a, i) => {
                // Bento: la primera área es destacada (2x2); algunas se ensanchan.
                const feature = i === 0;
                const wide = !feature && i % 5 === 2;
                const span = feature ? 'md:col-span-2 md:row-span-2 col-span-2' : wide ? 'md:col-span-2' : '';
                return (
                  <motion.button
                    key={a.name}
                    variants={itemRM(reduce)}
                    onClick={() => router.push(a.href)}
                    whileHover={hoverRM(reduce)}
                    whileTap={pressRM(reduce)}
                    aria-label={a.name}
                    className={`${glass} group relative rounded-3xl p-5 text-left flex flex-col gap-3 justify-between h-full overflow-hidden ${span}`}
                  >
                    {/* Glow del color del dominio difuminado en la esquina (sutil). */}
                    <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40" style={{ background: DOMAINS[a.domain].solid }} />
                    <div className="flex items-start justify-between">
                      <IconTile domain={a.domain} size={feature ? 52 : 46} icon={a.icon} />
                      <HoverArrow />
                    </div>
                    <div>
                      <div className={`font-bold ${feature ? 'text-xl' : ''}`}>{a.name}</div>
                      <div className={`text-gray-500 dark:text-gray-400 ${feature ? 'text-sm' : 'text-xs'}`}>{a.desc}</div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : (
            <div className={`${glass} rounded-3xl p-8 text-center text-sm text-gray-400`}>Aún no tienes áreas asignadas. Pide acceso a tu administrador.</div>
          )}
        </section>

        {/* Actividad reciente — lista limpia a todo lo ancho */}
        <section>
          <h2 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-4">Actividad reciente</h2>
          <div className={`${glass} rounded-3xl p-2`}>
            {activity.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">Sin actividad todavía. Publica un plan para empezar.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {activity.map((a) => (
                  <div key={a.key} className="flex items-center gap-3 px-4 py-3">
                    <IconTile domain={a.domain} size={34} icon={a.icon} />
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{a.text}</p><p className="text-[11px] text-gray-400">{a.who} · {timeAgo(a.at)}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Dock funcional */}
      <div className={`${glass} fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded-[2rem] shadow-2xl flex items-center gap-2`}>
        <DockLink href="/dashboard" active icon={Icons.LayoutGrid} label="Inicio" />
        <DockLink href="/dashboard/planning" icon={LineChart} label="Planeación" />
        <DockLink href="/dashboard/almacen" icon={Warehouse} label="Almacén" />
        {isAdmin && <DockLink href="/dashboard/settings/organization" icon={Settings} label="Ajustes" />}
      </div>
    </div>
  );
}

function DockLink({ href, icon: Icon, label, active }: { href: string; icon: LucideIcon; label: string; active?: boolean }) {
  return (
    <Link href={href} aria-label={label} className={`p-3 rounded-full transition-all hover:scale-110 active:scale-95 ${active ? "bg-black dark:bg-white text-white dark:text-black" : "text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-white/10"}`}>
      <Icon className="w-5 h-5" />
    </Link>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <DashboardInner />
    </Suspense>
  );
}
