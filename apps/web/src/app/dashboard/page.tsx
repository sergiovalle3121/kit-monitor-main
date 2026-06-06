"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Bell, User, ShieldAlert, AlertCircle, LogOut, ChevronRight, Megaphone,
  HandHelping, PackageCheck, Warehouse, LineChart, Building2, Settings, Boxes,
  Factory, ShieldCheck, Cpu, DollarSign, RadioTower,
} from "lucide-react";
import { TCodePalette } from "@/components/TCodePalette";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { glass } from "@/lib/glass";
import { useApi } from "@/hooks/useApi";
import { positionLabel } from "@/config/positions";

interface SessionInfo {
  kind: "user" | "demo";
  name: string; email: string | null; role: string; position?: string | null; userId: string | null;
}
interface AdminNotification { id: string; type: string; title: string; body: string; read: boolean; createdAt: string }
interface PlanRow { id: number; model: string; workOrder: string; status: string; publishedBy?: string | null; publishedAt?: string | null }
interface RequestRow { id: number; model?: string | null; status: string; requestedBy?: string; createdAt?: string }

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador", executive: "Dirección", planner: "Planeación", buyer: "Compras",
  production_supervisor: "Producción", quality_engineer: "Calidad", engineering: "Ingeniería",
  warehouse_operator: "Almacén / Inventario", finance: "Finanzas", hr: "Personas",
};

