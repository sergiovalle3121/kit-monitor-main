"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AmbientBackground } from "@/components/AmbientBackground";
import { EntranceSweep } from "@/components/EntranceSweep";
import { Reveal } from "@/components/Reveal";
import { LandingMockup } from "@/components/landing/LandingMockup";
import { LandingBento } from "@/components/landing/LandingBento";
import { IconTile } from "@/components/ui/IconTile";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
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
  id: string;
  domain: DomainKey;
  icon?: LucideIcon;
  href: string;
}

// Datos estructurales (dominio/icono/ruta). El texto visible (name/tag/value)
// vive en messages/{en,es}/landing.json bajo `galaxy.programs.<id>`.
const PROGRAMS: Program[] = [
  { id: "controlTower", domain: "planning", icon: Gauge, href: "/dashboard/mission-control" },
  { id: "mes", domain: "mes", href: "/dashboard/operador" },
  { id: "erp", domain: "erp", href: "/dashboard/erp" },
  { id: "inventory", domain: "inventory", href: "/dashboard/inventory" },
  { id: "quality", domain: "quality", href: "/dashboard/quality" },
  { id: "cad", domain: "engineering", icon: Box, href: "/dashboard/line-engineering" },
  { id: "ai", domain: "plan", icon: Sparkles, href: "/dashboard/intelligence" },
];

/**
 * Flujo de extremo a extremo: AXOS cubre toda la operación, del diseño al
 * embarque. Las etiquetas viven en `flow.steps.<id>`.
 */
const FLOW: { id: string; domain: DomainKey }[] = [
  { id: "engineering", domain: "engineering" },
  { id: "planning", domain: "planning" },
  { id: "materials", domain: "staging" },
  { id: "production", domain: "production" },
  { id: "quality", domain: "quality" },
  { id: "logistics", domain: "logistics" },
];

/** Diferenciadores reales. El texto vive en `why.items.<id>`. */
const DIFFERENTIATORS: { id: string; icon: typeof Database }[] = [
  { id: "db", icon: Database },
  { id: "planToFloor", icon: Workflow },
  { id: "traceability", icon: Fingerprint },
  { id: "ai", icon: Sparkles },
];

interface Feature {
  id: string;
  icon: React.ReactNode;
  href: string;
}

// El texto (title/desc/details) vive en `platform.features.<id>`.
const FEATURES: Feature[] = [
  { id: "controlTower", icon: <LayoutDashboard />, href: "/dashboard/mission-control" },
  { id: "inventory", icon: <Box />, href: "/dashboard/inventory" },
  { id: "mes", icon: <Activity />, href: "/dashboard/operador" },
  { id: "quality", icon: <Zap />, href: "/dashboard/floor-quality" },
  { id: "architecture", icon: <Cpu />, href: "/dashboard/engineering" },
  { id: "roles", icon: <Layers />, href: "/dashboard/settings/users" },
];

type Toast = { id: number; kind: "info" | "success" | "error"; text: string };

