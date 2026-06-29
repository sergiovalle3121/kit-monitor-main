"use client";

import React, { Suspense, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Megaphone,
  HandHelping,
  PackageCheck,
  CheckCircle2,
  Search,
  History,
  ArrowUpRight,
} from "lucide-react";
import { glass } from "@/lib/glass";
import { containerRM, itemRM, hoverRM, pressRM } from "@/lib/motion";
import { useApi } from "@/hooks/useApi";
import { positionLabel } from "@/config/positions";
import { IconTile } from "@/components/ui/IconTile";
import { HoverArrow } from "@/components/ui/HoverArrow";
import { ICON_STROKE, type DomainKey } from "@/lib/design/domains";
import { seesAllAreas } from "@/lib/owner";
import { timeAgo, ROLE_LABELS } from "@/lib/dashboardShared";
import { quickAccessAreas } from "@/lib/dashboardAreas";
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

function DashboardInner() {
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

  // Cola de atención: señales accionables derivadas de datos REALES ya cargados
  // (planes por publicar, solicitudes esperando almacén). Sin inventar nada; si
  // no hay pendientes, se muestra un estado "todo al día" honesto.
  const attention = useMemo(() => {
    const items: {
      key: string;
      domain: DomainKey;
      icon: typeof Megaphone;
      title: string;
      meta: string;
      href: string;
      severity: "high" | "medium";
    }[] = [];
    const pendingPlans = plans.filter((p) => p.status === "pending");
    if (pendingPlans.length > 0) {
      items.push({
        key: "plans-pending",
        domain: "plan",
        icon: Megaphone,
        title: `${pendingPlans.length} ${pendingPlans.length === 1 ? "plan" : "planes"} por publicar`,
        meta: "Libéralos para que operación los vea",
        href: "/dashboard/planning",
        severity: "high",
      });
    }
    const pendingReqs = requests.filter((r) => r.status === "pending");
    if (pendingReqs.length > 0) {
      items.push({
        key: "reqs-pending",
        domain: "warehouse",
        icon: HandHelping,
        title: `${pendingReqs.length} ${pendingReqs.length === 1 ? "solicitud" : "solicitudes"} de material`,
        meta: "Esperando surtido de almacén",
        href: "/dashboard/almacen",
        severity: "medium",
      });
    }
    return items;
  }, [plans, requests]);

  const SEVERITY: Record<
    "high" | "medium",
    { dot: string; ring: string; label: string }
  > = {
    high: {
      dot: "bg-red-500",
      ring: "border-red-500/20",
      label: "Prioridad alta",
    },
    medium: {
      dot: "bg-amber-500",
      ring: "border-amber-500/20",
      label: "Pendiente",
    },
  };

  // Acceso del owner blindado: case-insensitive + override por email.
  const seesAll = seesAllAreas(session?.role, session?.email);
  const firstName = session?.name?.split(" ")[0] || "Usuario";
  const roleLabel =
    positionLabel(session?.position) ||
    ROLE_LABELS[session?.role || ""] ||
    session?.role ||
    "—";
  const workspaceLabel = session?.email?.split("@")[1] || "Workspace AXOS";

  // Accesos rápidos contextuales (role-aware). El catálogo COMPLETO de módulos
  // vive en la navegación (Command rail / panel móvil) — el home ya no duplica
  // la rejilla; aquí solo 4–6 atajos a lo más operativo.
  const quickAccess = useMemo(
    () => quickAccessAreas(session?.role || "", seesAll, 6),
    [session?.role, seesAll],
  );

  return (
    <div className="min-h-screen text-foreground font-sans">
      {/* Barra superior, navegación y fondo aurora los provee el layout del dashboard. */}
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

        {/* Hero compacto — saludo + contexto, sin rejilla de módulos. */}
        <motion.header
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="max-w-2xl">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Hub operativo · {roleLabel}
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.035em] text-foreground sm:text-4xl">
              Hola, {firstName}.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Lo que requiere tu atención hoy, de un vistazo.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("axos:open-search"))
                }
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                <Search className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                Buscar
                <kbd className="hidden font-mono text-[10px] text-muted-foreground sm:inline">
                  ⌘K
                </kbd>
              </button>
              <Link
                href="/dashboard/activity"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
              >
                <History className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                Mi actividad
              </Link>
            </div>
          </div>
          <div className="grid min-w-[200px] gap-1.5 rounded-2xl border border-border/70 bg-background/55 px-4 py-3.5 text-sm shadow-sm backdrop-blur-sm dark:bg-white/[0.035]">
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
                className={`${glass} h-full rounded-3xl p-5 transition-[border-color,box-shadow] duration-300 group-hover:border-foreground/10`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <IconTile domain={k.domain} size={40} icon={k.icon} />
                  <HoverArrow className="mt-1 opacity-50 group-hover:opacity-100" />
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

        {/* Requiere atención — cola accionable (datos reales; estado honesto) */}
        <section className="mb-12">
          <div className="mb-4 flex items-end justify-between border-t border-border/70 pt-5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Requiere atención
            </h2>
            <span className="text-xs text-muted-foreground">
              {attention.length > 0
                ? `${attention.length} ${attention.length === 1 ? "señal" : "señales"} accionables`
                : "Sin pendientes"}
            </span>
          </div>
          {attention.length === 0 ? (
            <div
              className={`${glass} flex items-center gap-3 rounded-3xl p-5 text-sm text-muted-foreground`}
            >
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-500" />
              <span>
                Todo al día. No hay planes por publicar ni solicitudes
                esperando surtido.
              </span>
            </div>
          ) : (
            <motion.div
              variants={containerRM(reduce)}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              {attention.map((a) => {
                const sv = SEVERITY[a.severity];
                return (
                  <MotionLink
                    key={a.key}
                    href={a.href}
                    variants={itemRM(reduce)}
                    whileHover={hoverRM(reduce)}
                    whileTap={pressRM(reduce)}
                    className={`group block rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35`}
                  >
                    <div
                      className={`${glass} flex h-full items-center gap-4 rounded-3xl border-l-2 ${sv.ring} p-5 transition-[border-color,box-shadow] duration-300`}
                    >
                      <IconTile domain={a.domain} size={40} icon={a.icon} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${sv.dot}`}
                          />
                          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {sv.label}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-foreground">
                          {a.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {a.meta}
                        </p>
                      </div>
                      <HoverArrow className="opacity-50 group-hover:opacity-100" />
                    </div>
                  </MotionLink>
                );
              })}
            </motion.div>
          )}
        </section>

        {/* Accesos rápidos — atajos contextuales (la navegación completa vive en
            el Command rail / panel móvil; el home ya no duplica la rejilla). */}
        {quickAccess.length > 0 && (
          <section className="mb-12">
            <div className="mb-4 flex items-end justify-between border-t border-border/70 pt-5">
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
                Accesos rápidos
              </h2>
              <span className="hidden text-xs text-muted-foreground lg:inline">
                Todos los módulos están en la navegación lateral
              </span>
            </div>
            <motion.div
              variants={containerRM(reduce)}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            >
              {quickAccess.map((a) => {
                const Icon = a.icon;
                return (
                  <MotionLink
                    key={a.href}
                    href={a.href}
                    variants={itemRM(reduce)}
                    whileHover={hoverRM(reduce)}
                    whileTap={pressRM(reduce)}
                    aria-label={a.name}
                    className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-background/55 px-4 py-3.5 text-left transition-colors hover:border-foreground/15 hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 dark:bg-white/[0.025]"
                  >
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-foreground/[0.05] text-muted-foreground transition-colors group-hover:text-foreground dark:bg-white/[0.06]">
                      <Icon className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {a.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {a.desc}
                      </span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
                  </MotionLink>
                );
              })}
            </motion.div>
          </section>
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