// The working areas of the app. Each user sees only the ones for their role
// (admin/executive see all). One uniform grid → predictable, symmetric, calm.
const AREAS: { name: string; desc: string; href: string; icon: LucideIcon; color: string; tint: string; roles: string[] }[] = [
  { name: "Planeación", desc: "Publicar planes", href: "/dashboard/planning", icon: LineChart, color: "text-violet-500", tint: "bg-violet-50 dark:bg-violet-500/10", roles: ["planner"] },
  { name: "Almacén", desc: "Surtir y autorizar", href: "/dashboard/almacen", icon: Warehouse, color: "text-blue-500", tint: "bg-blue-50 dark:bg-blue-500/10", roles: ["warehouse_operator"] },
  { name: "Inventario", desc: "Existencias y kitting", href: "/dashboard/inventory", icon: Boxes, color: "text-sky-500", tint: "bg-sky-50 dark:bg-sky-500/10", roles: ["warehouse_operator", "planner"] },
  { name: "Producción", desc: "Órdenes y piso", href: "/dashboard/production", icon: Factory, color: "text-amber-500", tint: "bg-amber-50 dark:bg-amber-500/10", roles: ["production_supervisor", "warehouse_operator"] },
  { name: "Calidad", desc: "Inspección y NCR", href: "/dashboard/quality", icon: ShieldCheck, color: "text-emerald-500", tint: "bg-emerald-50 dark:bg-emerald-500/10", roles: ["quality_engineer"] },
  { name: "Ingeniería", desc: "BOM y proceso", href: "/dashboard/engineering", icon: Cpu, color: "text-indigo-500", tint: "bg-indigo-50 dark:bg-indigo-500/10", roles: ["engineering", "quality_engineer", "production_supervisor"] },
  { name: "Finanzas", desc: "Costos y P&L", href: "/dashboard/finance", icon: DollarSign, color: "text-green-500", tint: "bg-green-50 dark:bg-green-500/10", roles: ["finance"] },
  { name: "Mission Control", desc: "Vista ejecutiva", href: "/dashboard/mission-control", icon: RadioTower, color: "text-cyan-500", tint: "bg-cyan-50 dark:bg-cyan-500/10", roles: ["planner", "production_supervisor", "finance"] },
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

function DashboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const blocked = params.get("blocked");
  const reduce = useReducedMotion();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setSession(d.session));
  }, []);

  useEffect(() => {
    if (session?.role !== "admin") return;
    let active = true;
    async function load() {
      const [n, p] = await Promise.all([
        fetch("/api/admin/notifications", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        fetch("/api/admin/pending", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      ]);
      if (!active) return;
      setNotifications(n.notifications || []);
      setPendingCount(p.users?.length || 0);
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
    { label: "Planes por publicar", value: plans.filter((p) => p.status === "pending").length, icon: Megaphone, color: "#f59e0b", href: "/dashboard/planning" },
    { label: "Publicados", value: plans.filter((p) => ["published", "released", "active"].includes(p.status)).length, icon: PackageCheck, color: "#7c3aed", href: "/dashboard/planning" },
    { label: "Solicitudes pendientes", value: requests.filter((r) => r.status === "pending").length, icon: HandHelping, color: "#3b82f6", href: "/dashboard/almacen" },
  ]), [plans, requests]);

  const activity = useMemo(() => {
    const a = plans.filter((p) => p.publishedAt).map((p) => ({ key: `plan-${p.id}`, icon: Megaphone, color: "#7c3aed", text: `Plan ${p.model} publicado`, who: p.publishedBy ?? "", at: p.publishedAt as string }));
    const b = requests.map((r) => ({ key: `req-${r.id}`, icon: HandHelping, color: "#3b82f6", text: `Solicitud de ${r.model ?? "material"}`, who: r.requestedBy ?? "", at: r.createdAt as string }));
    return [...a, ...b].filter((x) => x.at).sort((x, y) => +new Date(y.at) - +new Date(x.at)).slice(0, 5);
  }, [plans, requests]);

  const isAdmin = session?.role === "admin";
  const seesAll = isAdmin || session?.role === "executive";
  const unread = notifications.filter((n) => !n.read).length;
  const firstName = session?.name?.split(" ")[0] || "Usuario";
  const initials = (session?.name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const roleLabel = positionLabel(session?.position) || ROLE_LABELS[session?.role || ""] || session?.role || "—";
  const areas = AREAS.filter((a) => seesAll || a.roles.includes(session?.role || ""));

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login"); router.refresh();
  }
  async function openNotifs() {
    setNotifOpen((o) => !o);
    if (!notifOpen && isAdmin) {
      await fetch("/api/admin/notifications", { method: "POST" }).catch(() => {});
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  return (
    <div className="min-h-screen text-black dark:text-white font-sans">
      <TCodePalette />

      {/* Top bar */}
      <nav className={`${glass} fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center rounded-none border-x-0 border-t-0`}>
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg tracking-tight">Axos OS</span>
          <WorkspaceSwitcher />
        </div>
        <div className="flex items-center gap-3 relative">
          <div className="relative">
            <button onClick={openNotifs} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors relative" aria-label="Notificaciones">
              <Bell className="w-5 h-5" />
              {(unread > 0 || pendingCount > 0) && (
                <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full border-2 border-white dark:border-black text-[9px] font-bold text-white flex items-center justify-center">{Math.max(unread, pendingCount)}</span>
              )}
            </button>
            <AnimatePresence>
              {notifOpen && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className={`${glass} absolute right-0 mt-4 w-96 rounded-[2rem] shadow-2xl p-6 z-[100]`}>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">Notificaciones</h3>
                    {isAdmin && pendingCount > 0 && (
                      <Link href="/dashboard/admin/approvals" onClick={() => setNotifOpen(false)} className="text-xs font-bold text-rose-500 hover:underline">Revisar {pendingCount}</Link>
                    )}
                  </div>
                  {isAdmin && notifications.length > 0 ? (
                    <div className="space-y-3 max-h-72 overflow-y-auto">
                      {notifications.slice(0, 8).map((n) => (
                        <div key={n.id} className="flex gap-3 items-start">
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.type === "user.pending" ? "bg-rose-500" : n.type === "user.approved" ? "bg-green-500" : "bg-gray-400"}`} />
                          <div className="min-w-0"><p className="text-xs font-bold truncate">{n.title}</p><p className="text-[10px] text-gray-500">{n.body}</p><p className="text-[9px] text-gray-400 mt-0.5">{timeAgo(n.createdAt)}</p></div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-xs text-gray-400">Sin notificaciones nuevas.</p>}
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
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{session?.name ?? "Visitor"}</p>
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
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {kpis.map((k) => (
            <Link key={k.label} href={k.href}>
              <div className={`${glass} rounded-3xl p-5 h-full hover:-translate-y-1 transition-transform`}>
                <div className="flex items-center justify-between mb-3"><k.icon className="w-5 h-5" style={{ color: k.color }} /><ChevronRight className="w-4 h-4 text-gray-300" /></div>
                <div className="text-4xl font-bold tracking-tight tabular-nums" style={{ color: k.color }}>{k.value}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">{k.label}</div>
              </div>
            </Link>
          ))}
        </section>

        {/* Tus áreas — grid uniforme y simétrico */}
        <section className="mb-10">
          <h2 className="text-sm font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-4">Tus áreas de trabajo</h2>
          {areas.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {areas.map((a) => (
                <motion.button key={a.name} onClick={() => router.push(a.href)} whileHover={reduce ? undefined : { y: -4 }} whileTap={reduce ? undefined : { scale: 0.97 }} className={`${glass} rounded-3xl p-5 text-left flex flex-col gap-3 aspect-[4/3] justify-between`}>
                  <div className={`inline-flex p-3 rounded-2xl ${a.tint} w-fit`}><a.icon className={`w-6 h-6 ${a.color}`} strokeWidth={1.5} /></div>
                  <div><div className="font-bold">{a.name}</div><div className="text-xs text-gray-500 dark:text-gray-400">{a.desc}</div></div>
                </motion.button>
              ))}
            </div>
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
                    <div className="p-2 rounded-xl" style={{ backgroundColor: `${a.color}1a` }}><a.icon className="w-4 h-4" style={{ color: a.color }} /></div>
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