export default function Home() {
  const router = useRouter();
  const reduce = useReducedMotion();
  const t = useTranslations("landing");
  const [activeFeature, setActiveFeature] = useState<Feature | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Listas que viven como arrays en el catálogo (t.raw devuelve el array crudo).
  const heroPills = t.raw("heroPills") as string[];
  const solutionItems = t.raw("solutions.items") as {
    title: string;
    summary: string;
    points: string[];
  }[];
  const enterpriseItems = t.raw("enterprise.items") as {
    title: string;
    body: string;
  }[];
  const faqItems = t.raw("faq.items") as { q: string; a: string }[];

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
      pushToast("success", t("toast.demoStarted"));
      setTimeout(() => router.push("/dashboard"), 600);
    } catch {
      pushToast("error", t("toast.demoError"));
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
              {t("nav.programs")}
            </button>
            <button
              onClick={() => scrollTo("why")}
              className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              {t("nav.why")}
            </button>
            <button
              onClick={() => scrollTo("capabilities")}
              className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              {t("nav.modules")}
            </button>
            <button
              onClick={() => scrollTo("solutions")}
              className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              {t("nav.solutions")}
            </button>
            <button
              onClick={() => scrollTo("enterprise")}
              className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              {t("nav.enterprise")}
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher variant="compact" className="hidden sm:inline-flex" />
            <Link
              href="/login"
              className="px-4 py-2 rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 transition-all"
            >
              {t("nav.login")}
            </Link>
            <Link
              href="/login?register=1"
              className="px-5 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-medium hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/10 dark:shadow-white/5"
            >
              {t("nav.signup")}
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
            <span>{t("hero.badge")}</span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tighter mb-7 leading-[1.02]"
          >
            {t("hero.titleLead")}{" "}
            <span className="text-gradient-title">{t("hero.titleHighlight")}</span>.
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-lg md:text-2xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-9 font-light leading-relaxed"
          >
            {t("hero.subtitle")}
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
              {t("hero.ctaStart")}
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
              {t("hero.ctaDemo")}
            </motion.button>
          </motion.div>

          <motion.p variants={itemVariants} className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            {t("hero.demoNote")}
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
            {[...heroPills, ...heroPills].map((p, i) => (
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
              {t("flow.eyebrow")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">
              {t("flow.title")}
            </h2>
            <p className="text-gray-500 mt-3 font-light max-w-xl mx-auto">
              {t("flow.subtitle")}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-6">
            {FLOW.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-2 w-24">
                  <IconTile domain={s.domain} size={52} />
                  <span className="text-xs font-medium text-center leading-tight">
                    {t(`flow.steps.${s.id}`)}
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
              {t("galaxy.eyebrow")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">
              {t("galaxy.title")}
            </h2>
            <p className="text-gray-500 mt-3 font-light max-w-xl mx-auto">
              {t("galaxy.subtitle")}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PROGRAMS.map((p) => (
              <MotionLink
                key={p.id}
                href={p.href}
                whileHover={reduce ? undefined : { y: -4 }}
                whileTap={reduce ? undefined : { scale: 0.98 }}
                className="group flex flex-col gap-4 p-6 rounded-3xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 hover:shadow-lg hover:shadow-black/[0.04] transition-all"
              >
                <div className="flex items-center justify-between">
                  <IconTile domain={p.domain} icon={p.icon} size={46} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    {t(`galaxy.programs.${p.id}.tag`)}
                  </span>
                </div>
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-1">
                    {t(`galaxy.programs.${p.id}.name`)}
                    <ChevronRight className="w-4 h-4 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-light leading-relaxed mt-1">
                    {t(`galaxy.programs.${p.id}.value`)}
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
              {t("platform.eyebrow")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">
              {t("platform.title")}
            </h2>
            <p className="text-gray-500 mt-3 font-light">
              {t("platform.subtitle")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((feature) => (
              <motion.button
                key={feature.id}
                onClick={() => setActiveFeature(feature)}
                whileHover={{ y: -5 }}
                whileTap={{ scale: 0.98 }}
                className="text-left p-8 rounded-3xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 transition-all group cursor-pointer"
              >
                <div className="w-12 h-12 bg-white dark:bg-white/10 rounded-xl flex items-center justify-center mb-6 shadow-sm border border-gray-100 dark:border-white/10 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{t(`platform.features.${feature.id}.title`)}</h3>
                <p className="text-gray-500 dark:text-gray-400 font-light leading-relaxed">
                  {t(`platform.features.${feature.id}.desc`)}
                </p>
                <p className="mt-4 text-xs font-bold text-black dark:text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  {t("platform.viewDetail")} <ChevronRight className="w-3 h-3" />
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
              {t("why.eyebrow")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">
              {t("why.title")}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {DIFFERENTIATORS.map((d) => {
              const Icon = d.icon;
              return (
                <div
                  key={d.id}
                  className="flex items-start gap-4 p-6 rounded-3xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5"
                >
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white dark:bg-white/10 border border-gray-100 dark:border-white/10 text-gray-700 dark:text-gray-200">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold">{t(`why.items.${d.id}.title`)}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-light leading-relaxed mt-1">
                      {t(`why.items.${d.id}.body`)}
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
              {t("solutions.eyebrow")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">
              {t("solutions.title")}
            </h2>
            <p className="text-gray-500 mt-3 font-light">
              {t("solutions.subtitle")}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {solutionItems.map((s) => (
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
            {t("enterprise.eyebrow")}
          </span>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2 mb-6">
            {t("enterprise.title")}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 font-light max-w-2xl mx-auto mb-10">
            {t("enterprise.body")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            {enterpriseItems.map((x) => (
              <div
                key={x.title}
                className="p-6 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5"
              >
                <h4 className="font-semibold mb-2 text-sm">{x.title}</h4>
                <p className="text-gray-500 dark:text-gray-400 text-xs font-light">
                  {x.body}
                </p>
              </div>
            ))}
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 mt-10 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-medium hover:scale-105 active:scale-95 transition-all"
          >
            {t("enterprise.cta")} <ChevronRight className="w-4 h-4" />
          </Link>
        </Reveal>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-6 scroll-mt-24">
        <Reveal className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
              {t("faq.eyebrow")}
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">
              {t("faq.title")}
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/10 rounded-3xl border border-gray-100 dark:border-white/5 bg-white/80 dark:bg-white/5">
            {faqItems.map((faq) => (
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
                {t("finalCta.eyebrow")}
              </span>
              <h2 className="mt-3 text-4xl md:text-6xl font-bold tracking-tight">
                {t("finalCta.title")}
              </h2>
              <p className="mt-5 max-w-2xl text-white/65 dark:text-black/60 font-light leading-relaxed">
                {t("finalCta.body")}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-bold text-black dark:bg-black dark:text-white hover:scale-[1.02] active:scale-[0.98] transition"
              >
                {t("finalCta.login")} <ChevronRight className="h-4 w-4" />
              </Link>
              <button
                onClick={startDemo}
                disabled={demoLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-6 py-4 text-sm font-bold text-white/80 hover:bg-white/10 disabled:opacity-60 dark:border-black/15 dark:text-black/70 dark:hover:bg-black/10 transition"
              >
                {demoLoading ? t("finalCta.demoPreparing") : t("finalCta.demoIdle")}
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
                {t("footer.tagline")}
              </p>
            </div>

            {/* Producto */}
            <FooterCol title={t("footer.product")}>
              <FooterLink onClick={() => scrollTo("galaxy")}>
                {t("footer.links.programs")}
              </FooterLink>
              <FooterLink onClick={() => scrollTo("flow")}>
                {t("footer.links.flow")}
              </FooterLink>
              <FooterLink onClick={() => scrollTo("capabilities")}>{t("footer.links.modules")}</FooterLink>
              <FooterLink onClick={() => scrollTo("solutions")}>
                {t("footer.links.solutions")}
              </FooterLink>
              <FooterLink onClick={() => scrollTo("faq")}>{t("footer.links.faq")}</FooterLink>
            </FooterCol>

            {/* Empresa */}
            <FooterCol title={t("footer.company")}>
              <FooterLink onClick={() => scrollTo("why")}>
                {t("footer.links.whyAxos")}
              </FooterLink>
              <FooterLink onClick={() => scrollTo("enterprise")}>
                {t("footer.links.enterprise")}
              </FooterLink>
            </FooterCol>

            {/* Acceso */}
            <FooterCol title={t("footer.access")}>
              <FooterLink href="/login">{t("footer.links.login")}</FooterLink>
              <FooterLink href="/login?register=1">{t("footer.links.signup")}</FooterLink>
              <FooterLink onClick={startDemo}>{t("footer.links.demo")}</FooterLink>
            </FooterCol>
          </div>

          <div className="mt-12 pt-6 border-t border-gray-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-light">
              {t("footer.copyright")}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-light">
              {t("footer.stack")}
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
                  {t(`platform.features.${activeFeature.id}.title`)}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 font-light text-sm leading-relaxed mb-6">
                  {t(`platform.features.${activeFeature.id}.details`)}
                </p>
                <div className="flex gap-3">
                  <Link
                    href={activeFeature.href}
                    className="flex-1 px-4 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition"
                  >
                    {t("platform.openModule")} <ChevronRight className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => setActiveFeature(null)}
                    className="px-4 py-3 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition"
                  >
                    {t("platform.close")}
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
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium ${
                toast.kind === "success"
                  ? "bg-green-50 border-green-100 text-green-700 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-300"
                  : toast.kind === "error"
                    ? "bg-red-50 border-red-100 text-red-700 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300"
                    : "bg-white border-gray-100 text-black dark:bg-[#111] dark:border-white/10 dark:text-white"
              }`}
            >
              {toast.kind === "success" && <CheckCircle2 className="w-4 h-4" />}
              {toast.kind === "error" && <AlertCircle className="w-4 h-4" />}
              <span>{toast.text}</span>
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
