"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle, Megaphone, HandHelping, PackageCheck, Warehouse, LineChart,
  Boxes, Factory, ShieldCheck, Cpu, DollarSign, RadioTower, FileText,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { containerRM, itemRM, hoverRM, pressRM } from "@/lib/motion";
import { useApi } from "@/hooks/useApi";
import { positionLabel } from "@/config/positions";
import { IconTile } from "@/components/ui/IconTile";
import { HoverArrow } from "@/components/ui/HoverArrow";
import { DOMAINS, type DomainKey } from "@/lib/design/domains";
import { seesAllAreas } from "@/lib/owner";
import { timeAgo, ROLE_LABELS } from "@/lib/dashboardShared";

const MotionLink = motion.create(Link);

interface SessionInfo {
  kind: "user" | "demo";
  name: string; email: string | null; role: string; position?: string | null; userId: string | null;
}
interface PlanRow { id: number; model: string; workOrder: string; status: string; publishedBy?: string | null; publishedAt?: string | null }
interface RequestRow { id: number; model?: string | null; status: string; requestedBy?: string; createdAt?: string }

// The working areas of the app, grouped by the REAL operational flow so the hub
// reads like the process: Diseño/NPI → Planeación → Materiales → Producción →
// Calidad → Finanzas/ERP → Control → Administración. Each user sees only the
// areas for their role (admin/executive/owner see all). Nothing is deleted —
// areas are reordered + grouped (re-IA, not removal).
const AREAS: { name: string; desc: string; href: string; icon: LucideIcon; domain: DomainKey; roles: string[]; section: string }[] = [
  // ── Diseño · NPI ──
  { name: "Modelos · NPI", desc: "Maestro de productos", href: "/dashboard/models", icon: Boxes, domain: "engineering", roles: ["engineering", "industrial_engineer", "quality_engineer", "production_supervisor"], section: "Diseño · NPI" },
  { name: "Maestro de Materiales", desc: "Partes, AVL y alternantes (MM)", href: "/dashboard/materials", icon: Icons.Package, domain: "engineering", roles: ["engineering", "industrial_engineer", "quality_engineer", "production_supervisor", "buyer"], section: "Diseño · NPI" },
  { name: "BOM Multinivel", desc: "Estructuras N niveles + explosión", href: "/dashboard/bom", icon: Icons.Network, domain: "engineering", roles: ["engineering", "industrial_engineer", "quality_engineer", "production_supervisor"], section: "Diseño · NPI" },
  { name: "Ingeniería", desc: "BOM y proceso", href: "/dashboard/engineering", icon: Cpu, domain: "engineering", roles: ["engineering", "industrial_engineer", "quality_engineer", "production_supervisor"], section: "Diseño · NPI" },
  { name: "Ing. Industrial", desc: "Proceso, capacidad y mejora", href: "/dashboard/industrial-engineering", icon: Icons.Gauge, domain: "engineering", roles: ["engineering", "industrial_engineer", "production_supervisor"], section: "Diseño · NPI" },
  { name: "Disposición de líneas", desc: "Layout, ruteo y balanceo", href: "/dashboard/line-engineering", icon: Icons.Gauge, domain: "engineering", roles: ["industrial_engineer", "engineering", "production_supervisor"], section: "Diseño · NPI" },

  // ── Planeación ──
  { name: "Planeación", desc: "Publicar planes", href: "/dashboard/planning", icon: LineChart, domain: "planning", roles: ["planner"], section: "Planeación" },
  { name: "Muro del plan", desc: "Publicar WOs en vivo", href: "/dashboard/production-plan", icon: Megaphone, domain: "plan", roles: ["planner", "production_supervisor", "operator", "materialist"], section: "Planeación" },

  // ── Materiales ──
  { name: "Inventario", desc: "Existencias y kitting", href: "/dashboard/inventory", icon: Boxes, domain: "inventory", roles: ["warehouse_operator", "materialist", "cycle_count_analyst", "planner"], section: "Materiales" },
  { name: "Surtido a línea", desc: "Kitting y e-kanban", href: "/dashboard/material-staging", icon: Icons.PackagePlus, domain: "staging", roles: ["materialist", "warehouse_operator", "production_supervisor"], section: "Materiales" },
  { name: "Almacén", desc: "Surtir y autorizar", href: "/dashboard/almacen", icon: Warehouse, domain: "warehouse", roles: ["warehouse_operator", "materialist"], section: "Materiales" },

  // ── Producción ──
  { name: "Producción", desc: "Órdenes y piso", href: "/dashboard/production", icon: Factory, domain: "production", roles: ["production_supervisor", "operator", "warehouse_operator"], section: "Producción" },
  { name: "Operador MES", desc: "Ejecución en estación", href: "/dashboard/operador", icon: Icons.HardHat, domain: "production", roles: ["production_supervisor", "operator"], section: "Producción" },
  { name: "Terminal de operador", desc: "Poka-yoke, backflush, andon", href: "/dashboard/operator-terminal", icon: Icons.ScanLine, domain: "production", roles: ["operator", "production_supervisor"], section: "Producción" },

  // ── Calidad ──
  { name: "Calidad", desc: "Inspección y NCR", href: "/dashboard/quality", icon: ShieldCheck, domain: "quality", roles: ["quality_engineer", "mrb_member"], section: "Calidad" },
  { name: "Calidad de piso · MRB", desc: "Holds y disposición", href: "/dashboard/floor-quality", icon: Icons.ShieldX, domain: "quality", roles: ["quality_engineer", "mrb_member", "production_supervisor"], section: "Calidad" },
  { name: "Pruebas / Lab", desc: "Inspección y validación", href: "/dashboard/lab", icon: Icons.FlaskConical, domain: "quality", roles: ["quality_engineer", "engineering"], section: "Calidad" },

  // ── Finanzas · ERP ──
  { name: "Finanzas", desc: "Costos y P&L", href: "/dashboard/finance", icon: DollarSign, domain: "finance", roles: ["finance"], section: "Finanzas · ERP" },
  { name: "Costos y métricas", desc: "Dinero y eficiencia", href: "/dashboard/metrics", icon: Icons.Activity, domain: "finance", roles: ["finance", "planner", "production_supervisor"], section: "Finanzas · ERP" },
  { name: "Axos ERP", desc: "FIN · MM · PP · SD · T-Codes", href: "/dashboard/erp", icon: Icons.Landmark, domain: "erp", roles: ["finance", "planner", "production_supervisor", "buyer"], section: "Finanzas · ERP" },

  // ── Control e inteligencia ──
  { name: "Mission Control", desc: "Vista ejecutiva", href: "/dashboard/mission-control", icon: RadioTower, domain: "mes", roles: ["planner", "production_supervisor", "finance"], section: "Control e inteligencia" },
  { name: "Torre de control de línea", desc: "Readiness y semáforo por línea", href: "/dashboard/line-control-tower", icon: RadioTower, domain: "mes", roles: ["production_supervisor", "planner", "plant_manager"], section: "Control e inteligencia" },

  // ── Administración ──
  { name: "Personas (RH)", desc: "Plantilla y accesos", href: "/dashboard/rh", icon: Icons.Users, domain: "people", roles: ["hr"], section: "Administración" },
  { name: "Office", desc: "Docs · Hojas · Slides", href: "/dashboard/office", icon: FileText, domain: "office", roles: ["engineering", "planner", "quality_engineer", "production_supervisor", "warehouse_operator", "finance", "buyer", "hr"], section: "Administración" },
];

