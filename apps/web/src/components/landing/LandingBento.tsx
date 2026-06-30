"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Boxes,
  ScanLine,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

/**
 * Bento de capacidades: en vez de describir el producto con texto seco, lo
 * *muestra* con micro-visualizaciones que hablan por sí solas (estilo
 * Apple / Linear / Stripe). Cada loseta enlaza a su ruta real; los gráficos
 * son recreaciones decorativas (aria-hidden), no capturas frágiles.
 */

const tile =
  "group relative overflow-hidden rounded-3xl border border-black/[0.07] bg-white/70 p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-black/[0.05] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.06]";

const kicker =
  "text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400";

function Cta({ children }: { children: React.ReactNode }) {
  return (
    <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-gray-900 opacity-70 transition group-hover:gap-2 group-hover:opacity-100 dark:text-white">
      {children}
      <ArrowRight className="h-3.5 w-3.5" />
    </span>
  );
}

/* --- Mini-visual: anillo OEE --- */
function OeeRing({ pct = 94 }: { pct?: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div aria-hidden className="relative h-24 w-24">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" strokeWidth="8" className="stroke-black/[0.06] dark:stroke-white/10" />
        <defs>
          <linearGradient id="oee-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          stroke="url(#oee-grad)"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums">{pct}%</span>
        <span className="text-[9px] font-medium uppercase tracking-wide text-gray-400">OEE</span>
      </div>
    </div>
  );
}

/* --- Mini-visual: tarjetas e-kanban --- */
function KanbanCards() {
  const cards = [
    { np: "R0402-10K", qty: "Reponer", tone: "bg-amber-500" },
    { np: "C0603-100n", qty: "OK", tone: "bg-emerald-500" },
    { np: "U-ATmega", qty: "OK", tone: "bg-emerald-500" },
  ];
  return (
    <div aria-hidden className="space-y-1.5">
      {cards.map((k) => (
        <div
          key={k.np}
          className="flex items-center gap-2 rounded-lg border border-black/[0.06] bg-white/80 px-2.5 py-1.5 text-[11px] dark:border-white/10 dark:bg-white/[0.04]"
        >
          <span className={`h-1.5 w-1.5 rounded-full ${k.tone}`} />
          <span className="font-mono font-medium">{k.np}</span>
          <span className="ml-auto text-[10px] font-semibold text-gray-400">{k.qty}</span>
        </div>
      ))}
    </div>
  );
}

/* --- Mini-visual: línea de trazabilidad --- */
function TraceTimeline() {
  const steps = ["SN-2240", "Reel L-88", "SMT-2", "Op. M.R.", "Test ✓"];
  return (
    <div aria-hidden className="flex items-center gap-1 overflow-hidden">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <span className="whitespace-nowrap rounded-md border border-black/[0.06] bg-white/80 px-2 py-1 text-[10px] font-medium dark:border-white/10 dark:bg-white/[0.05]">
            {s}
          </span>
          {i < steps.length - 1 && (
            <span className="h-px w-3 flex-shrink-0 bg-gradient-to-r from-indigo-400/60 to-violet-400/60" />
          )}
        </div>
      ))}
    </div>
  );
}

