"use client";

import React, { Suspense, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Megaphone, HandHelping, PackageCheck } from "lucide-react";
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

interface PlanRow { id: number; model: string; workOrder: string; status: string; publishedBy?: string | null; publishedAt?: string | null }
interface RequestRow { id: number; model?: string | null; status: string; requestedBy?: string; createdAt?: string }

function DashboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const blocked = params.get("blocked");
  const reduce = useReducedMotion();

  const { session } = useDashboardSession();

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
                      className={`${glass} group relative rounded-3xl p-5 text-left flex flex-col gap-3 justify-between min-h-32 overflow-hidden`}
                    >
                      {/* Tinte de firma del dominio difuminado en la esquina —
                          muy tenue (materialidad, no glow neón). */}
                      <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.07] blur-2xl transition-opacity duration-300 group-hover:opacity-[0.16]" style={{ background: DOMAINS[a.domain].solid }} />
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
