"use client";

import React, { Suspense, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Megaphone,
  HandHelping,
  PackageCheck,
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
import { AREAS, SECTION_ORDER } from "@/lib/dashboardAreas";
import { useDashboardSession } from "@/hooks/useDashboardSession";

const MotionLink = motion.create(Link);

interface PlanRow {
  id: number;
  model: string;
  workOrder: string;
  status: string;
  publishedBy?: string | null;
  publishedAt?: string | null;
}
interface RequestRow {
  id: number;
  model?: string | null;
  status: string;
  requestedBy?: string;
  createdAt?: string;
}

const sectionCopy: Record<string, string> = {
  "Diseño · NPI": "Definición de producto, materiales y proceso",
  Planeación: "Demanda, abastecimiento y publicación del plan",
  Materiales: "Inventario, recibo y flujo hacia línea",
  Producción: "Ejecución, mantenimiento y control de piso",
  Calidad: "Inspección, trazabilidad y contención",
  Logística: "Empaque, embarques y tráfico",
  "Finanzas · ERP": "Costo, operación administrativa y módulos ERP",
  "Control e inteligencia": "Señales ejecutivas, reportes y ontología",
  Administración: "Personas, seguridad y configuración operativa",
};

function DashboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const blocked = params.get("blocked");
  const reduce = useReducedMotion();

  const { session } = useDashboardSession();

  const { data: plansData } = useApi<PlanRow[]>("/plans");
  const { data: reqData } = useApi<RequestRow[]>("/material-requests");
  const plans = useMemo(
    () => (Array.isArray(plansData) ? plansData : []),
    [plansData],
  );
  const requests = useMemo(
    () => (Array.isArray(reqData) ? reqData : []),
    [reqData],
  );

  const kpis = useMemo(
    () => [
      {
        label: "Planes por publicar",
        value: plans.filter((p) => p.status === "pending").length,
        icon: Megaphone,
        domain: "plan" as DomainKey,
        href: "/dashboard/planning",
        meta: "requieren liberación",
      },
      {
        label: "Publicados",
        value: plans.filter((p) =>
          ["published", "released", "active"].includes(p.status),
        ).length,
        icon: PackageCheck,
        domain: "planning" as DomainKey,
        href: "/dashboard/planning",
        meta: "visibles para operación",
      },
      {
        label: "Solicitudes pendientes",
        value: requests.filter((r) => r.status === "pending").length,
        icon: HandHelping,
        domain: "warehouse" as DomainKey,
        href: "/dashboard/almacen",
        meta: "esperando almacén",
      },
    ],
    [plans, requests],
  );

  const activity = useMemo(() => {
    const a = plans
      .filter((p) => p.publishedAt)
      .map((p) => ({
        key: `plan-${p.id}`,
        icon: Megaphone,
        domain: "plan" as DomainKey,
        text: `Plan ${p.model} publicado`,
        who: p.publishedBy ?? "",
        at: p.publishedAt as string,
      }));
    const b = requests.map((r) => ({
      key: `req-${r.id}`,
      icon: HandHelping,
      domain: "warehouse" as DomainKey,
      text: `Solicitud de ${r.model ?? "material"}`,
      who: r.requestedBy ?? "",
      at: r.createdAt as string,
    }));
    return [...a, ...b]
      .filter((x) => x.at)
      .sort((x, y) => +new Date(y.at) - +new Date(x.at))
      .slice(0, 5);
  }, [plans, requests]);

  // Acceso del owner blindado: case-insensitive + override por email.
  const seesAll = seesAllAreas(session?.role, session?.email);
  const firstName = session?.name?.split(" ")[0] || "Usuario";
  const roleLabel =
    positionLabel(session?.position) ||
    ROLE_LABELS[session?.role || ""] ||
    session?.role ||
    "—";
  const workspaceLabel = session?.email?.split("@")[1] || "Workspace AXOS";
  const areas = AREAS.filter(
    (a) => seesAll || a.roles.includes(session?.role || ""),
  );
  const grouped = SECTION_ORDER.map((section) => ({
    section,
    items: areas.filter((a) => a.section === section),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen text-foreground font-sans">
      {/* Barra superior, dock y fondo aurora los provee el layout del dashboard. */}
      <main className="mx-auto max-w-6xl px-5 pb-28 pt-3 sm:px-6 md:px-10 lg:px-12">
        {blocked && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-800 shadow-sm dark:text-amber-200"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p className="text-sm">
              No tienes acceso a esa sección con tu puesto actual.
            </p>
          </motion.div>
        )}

        {/* Hero */}
        <motion.header
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className={`${glass} relative mb-5 overflow-hidden rounded-[2rem] px-6 py-7 sm:px-8 sm:py-9 md:px-10`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-foreground/[0.035] blur-3xl dark:bg-white/[0.045]"
          />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                Hub operativo · {roleLabel}
              </p>
              <h1 className="text-4xl font-semibold tracking-[-0.045em] text-foreground sm:text-5xl md:text-6xl">
                Hola, {firstName}.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Coordina el flujo industrial desde un solo punto: diseño,
                materiales, producción, calidad y control ejecutivo con señales
                claras y navegación precisa.
              </p>
            </div>
            <div className="grid min-w-[220px] gap-2 rounded-2xl border border-border/70 bg-background/55 p-4 text-sm shadow-sm backdrop-blur-sm dark:bg-white/[0.035]">
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Contexto
              </span>
              <span className="truncate font-medium text-foreground">
                {workspaceLabel}
              </span>
              <span className="text-xs capitalize text-muted-foreground">
                {new Date().toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
            </div>
          </div>
        </motion.header>

        {/* KPIs — fila simétrica de 3 */}
        <motion.section
          variants={containerRM(reduce)}
          initial="hidden"
          animate="show"
          className="mb-12 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4"
        >
          {kpis.map((k) => (
            <MotionLink
              key={k.label}
              href={k.href}
              variants={itemRM(reduce)}
              whileHover={hoverRM(reduce)}
              whileTap={pressRM(reduce)}
              className="group block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
            >
              <div
                className={`${glass} h-full rounded-3xl p-4 transition-[border-color,box-shadow,transform] duration-300 group-hover:border-foreground/10 group-hover:shadow-md sm:p-5`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <IconTile domain={k.domain} size={40} icon={k.icon} />
                  <HoverArrow className="mt-1 opacity-60 group-hover:opacity-100" />
                </div>
                <div className="text-3xl font-semibold tracking-[-0.04em] text-foreground tabular-nums sm:text-4xl">
                  {k.value}
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">
                  {k.label}
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {k.meta}
                </div>
              </div>
            </MotionLink>
          ))}
        </motion.section>

        {/* Tus áreas — agrupadas por el flujo real (Diseño → … → Admin) */}
        {areas.length > 0 ? (
          <div className="mb-12 space-y-11">
            {grouped.map((g) => (
              <section key={g.section}>
                <div className="mb-4 flex flex-col gap-1 border-t border-border/70 pt-5 sm:flex-row sm:items-end sm:justify-between">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                    {g.section}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {sectionCopy[g.section] ?? "Módulos operativos del área"}
                  </p>
                </div>
                <motion.div
                  variants={containerRM(reduce)}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
                >
                  {g.items.map((a) => (
                    <motion.button
                      key={a.name}
                      variants={itemRM(reduce)}
                      onClick={() => router.push(a.href)}
                      whileHover={hoverRM(reduce)}
                      whileTap={pressRM(reduce)}
                      aria-label={a.name}
                      className={`${glass} group relative min-h-36 overflow-hidden rounded-3xl p-5 text-left transition-[border-color,box-shadow,transform] duration-300 hover:border-foreground/10 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35`}
                    >
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent opacity-70 dark:via-white/15"
                      />
                      <div className="flex h-full flex-col justify-between gap-5">
                        <div className="flex items-start justify-between gap-3">
                          <IconTile domain={a.domain} size={40} icon={a.icon} />
                          <HoverArrow className="opacity-50 group-hover:opacity-100" />
                        </div>
                        <div>
                          <div className="font-semibold leading-tight tracking-[-0.01em] text-foreground">
                            {a.name}
                          </div>
                          <div className="mt-1.5 text-xs leading-5 text-muted-foreground">
                            {a.desc}
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              </section>
            ))}
          </div>
        ) : (
          <div
            className={`${glass} mb-10 rounded-3xl p-8 text-center text-sm text-muted-foreground`}
          >
            Aún no tienes áreas asignadas. Pide acceso a tu administrador.
          </div>
        )}

        {/* Actividad reciente — lista limpia a todo lo ancho */}
        <section>
          <div className="mb-4 flex items-end justify-between border-t border-border/70 pt-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Actividad reciente
            </h2>
            <span className="text-xs text-muted-foreground">
              Últimas señales operativas
            </span>
          </div>
          <div className={`${glass} rounded-3xl p-2`}>
            {activity.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Sin actividad todavía. Publica un plan para empezar.
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {activity.map((a) => (
                  <div
                    key={a.key}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors hover:bg-foreground/[0.03] dark:hover:bg-white/[0.04]"
                  >
                    <IconTile domain={a.domain} size={34} icon={a.icon} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.text}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.who} · {timeAgo(a.at)}
                      </p>
                    </div>
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