/* --- Mini-visual: pipeline plan → piso --- */
function PlanToFloor() {
  const stations = [
    { name: "SMT", done: true },
    { name: "AOI", done: true },
    { name: "ICT", done: true },
    { name: "FINAL", done: false },
  ];
  return (
    <div aria-hidden className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-300">
          WO-4821
        </span>
        <span className="text-[11px] text-gray-400">Publicada · 1,200 u</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          En piso
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {stations.map((st, i) => (
          <div key={st.name} className="flex flex-1 items-center gap-1.5">
            <div
              className={`flex flex-1 flex-col items-center gap-1 rounded-xl border px-1 py-2 ${
                st.done
                  ? "border-emerald-500/20 bg-emerald-500/[0.07]"
                  : "border-indigo-500/30 bg-indigo-500/[0.08]"
              }`}
            >
              {st.done ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-indigo-500 border-t-transparent" />
              )}
              <span className="text-[9px] font-semibold">{st.name}</span>
            </div>
            {i < stations.length - 1 && (
              <ArrowRight className="h-3 w-3 flex-shrink-0 text-gray-300 dark:text-gray-600" />
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        <Boxes className="h-3.5 w-3.5 text-gray-400" />
        Backflush automático de material por estación
      </div>
    </div>
  );
}

/* --- Mini-visual: consulta a CIDE (IA) --- */
function CideSnippet() {
  return (
    <div aria-hidden className="space-y-2">
      <div className="ml-auto w-fit max-w-[88%] rounded-2xl rounded-tr-sm bg-foreground px-3 py-1.5 text-[11px] font-medium text-background">
        ¿Por qué cayó el FPY en SMT-2 ayer?
      </div>
      <div className="flex max-w-[92%] items-start gap-2 rounded-2xl rounded-tl-sm border border-black/[0.06] bg-white/80 px-3 py-2 text-[11px] leading-relaxed text-gray-600 dark:border-white/10 dark:bg-white/[0.05] dark:text-gray-300">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-indigo-500" />
        <span>
          3 NCR del reel <span className="font-mono">L-88</span> (solder skips). El
          hold ya está activo; revisa el perfil de reflow.
        </span>
      </div>
    </div>
  );
}

export function LandingBento() {
  const reduce = useReducedMotion();
  const fade = (i: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-60px" },
          transition: { duration: 0.55, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] as const },
        };

  return (
    <section id="capabilities" className="relative scroll-mt-24 px-6 py-24">
      {/* Resplandor traslúcido detrás de la sección (movimiento sutil y continuo) */}
      <div
        aria-hidden
        className="hero-orb hero-orb-2 pointer-events-none absolute right-[8%] top-[12%] -z-10 h-[320px] w-[320px] opacity-40"
        style={{ background: "radial-gradient(circle at 50% 50%, #818cf8, transparent 70%)" }}
      />
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <span className={kicker}>Capacidades</span>
          <h2 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">
            No te lo contamos. Te lo enseñamos.
          </h2>
          <p className="mt-3 font-light text-gray-500 dark:text-gray-400">
            Cada pieza de la operación, viva y conectada a la misma base de datos.
            Esto es lo que pasa dentro del OS.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:auto-rows-[minmax(0,1fr)] md:grid-cols-3">
          {/* Plan → piso (grande) */}
          <motion.div {...fade(0)} className="md:col-span-2 md:row-span-2">
            <Link href="/dashboard/operador" className={`${tile} flex h-full flex-col`}>
              <span className={kicker}>Del plan al piso · en vivo</span>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                Publica la orden y míralo ejecutarse.
              </h3>
              <p className="mt-2 max-w-md text-sm font-light leading-relaxed text-gray-500 dark:text-gray-400">
                MES con poka-yoke, andon por estación y backflush de material. El
                plan deja de ser un PDF: es el piso, en tiempo real.
              </p>
              <div className="mt-auto pt-7">
                <PlanToFloor />
              </div>
              <Cta>Abrir terminal de operador</Cta>
            </Link>
          </motion.div>

          {/* OEE */}
          <motion.div {...fade(1)}>
            <Link href="/dashboard/mission-control" className={`${tile} flex h-full items-center gap-4`}>
              <OeeRing pct={94} />
              <div>
                <span className={kicker}>Torre de control</span>
                <h3 className="mt-1 text-lg font-semibold tracking-tight">
                  KPIs en vivo
                </h3>
                <p className="mt-1 text-xs font-light leading-relaxed text-gray-500 dark:text-gray-400">
                  Readiness, OEE y andons en una pantalla.
                </p>
              </div>
            </Link>
          </motion.div>

          {/* e-kanban */}
          <motion.div {...fade(2)}>
            <Link href="/dashboard/inventory" className={`${tile} flex h-full flex-col`}>
              <div className="mb-3 flex items-center gap-2">
                <Boxes className="h-4 w-4 text-gray-400" />
                <span className={kicker}>Inventario · e-kanban</span>
              </div>
              <KanbanCards />
              <Cta>Surtido a línea</Cta>
            </Link>
          </motion.div>

          {/* Trazabilidad (ancho) */}
          <motion.div {...fade(3)} className="md:col-span-2">
            <Link href="/dashboard/quality" className={`${tile} flex h-full flex-col`}>
              <div className="mb-4 flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-gray-400" />
                <span className={kicker}>Trazabilidad nativa</span>
              </div>
              <h3 className="mb-4 text-lg font-semibold tracking-tight">
                Cada unidad cuenta su historia: serie, lote y as-built.
              </h3>
              <TraceTimeline />
              <Cta>Ver genealogía</Cta>
            </Link>
          </motion.div>

          {/* Calidad / MRB */}
          <motion.div {...fade(4)}>
            <Link href="/dashboard/floor-quality" className={`${tile} flex h-full flex-col justify-between`}>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <span className={kicker}>Calidad · MRB</span>
              </div>
              <div aria-hidden className="my-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  HOLD · WO-4821
                </span>
                <span className="text-[11px] text-gray-400">cuarentena</span>
              </div>
              <p className="text-xs font-light leading-relaxed text-gray-500 dark:text-gray-400">
                Un hold bloquea el consumo del lote hasta la disposición MRB.
              </p>
            </Link>
          </motion.div>

          {/* CIDE / IA (ancho) */}
          <motion.div {...fade(5)} className="md:col-span-2">
            <Link href="/dashboard/intelligence" className={`${tile} flex h-full flex-col`}>
              <div className="mb-3 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-indigo-500" />
                <span className={kicker}>CIDE · IA con contexto</span>
              </div>
              <CideSnippet />
              <Cta>Preguntarle a tu planta</Cta>
            </Link>
          </motion.div>

          {/* Office / nativo */}
          <motion.div {...fade(6)}>
            <Link href="/dashboard/office" className={`${tile} flex h-full flex-col justify-between`}>
              <span className={kicker}>Office nativo</span>
              <div aria-hidden className="my-4 flex gap-1.5">
                {["Docs", "Sheets", "Slides"].map((d) => (
                  <span
                    key={d}
                    className="flex-1 rounded-lg border border-black/[0.06] bg-white/80 py-2 text-center text-[10px] font-semibold dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    {d}
                  </span>
                ))}
              </div>
              <p className="text-xs font-light leading-relaxed text-gray-500 dark:text-gray-400">
                SOPs y reportes conectados al trabajo real, dentro del OS.
              </p>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