// Order the flow sections render in.
const SECTION_ORDER = [
  "Diseño · NPI", "Planeación", "Materiales", "Producción",
  "Calidad", "Finanzas · ERP", "Control e inteligencia", "Administración",
];

function DashboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const blocked = params.get("blocked");
  const reduce = useReducedMotion();

  const [session, setSession] = useState<SessionInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setSession(d.session)).catch(() => {});
  }, []);

  const { data: plansData } = useApi<PlanRow[]>("/plans");
  const { data: reqData } = useApi<RequestRow[]>("/material-requests");
  const plans = useMemo(() => (Array.isArray(plansData) ? plansData : []), [plansData]);
  const requests = useMemo(() => (Array.isArray(reqData) ? reqData : []), [reqData]);

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

  // Acceso del owner blindado: case-insensitive + override por email.
  const seesAll = seesAllAreas(session?.role, session?.email);
  const firstName = session?.name?.split(" ")[0] || "Usuario";
  const roleLabel = positionLabel(session?.position) || ROLE_LABELS[session?.role || ""] || session?.role || "—";
  const areas = AREAS.filter((a) => seesAll || a.roles.includes(session?.role || ""));
  const grouped = SECTION_ORDER
    .map((section) => ({ section, items: areas.filter((a) => a.section === section) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen text-black dark:text-white font-sans">
      {/* Barra superior, dock y fondo aurora los provee el layout del dashboard. */}
      <main className="pt-2 pb-24 px-6 md:px-10 lg:px-16 max-w-5xl mx-auto">
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

        {/* Tus áreas — agrupadas por el flujo real (Diseño → … → Admin) */}
        {areas.length > 0 ? (
          <div className="mb-10 space-y-8">
            {grouped.map((g) => (
              <section key={g.section}>
                <h2 className="text-xs font-semibold tracking-wider uppercase text-gray-500 dark:text-gray-400 mb-3">{g.section}</h2>
                <motion.div variants={containerRM(reduce)} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {g.items.map((a) => (
                    <motion.button
                      key={a.name}
                      variants={itemRM(reduce)}
                      onClick={() => router.push(a.href)}
                      whileHover={hoverRM(reduce)}
                      whileTap={pressRM(reduce)}
                      aria-label={a.name}
                      className={`${glass} group relative rounded-3xl p-5 text-left flex flex-col gap-3 justify-between h-32 overflow-hidden`}
                    >
                      {/* Glow del color del dominio difuminado en la esquina (sutil). */}
                      <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-40" style={{ background: DOMAINS[a.domain].solid }} />
                      <div className="flex items-start justify-between">
                        <IconTile domain={a.domain} size={46} icon={a.icon} />
                        <HoverArrow />
                      </div>
                      <div>
                        <div className="font-bold">{a.name}</div>
                        <div className="text-gray-500 dark:text-gray-400 text-xs">{a.desc}</div>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              </section>
            ))}
          </div>
        ) : (
          <div className={`${glass} rounded-3xl p-8 text-center text-sm text-gray-400 mb-10`}>Aún no tienes áreas asignadas. Pide acceso a tu administrador.</div>
        )}

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
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <DashboardInner />
    </Suspense>
  );
}
