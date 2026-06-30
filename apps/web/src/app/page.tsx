"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { EntranceSweep } from "@/components/EntranceSweep";
import { Reveal } from "@/components/Reveal";
import { LandingMockup } from "@/components/landing/LandingMockup";
import { LandingBento } from "@/components/landing/LandingBento";
import { IconTile } from "@/components/ui/IconTile";
import type { DomainKey } from "@/lib/design/domains";
import { hoverLift, press } from "@/lib/motion";
import {
  Activity,
  Box,
  ChevronRight,
  Cpu,
  Database,
  Fingerprint,
  Gauge,
  Layers,
  LayoutDashboard,
  Sparkles,
  Workflow,
  Zap,
  X,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";

const MotionLink = motion.create(Link);

/**
 * Galaxia de producto: los programas reales de AXOS presentados como las
 * "apps" de un sistema operativo industrial. Cada loseta usa la firma de
 * dominio (IconTile) y enlaza a su ruta real — sin inventar UI ni datos.
 */
interface Program {
  domain: DomainKey;
  icon?: LucideIcon;
  name: string;
  tag: string;
  value: string;
  href: string;
}

const PROGRAMS: Program[] = [
  {
    domain: "planning",
    icon: Gauge,
    name: "Control Tower",
    tag: "Mando",
    value: "Readiness, OEE, andons y holds en vivo.",
    href: "/dashboard/mission-control",
  },
  {
    domain: "mes",
    name: "MES · Piso",
    tag: "Ejecución",
    value: "Poka-yoke, backflush y andon por estación.",
    href: "/dashboard/operador",
  },
  {
    domain: "erp",
    name: "ERP · Supply Chain",
    tag: "ERP",
    value: "Compras, materiales y finanzas integradas.",
    href: "/dashboard/erp",
  },
  {
    domain: "inventory",
    name: "Inventario",
    tag: "Materiales",
    value: "Kitting, e-kanban y conteos cíclicos.",
    href: "/dashboard/inventory",
  },
  {
    domain: "quality",
    name: "Calidad · MRB",
    tag: "Calidad",
    value: "Holds, cuarentena y disposición MRB.",
    href: "/dashboard/quality",
  },
  {
    domain: "office",
    name: "Office",
    tag: "Productividad",
    value: "Docs, Sheets y Slides nativos.",
    href: "/dashboard/office",
  },
  {
    domain: "engineering",
    icon: Box,
    name: "CAD · Layout",
    tag: "Ingeniería",
    value: "Layout de línea unificado 2D ⇄ 3D.",
    href: "/dashboard/line-engineering",
  },
  {
    domain: "plan",
    icon: Sparkles,
    name: "AI · CIDE",
    tag: "Inteligencia",
    value: "Tu analista de datos con IA propia.",
    href: "/dashboard/intelligence",
  },
];

/** Píldoras de breadth en el hero — comunica el alcance del OS de un vistazo. */
const HERO_PILLS = [
  "ERP",
  "MES · Piso",
  "Calidad · MRB",
  "Inventario · e-kanban",
  "CAD 2D ⇄ 3D",
  "Office nativo",
  "CIDE · IA",
  "Trazabilidad",
  "MRP",
  "Backflush",
  "Andon en vivo",
  "Genealogía",
];

const FAQS = [
  {
    q: "¿AXOS OS reemplaza a un ERP o a un MES?",
    a: "La ambición del producto es operar como ambos en una plataforma industrial: ERP para materiales, costos y supply chain; MES para piso, ejecución, calidad y trazabilidad.",
  },
  {
    q: "¿La demo usa datos reales de clientes?",
    a: "No. La demo pública debe tratarse como un entorno de muestra y de solo lectura; no se muestran clientes, certificaciones ni métricas comerciales inventadas.",
  },
  {
    q: "¿Cómo se controla el acceso?",
    a: "El login público existe, pero las cuentas nuevas quedan sujetas a aprobación administrativa y a roles antes de entrar a la consola.",
  },
  {
    q: "¿AXOS depende de integraciones externas para contar su historia?",
    a: "La landing describe capacidades nativas del repositorio: módulos de ERP, MES, Office, CAD, calidad, analítica e IA ya expuestos en rutas internas.",
  },
];

/**
 * Flujo de extremo a extremo: AXOS cubre toda la operación, del diseño al
 * embarque, en un solo sistema. Usa firmas de dominio reales.
 */
const FLOW: { domain: DomainKey; label: string }[] = [
  { domain: "engineering", label: "Diseño · NPI" },
  { domain: "planning", label: "Planeación" },
  { domain: "staging", label: "Materiales" },
  { domain: "production", label: "Producción" },
  { domain: "quality", label: "Calidad" },
  { domain: "logistics", label: "Logística" },
];

/** Diferenciadores reales (sin métricas inventadas ni logos de terceros). */
const DIFFERENTIATORS: {
  icon: typeof Database;
  title: string;
  body: string;
}[] = [
  {
    icon: Database,
    title: "Una sola base de datos",
    body: "Del diseño al embarque sin integraciones frágiles ni silos entre departamentos.",
  },
  {
    icon: Workflow,
    title: "Del plan al piso, en vivo",
    body: "Publica el plan y ejecútalo con MES, backflush y bloqueos por calidad en tiempo real.",
  },
  {
    icon: Fingerprint,
    title: "Trazabilidad nativa",
    body: "Serie/lote, as-built y where-used listos para auditorías de cliente y contención.",
  },
  {
    icon: Sparkles,
    title: "IA con contexto de tu planta",
    body: "CIDE entiende todos tus módulos y datos — no es un chatbot genérico pegado encima.",
  },
];

interface Feature {
  icon: React.ReactNode;
  title: string;
  desc: string;
  details: string;
  href: string;
}

const FEATURES: Feature[] = [
  {
    icon: <LayoutDashboard />,
    title: "Torre de control",
    desc: "Visibilidad de la operación con KPIs en vivo: readiness, OEE, throughput y alertas.",
    details:
      "Mission Control y la torre de línea consolidan readiness, plan vs real, andons, holds y estado por línea en un solo panel. Para directores y supervisores.",
    href: "/dashboard/mission-control",
  },
  {
    icon: <Box />,
    title: "Inventario y surtido",
    desc: "Inventario, kitting y reposición e-kanban a línea, con alertas de faltante.",
    details:
      "Surtido por estación desde el ruteo, reposición pull (e-kanban) y conteos cíclicos. Conectado a la ejecución del piso.",
    href: "/dashboard/inventory",
  },
  {
    icon: <Activity />,
    title: "Ejecución en piso (MES)",
    desc: "Operador MES: poka-yoke, backflush de material y andon por estación.",
    details:
      "El operador escanea, el sistema valida el NP (poka-yoke), descuenta material (backflush) y registra el avance. Bloqueos por calidad, skill y faltante.",
    href: "/dashboard/operador",
  },
  {
    icon: <Zap />,
    title: "Calidad y MRB",
    desc: "Holds que ponen el lote en cuarentena y bloquean el consumo, con flujo MRB.",
    details:
      "Captura de rechazo → cuarentena → revisión MRB → disposición (use-as-is/rework/scrap/RTV) con firma y where-used. Bloquea el consumo de la WO retenida.",
    href: "/dashboard/floor-quality",
  },
  {
    icon: <Cpu />,
    title: "Arquitectura",
    desc: "NestJS + Next.js, TypeORM y diseño multi-tenant. Monolito modular.",
    details:
      "Backend NestJS modular, frontend Next.js, TypeORM y arquitectura preparada para multi-tenant (aislamiento por organización).",
    href: "/dashboard/engineering",
  },
  {
    icon: <Layers />,
    title: "Roles por puesto",
    desc: "Aislamiento por organización con roles y permisos por puesto del piso.",
    details:
      "Roles de planta (operador, materialista, supervisor, planeación, calidad/MRB, ingeniería industrial) con permisos por acción y scope por planta/línea.",
    href: "/dashboard/settings/users",
  },
];

type Toast = { id: number; kind: "info" | "success" | "error"; text: string };

export default function Home() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  function pushToast(kind: Toast["kind"], text: string) {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function startDemo() {
    setDemoLoading(true);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      if (!res.ok) throw new Error();
      pushToast("success", "Demo iniciada (sesión de 30 min, solo lectura).");
      setTimeout(() => router.push("/dashboard"), 600);
    } catch {
      pushToast("error", "No se pudo iniciar la demo. Intenta de nuevo.");
      setDemoLoading(false);
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <main className="relative min-h-screen selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
      {/* Fondo ambiental (aurora + red de nodos en movimiento) detrás del hero */}
      <AmbientBackground network />
      {/* Ola de luz de izquierda a derecha, una sola pasada al cargar */}
      <EntranceSweep />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 premium-glass px-6 py-4 flex justify-between items-center border-b border-gray-200/50 dark:border-white/5 backdrop-blur-md bg-white/70 dark:bg-black/40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
            <Layers className="w-5 h-5 text-white dark:text-black" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            AXOS <span className="font-light text-gray-500">OS</span>
          </span>
        </div>
        <div className="flex items-center gap-8">
          <div className="hidden md:flex gap-6 text-sm font-medium text-gray-600 dark:text-gray-400">
            <button
              onClick={() => scrollTo("galaxy")}
              className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              Programs
            </button>
            <button
              onClick={() => scrollTo("why")}
              className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              Por qué
            </button>
            <button
              onClick={() => scrollTo("capabilities")}
              className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              Módulos
            </button>
            <button
              onClick={() => scrollTo("solutions")}
              className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              Solutions
            </button>
            <button
              onClick={() => scrollTo("enterprise")}
              className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              Enterprise
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className="px-4 py-2 rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/login?register=1"
              className="px-5 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-medium hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/10 dark:shadow-white/5"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative isolate overflow-hidden px-6 pt-32 pb-16">
        {/* Aurora viva del hero — orbes traslúcidos que derivan + malla cónica
            girando lentísimo (estilo OpenAI/Google). Decorativo. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="hero-conic absolute left-1/2 top-[-22%] h-[820px] w-[820px] -translate-x-1/2" />
          <div
            className="hero-orb hero-orb-1 absolute left-[6%] top-[4%] h-[360px] w-[360px]"
            style={{ background: "radial-gradient(circle at 35% 35%, #6366f1, transparent 70%)" }}
          />
          <div
            className="hero-orb hero-orb-2 absolute right-[4%] top-[8%] h-[340px] w-[340px]"
            style={{ background: "radial-gradient(circle at 60% 40%, #a855f7, transparent 70%)" }}
          />
          <div
            className="hero-orb hero-orb-3 absolute left-[34%] top-[30%] h-[440px] w-[440px]"
            style={{ background: "radial-gradient(circle at 50% 50%, #22d3ee, transparent 72%)" }}
          />
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="relative mx-auto max-w-4xl text-center"
        >
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/70 dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/10 backdrop-blur text-xs font-medium text-gray-600 dark:text-gray-300 mb-8 shadow-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span>Industrial OS · ERP · MES · Office · CAD · IA — en una sola plataforma</span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter mb-7 leading-[1.02]"
          >
            El sistema operativo que corre{" "}
            <span className="text-gradient-title">toda tu planta</span>.
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-lg md:text-2xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-9 font-light leading-relaxed"
          >
            ERP, MES, calidad, inventario, CAD e IA en un solo lugar. Del diseño
            al embarque, sobre una base de datos común — sin silos ni
            integraciones frágiles, con la operación completa en una pantalla.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-3 justify-center items-center"
          >
            <MotionLink
              href="/login"
              whileHover={reduce ? undefined : hoverLift}
              whileTap={reduce ? undefined : press}
              className="group px-7 py-3.5 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-base font-semibold flex items-center gap-2 shadow-xl shadow-indigo-500/15 hover:shadow-2xl transition-all"
            >
              Comenzar
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </MotionLink>
            <motion.button
              onClick={startDemo}
              disabled={demoLoading}
              whileHover={reduce ? undefined : hoverLift}
              whileTap={reduce ? undefined : press}
              className="px-7 py-3.5 rounded-2xl text-base font-semibold border border-black/10 dark:border-white/15 bg-white/70 dark:bg-white/[0.04] backdrop-blur hover:bg-white dark:hover:bg-white/[0.08] transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {demoLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-black dark:border-t-white rounded-full animate-spin" />
              ) : (
                <PlayCircle className="w-5 h-5" />
              )}
              Ver demo en vivo
            </motion.button>
          </motion.div>

          <motion.p variants={itemVariants} className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Demo de solo lectura · sesión de 30 min · sin tarjeta
          </motion.p>
        </motion.div>

        {/* Mockup de producto flotante — "muestra el producto" */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto mt-16 max-w-5xl"
        >
          <div aria-hidden className="product-halo absolute inset-x-12 -bottom-8 top-16 -z-10" />
          <div className={reduce ? undefined : "float-slow"}>
            <LandingMockup />
          </div>
        </motion.div>

        {/* Marquesina de capacidades — el alcance del OS, en movimiento */}
        <div className="marquee-mask relative mx-auto mt-16 max-w-5xl overflow-hidden">
          <div className="marquee-track flex w-max items-center gap-3">
            {[...HERO_PILLS, ...HERO_PILLS].map((p, i) => (
              <span
                key={i}
                className="whitespace-nowrap rounded-full border border-black/[0.06] dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Flujo de extremo a extremo — AXOS cubre toda la operación */}
      <section
        id="flow"
        className="py-20 px-6 bg-white dark:bg-black/40 scroll-mt-24"
      >
        <Reveal className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              De extremo a extremo
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">
              Del diseño al embarque, un solo sistema.
            </h2>
            <p className="text-gray-500 mt-3 font-light max-w-xl mx-auto">
              Cada etapa de la operación vive en la misma plataforma — sin
              saltar entre apps ni perder el hilo de la información.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-6">
            {FLOW.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-2 w-24">
                  <IconTile domain={s.domain} size={52} />
                  <span className="text-xs font-medium text-center leading-tight">
                    {s.label}
                  </span>
                </div>
                {i < FLOW.length - 1 && (
                  <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Product Galaxy — los programas de AXOS como apps de un OS industrial */}
      <section id="galaxy" className="py-20 px-6 scroll-mt-24">
        <Reveal className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              El sistema operativo
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">
              Un OS, todos los programas.
            </h2>
            <p className="text-gray-500 mt-3 font-light max-w-xl mx-auto">
              Cada departamento es un programa nativo del mismo sistema — no
              apps sueltas pegadas con integraciones.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PROGRAMS.map((p) => (
              <MotionLink
                key={p.name}
                href={p.href}
                whileHover={reduce ? undefined : { y: -4 }}
                whileTap={reduce ? undefined : { scale: 0.98 }}
                className="group flex flex-col gap-4 p-6 rounded-3xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 hover:shadow-lg hover:shadow-black/[0.04] transition-all"
              >
                <div className="flex items-center justify-between">
                  <IconTile domain={p.domain} icon={p.icon} size={46} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {p.tag}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-1">
                    {p.name}
                    <ChevronRight className="w-4 h-4 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-light leading-relaxed mt-1">
                    {p.value}
                  </p>
                </div>
              </MotionLink>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Capacidades — bento visual que "muestra" el producto (no texto seco) */}
      <LandingBento />

      {/* Platform / Features Grid */}
      <section
        id="platform"
        className="py-20 px-6 bg-white dark:bg-black/40 scroll-mt-24"
      >
        <Reveal className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              Platform
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">
              Una sola plataforma. Toda la operación.
            </h2>
            <p className="text-gray-500 mt-3 font-light">
              Haz click en cualquier módulo para ver el detalle.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((feature, i) => (
              <motion.button
                key={i}
                onClick={() => setActiveFeature(feature)}
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.98 }}
                className="text-left p-8 rounded-3xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-all group cursor-pointer"
              >
                <div className="w-12 h-12 bg-white dark:bg-white/10 rounded-xl flex items-center justify-center mb-6 shadow-sm border border-gray-100 dark:border-white/10 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 font-light leading-relaxed">
                  {feature.desc}
                </p>
                <p className="mt-4 text-xs font-bold text-black dark:text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  Ver detalle <ChevronRight className="w-3 h-3" />
                </p>
              </motion.button>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Diferenciadores — por qué AXOS es distinto */}
      <section id="why" className="py-20 px-6 scroll-mt-24">
        <Reveal className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              Por qué AXOS
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">
              No es otra suite. Es un sistema operativo.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {DIFFERENTIATORS.map((d) => {
              const Icon = d.icon;
              return (
                <div
                  key={d.title}
                  className="flex items-start gap-4 p-6 rounded-3xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5"
                >
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-white/10 border border-gray-100 dark:border-white/10 text-gray-700 dark:text-gray-200">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{d.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-light leading-relaxed mt-1">
                      {d.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* Solutions — acordeón colapsable (texto que se "explica para abajo") */}
      <section id="solutions" className="py-20 px-6 scroll-mt-24">
        <Reveal className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              Solutions
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">
              Pensado para manufactura por contrato.
            </h2>
            <p className="text-gray-500 mt-3 font-light">
              Despliega cada capacidad para ver qué hace, de verdad.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {[
              {
                title: "Trazabilidad y genealogía",
                summary:
                  "Serie/lote por unidad, as-built y where-used listos para auditoría.",
                points: [
                  "Genealogía cuna-a-tumba: lote/reel por NP, estación, operador y hora.",
                  "Where-used inverso para contención cuando un lote sale dudoso.",
                  "Certificado de Conformancia (CoC) por orden o por embarque.",
                ],
              },
              {
                title: "Del plan al piso",
                summary:
                  "Publica la WO, surte material a estación y ejecútala con backflush en vivo.",
                points: [
                  "Poka-yoke por NP y validaciones de skill/calidad por estación.",
                  "Backflush automático de material al confirmar avance.",
                  "Andon y holds que bloquean el consumo del lote retenido.",
                ],
              },
              {
                title: "BOM e ingeniería",
                summary:
                  "Ruteo por modelo, materiales por estación con factor de uso y revisiones.",
                points: [
                  "Estructura de producto y ruteo por modelo, versionados.",
                  "Materiales por estación con factor de uso para el backflush.",
                  "Layout de línea 2D ⇄ 3D para diseñar el flujo antes de ejecutarlo.",
                ],
              },
            ].map((s) => (
              <details
                key={s.title}
                className="group rounded-3xl border border-gray-100 dark:border-white/5 bg-white/80 dark:bg-white/5 px-6 py-5 open:bg-gray-50/70 dark:open:bg-white/[0.07] transition-colors"
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">
                      {s.title}
                    </h3>
                    <p className="mt-1 text-sm font-light text-gray-500 dark:text-gray-400">
                      {s.summary}
                    </p>
                  </div>
                  <span className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 transition-transform group-open:rotate-90">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </summary>
                <ul className="mt-4 space-y-2.5 border-t border-gray-100 dark:border-white/5 pt-4">
                  {s.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2.5 text-sm font-light text-gray-600 dark:text-gray-300"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                      {p}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Enterprise Section */}
      <section
        id="enterprise"
        className="py-20 px-6 bg-white dark:bg-black/40 scroll-mt-24"
      >
        <Reveal className="max-w-4xl mx-auto text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            Enterprise
          </span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2 mb-6">
            Seguridad y control.
          </h2>
          <p className="text-gray-500 dark:text-gray-400 font-light max-w-2xl mx-auto mb-10">
            El acceso a la consola requiere aprobación del administrador. Las
            cuentas creadas quedan en cola hasta su validación. La sesión es
            firmada (HMAC-SHA256) y se almacena en cookie HttpOnly.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {[
              {
                t: "Aprobación de cuentas",
                d: "Los nuevos registros notifican al admin y quedan pendientes.",
              },
              {
                t: "Roles granulares",
                d: "Admin, Engineering, Production, Quality, Inventory, Finance.",
              },
              {
                t: "Sesiones firmadas",
                d: "Cookies HttpOnly + firma HMAC con expiración configurable.",
              },
            ].map((x) => (
              <div
                key={x.t}
                className="p-6 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5"
              >
                <h4 className="font-semibold mb-2 text-sm">{x.t}</h4>
                <p className="text-gray-500 dark:text-gray-400 text-xs font-light">
                  {x.d}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 mt-10 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-medium hover:scale-105 active:scale-95 transition-all"
          >
            Solicitar acceso <ChevronRight className="w-4 h-4" />
          </Link>
        </Reveal>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-6 scroll-mt-24">
        <Reveal className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              FAQ
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">
              Preguntas reales antes de entrar.
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/10 rounded-3xl border border-gray-100 dark:border-white/5 bg-white/80 dark:bg-white/5">
            {FAQS.map((faq) => (
              <details
                key={faq.q}
                className="group p-6 open:bg-gray-50/70 dark:open:bg-white/5 first:rounded-t-3xl last:rounded-b-3xl"
              >
                <summary className="cursor-pointer list-none font-semibold flex items-center justify-between gap-4">
                  {faq.q}
                  <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray-500 dark:text-gray-400 font-light">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-24">
        <Reveal className="max-w-6xl mx-auto overflow-hidden rounded-[2rem] border border-gray-100 dark:border-white/10 bg-black text-white dark:bg-white dark:text-black p-8 md:p-14 relative">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white,transparent_30%),radial-gradient(circle_at_80%_0%,white,transparent_24%)] dark:bg-[radial-gradient(circle_at_20%_20%,black,transparent_30%),radial-gradient(circle_at_80%_0%,black,transparent_24%)]" />
          <div className="relative grid gap-8 md:grid-cols-[1.4fr_0.6fr] md:items-end">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 dark:text-black/50">
                Siguiente paso
              </span>
              <h2 className="mt-3 text-4xl md:text-6xl font-bold tracking-tight">
                Entra al OS. Evalúa el flujo completo.
              </h2>
              <p className="mt-5 max-w-2xl text-white/65 dark:text-black/60 font-light leading-relaxed">
                Inicia sesión si ya tienes acceso, solicita cuenta para
                aprobación o abre la demo de solo lectura para recorrer la
                experiencia sin promesas infladas.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-bold text-black dark:bg-black dark:text-white hover:scale-[1.02] active:scale-[0.98] transition"
              >
                Iniciar sesión <ChevronRight className="h-4 w-4" />
              </Link>
              <button
                onClick={startDemo}
                disabled={demoLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-6 py-4 text-sm font-bold text-white/80 hover:bg-white/10 disabled:opacity-60 dark:border-black/15 dark:text-black/70 dark:hover:bg-black/10 transition"
              >
                {demoLoading ? "Preparando demo…" : "Ver demo de solo lectura"}
              </button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 dark:border-white/5 px-6 pt-16 pb-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {/* Marca */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center">
                  <Layers className="w-5 h-5 text-white dark:text-black" />
                </div>
                <span className="text-lg font-bold tracking-tight">
                  AXOS <span className="font-light text-gray-500">OS</span>
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-light max-w-[15rem]">
                El sistema operativo industrial para manufactura electrónica
                moderna.
              </p>
            </div>

            {/* Producto */}
            <FooterCol title="Producto">
              <FooterLink onClick={() => scrollTo("galaxy")}>
                Programas
              </FooterLink>
              <FooterLink onClick={() => scrollTo("flow")}>
                Flujo end-to-end
              </FooterLink>
              <FooterLink onClick={() => scrollTo("capabilities")}>Módulos</FooterLink>
              <FooterLink onClick={() => scrollTo("solutions")}>
                Soluciones
              </FooterLink>
              <FooterLink onClick={() => scrollTo("faq")}>FAQ</FooterLink>
            </FooterCol>

            {/* Empresa */}
            <FooterCol title="Empresa">
              <FooterLink onClick={() => scrollTo("why")}>
                Por qué AXOS
              </FooterLink>
              <FooterLink onClick={() => scrollTo("enterprise")}>
                Enterprise
              </FooterLink>
            </FooterCol>

            {/* Acceso */}
            <FooterCol title="Acceso">
              <FooterLink href="/login">Iniciar sesión</FooterLink>
              <FooterLink href="/login?register=1">Crear cuenta</FooterLink>
              <FooterLink onClick={startDemo}>Ver demo</FooterLink>
            </FooterCol>
          </div>

          <div className="mt-12 pt-6 border-t border-gray-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-light">
              © 2026 AXOS OS · Industrial Operating System
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-light">
              ERP · MES · Office · CAD · AI
            </p>
          </div>
        </div>
      </footer>

      {/* Feature modal */}
      <AnimatePresence>
        {activeFeature && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveFeature(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80]"
            />
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.96 }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed inset-0 z-[90] flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-white dark:bg-[#111] rounded-[2rem] max-w-md w-full p-8 shadow-2xl border border-gray-100 dark:border-white/10 pointer-events-auto">
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-gray-50 dark:bg-white/10 rounded-xl flex items-center justify-center border border-gray-100 dark:border-white/10">
                    {activeFeature.icon}
                  </div>
                  <button
                    onClick={() => setActiveFeature(null)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-2xl font-bold tracking-tight mb-3">
                  {activeFeature.title}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 font-light text-sm leading-relaxed mb-6">
                  {activeFeature.details}
                </p>
                <div className="flex gap-3">
                  <Link
                    href={activeFeature.href}
                    className="flex-1 px-4 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition"
                  >
                    Abrir módulo <ChevronRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => setActiveFeature(null)}
                    className="px-4 py-3 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium ${
                t.kind === "success"
                  ? "bg-green-50 border-green-100 text-green-700 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-300"
                  : t.kind === "error"
                    ? "bg-red-50 border-red-100 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300"
                    : "bg-white border-gray-100 text-black dark:bg-[#111] dark:border-white/10 dark:text-white"
              }`}
            >
              {t.kind === "success" && <CheckCircle2 className="w-4 h-4" />}
              {t.kind === "error" && <AlertCircle className="w-4 h-4" />}
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </main>
  );
}

/** Columna del footer: título de sección + enlaces. */
function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400 mb-4">
        {title}
      </h3>
      <ul className="flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

/** Enlace del footer: <Link> si trae href, <button> si trae onClick. */
function FooterLink({
  href,
  onClick,
  children,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const cls =
    "text-sm text-gray-500 dark:text-gray-400 font-light hover:text-black dark:hover:text-white transition-colors text-left";
  return (
    <li>
      {href ? (
        <Link href={href} className={cls}>
          {children}
        </Link>
      ) : (
        <button onClick={onClick} className={cls}>
          {children}
        </button>
      )}
    </li>
  );
}
