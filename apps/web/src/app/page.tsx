"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Box,
  ChevronRight,
  Cpu,
  Layers,
  LayoutDashboard,
  ShieldCheck,
  Zap,
  X,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
} from "lucide-react";


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
    title: "Control Tower",
    desc: "Full visibility of your global operations with real-time KPIs.",
    details:
      "Mission Control consolida OEE, throughput, alertas críticas y estado por planta en un único panel. Útil para directores y supervisores.",
    href: "/dashboard/mission-control",
  },
  {
    icon: <Box />,
    title: "Smart Inventory",
    desc: "Automated replenishment and shortage prediction driven by AI.",
    details:
      "Predicción de quiebres, sugerencias de re-orden y vista por SKU/material. Conectado a forecast y producción.",
    href: "/dashboard/inventory",
  },
  {
    icon: <Activity />,
    title: "MES Engine",
    desc: "High-precision manufacturing execution with millisecond latency.",
    details:
      "Trazabilidad por lote, tiempos de ciclo y eventos de máquina en tiempo real. Diseñado para piso de planta.",
    href: "/dashboard/production",
  },
  {
    icon: <Zap />,
    title: "Predictive Ops",
    desc: "Avoid line stops before they happen with Monte Carlo simulations.",
    details:
      "Simulaciones Monte Carlo sobre demanda y capacidad para anticipar paros de línea y reasignar recursos.",
    href: "/dashboard/forecast",
  },
  {
    icon: <Cpu />,
    title: "Core Architecture",
    desc: "NestJS & Next.js power a robust modular monolith.",
    details:
      "Backend NestJS modular, frontend Next.js 16, TypeORM y arquitectura preparada para multi-tenant.",
    href: "/dashboard/engineering",
  },
  {
    icon: <Layers />,
    title: "Multi-tenant",
    desc: "B2B SaaS ready from day one with enterprise-grade isolation.",
    details:
      "Aislamiento por organización, gestión de roles y permisos granulares. Listo para despliegue B2B.",
    href: "/dashboard/settings/users",
  },
];

type Toast = { id: number; kind: "info" | "success" | "error"; text: string };

export default function Home() {
  const router = useRouter();
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
    <main className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] selection:bg-black selection:text-white dark:selection:bg-white dark:selection:text-black">
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
              onClick={() => scrollTo("platform")}
              className="hover:text-black dark:hover:text-white transition-colors cursor-pointer"
            >
              Platform
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
          <Link
            href="/login"
            className="px-5 py-2 bg-black dark:bg-white text-white dark:text-black rounded-full text-sm font-medium hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/10 dark:shadow-white/5"
          >
            Launch Console
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="max-w-6xl mx-auto text-center"
        >
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-medium text-gray-600 dark:text-gray-400 mb-8"
          >
            <ShieldCheck className="w-3 h-3 text-green-500" />
            <span>Multi-tenant Enterprise Architecture</span>
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="text-6xl md:text-8xl font-bold tracking-tighter mb-8 leading-[1.1]"
          >
            Industrial Intelligence. <br />
            <span className="text-gray-400 dark:text-gray-600">Perfected.</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-12 font-light"
          >
            The next-generation Operating System for manufacturing. Real-time
            MES, intelligent ERP, and predictive logistics in a single premium
            experience.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Link
              href="/login"
              className="group px-8 py-4 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-lg font-medium flex items-center gap-2 hover:shadow-2xl transition-all"
            >
              Get Started
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <button
              onClick={startDemo}
              disabled={demoLoading}
              className="px-8 py-4 border border-gray-200 dark:border-white/10 rounded-2xl text-lg font-medium hover:bg-gray-50 dark:hover:bg-white/5 transition-all flex items-center gap-2 disabled:opacity-60"
            >
              {demoLoading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-black dark:border-t-white rounded-full animate-spin" />
              ) : (
                <PlayCircle className="w-5 h-5" />
              )}
              View Demo
            </button>
          </motion.div>

          <motion.p
            variants={itemVariants}
            className="text-xs text-gray-400 mt-4"
          >
            La demo crea una sesión de solo lectura por 30 minutos.
          </motion.p>
        </motion.div>
      </section>

      {/* Platform / Features Grid */}
      <section
        id="platform"
        className="py-20 px-6 bg-white dark:bg-black/40 scroll-mt-24"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
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
        </div>
      </section>

      {/* Solutions Section */}
      <section id="solutions" className="py-20 px-6 scroll-mt-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
              Solutions
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mt-2">
              Por industria.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Automotriz",
                body: "Trazabilidad por VIN, sincronización con líneas de ensamble y control de calidad por estación.",
              },
              {
                title: "Aeroespacial",
                body: "Cumplimiento AS9100, control de procesos especiales y kits de materiales por orden de trabajo.",
              },
              {
                title: "Electrónica",
                body: "BOM dinámico, control de componentes serializados y manejo de revisiones de ingeniería.",
              },
            ].map((s) => (
              <div
                key={s.title}
                className="p-8 rounded-3xl border border-gray-100 dark:border-white/5 bg-white dark:bg-white/5"
              >
                <h3 className="text-xl font-semibold mb-3">{s.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 font-light leading-relaxed text-sm">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Section */}
      <section
        id="enterprise"
        className="py-20 px-6 bg-white dark:bg-black/40 scroll-mt-24"
      >
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400">
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
              { t: "Aprobación de cuentas", d: "Los nuevos registros notifican al admin y quedan pendientes." },
              { t: "Roles granulares", d: "Admin, Engineering, Production, Quality, Inventory, Finance." },
              { t: "Sesiones firmadas", d: "Cookies HttpOnly + firma HMAC con expiración configurable." },
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
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-gray-100 dark:border-white/5 text-center">
        <p className="text-sm text-gray-400 font-light">
          © 2026 AXOS OS. Engineering Excellence.
        </p>
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
