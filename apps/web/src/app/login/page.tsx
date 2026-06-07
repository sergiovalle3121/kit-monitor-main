"use client";

import React, { Suspense, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  User,
  Layers,
  ChevronLeft,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Check,
} from "lucide-react";
import Link from "next/link";
import { positionsByDepartment, getPosition, LEVELS } from "@/config/positions";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Landing "Crear cuenta" links to /login?register=1 → open in register mode.
  const [isRegistering, setIsRegistering] = useState(params.get("register") === "1");
  const [openDept, setOpenDept] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    position: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "loading" });

    try {
      if (isRegistering) {
        if (!formData.position) {
          setStatus({ kind: "error", message: "Selecciona tu puesto." });
          return;
        }
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
            position: formData.position,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus({
            kind: "error",
            message: data.error || "Error al crear la cuenta.",
          });
          return;
        }
        setStatus({
          kind: "success",
          message:
            data.message ||
            "Cuenta creada. Espera aprobación de un administrador.",
        });
        setIsRegistering(false);
        setFormData((f) => ({ ...f, password: "" }));
      } else {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus({
            kind: "error",
            message: data.error || "No se pudo iniciar sesión.",
          });
          return;
        }
        router.push(next);
        router.refresh();
      }
    } catch {
      setStatus({
        kind: "error",
        message: "Error de red. Intenta de nuevo.",
      });
    }
  }

  const loading = status.kind === "loading";

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center p-4 md:p-0">
      <Link
        href="/"
        className="fixed top-8 left-8 flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-black dark:hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to home
      </Link>

      <div className="w-full max-w-5xl flex flex-col md:flex-row bg-white dark:bg-[#111] rounded-[2.5rem] overflow-hidden shadow-2xl shadow-black/10 dark:shadow-white/5 border border-gray-100 dark:border-white/5 min-h-[600px]">
        {/* Left: Brand Panel */}
        <div className="w-full md:w-1/2 bg-black dark:bg-white p-12 flex flex-col justify-between text-white dark:text-black relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-20 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gradient-to-br from-white/20 to-transparent rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gradient-to-tl from-white/20 to-transparent rounded-full blur-3xl" />
          </div>

          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="z-10"
          >
            <div className="flex items-center gap-2 mb-12">
              <div className="w-10 h-10 bg-white dark:bg-black rounded-xl flex items-center justify-center shadow-lg">
                <Layers className="w-6 h-6 text-black dark:text-white" />
              </div>
              <span className="text-2xl font-bold tracking-tight">
                AXOS <span className="font-light opacity-60">OS</span>
              </span>
            </div>

            <h1 className="text-5xl font-bold tracking-tighter leading-tight mb-6">
              Empowering <br />
              Industrial <br />
              Intelligence.
            </h1>
            <p className="text-lg opacity-60 font-light max-w-xs mb-8">
              The mission-critical operating system for the next generation of
              manufacturing.
            </p>

            <div className="flex flex-wrap gap-3">
              {["Multi-tenant", "Real-time", "Traceability"].map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-white/10 dark:bg-black/5 rounded-full text-xs font-medium border border-white/10 dark:border-black/10"
                >
                  {tag}
                </span>
              ))}
            </div>
          </motion.div>

          <div className="z-10 text-xs opacity-40 font-light">
            © 2026 AXOS OS. Engineering Excellence.
          </div>
        </div>

        {/* Right: Form Panel */}
        <div className="w-full md:w-1/2 p-12 md:p-20 flex flex-col justify-center">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="mb-10">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-2 block">
                {isRegistering ? "Join AXOS" : "Secure Access"}
              </span>
              <h2 className="text-3xl font-bold tracking-tight mb-2">
                {isRegistering ? "Create Account" : "Welcome Back"}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 font-light text-sm">
                {isRegistering
                  ? "Tu solicitud quedará pendiente hasta que un administrador la apruebe."
                  : "Ingresa tus credenciales para acceder a la consola AXOS."}
              </p>
            </div>

            <AnimatePresence>
              {status.kind === "error" && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-6 flex gap-3 items-start p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-300"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p className="text-xs font-medium">{status.message}</p>
                </motion.div>
              )}
              {status.kind === "success" && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-6 flex gap-3 items-start p-4 rounded-2xl bg-green-50 dark:bg-green-500/10 border border-green-100 dark:border-green-500/20 text-green-700 dark:text-green-300"
                >
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p className="text-xs font-medium">{status.message}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-6">
              {isRegistering && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1">
                    Full Name
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="John Doe"
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl py-4 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 focus:border-black dark:focus:border-white transition-all outline-none"
                    />
                  </div>
                </motion.div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1">
                  Email
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    placeholder="name@domain.com"
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl py-4 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 focus:border-black dark:focus:border-white transition-all outline-none"
                  />
                </div>
              </div>

              {isRegistering && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400 ml-1">
                    Tu puesto
                  </label>
                  <div className="rounded-2xl border border-gray-100 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/10 max-h-72 overflow-y-auto">
                    {positionsByDepartment().map(({ department, positions }) => {
                      const open = openDept === department.id;
                      const disabled = !!department.comingSoon;
                      return (
                        <div key={department.id}>
                          <button
                            type="button"
                            onClick={() => setOpenDept(open ? null : department.id)}
                            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium">{department.label}</span>
                              {disabled && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 dark:bg-white/10">Próximamente</span>
                              )}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
                          </button>
                          {open && (
                            <div className="px-2 pb-2 space-y-1">
                              {positions.map((p) => {
                                const selected = formData.position === p.id;
                                return (
                                  <button
                                    key={p.id}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => setFormData({ ...formData, position: p.id })}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-colors ${disabled ? "opacity-40 cursor-not-allowed" : selected ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-gray-100 dark:hover:bg-white/10"}`}
                                  >
                                    <span>
                                      {p.label}
                                      <span className={`ml-2 text-[10px] ${selected ? "opacity-70" : "text-gray-400"}`}>{LEVELS[p.level]}</span>
                                    </span>
                                    {selected && <Check className="w-4 h-4" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-gray-400 ml-1 mt-1">
                    {formData.position
                      ? `Seleccionado: ${getPosition(formData.position)?.label}`
                      : "Elige tu departamento y puesto. El administrador aprobará tu acceso."}
                  </p>
                </motion.div>
              )}

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Password
                  </label>
                  {!isRegistering && (
                    <a
                      href="#"
                      className="text-[10px] uppercase tracking-wider font-bold text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                    >
                      Forgot?
                    </a>
                  )}
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="••••••••"
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl py-4 pl-11 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 focus:border-black dark:focus:border-white transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-black dark:hover:text-white transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-black dark:bg-white text-white dark:text-black py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 mt-8"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    {isRegistering ? "Create Account" : "Sign In to AXOS"}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center space-y-4">
              <button
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setStatus({ kind: "idle" });
                }}
                className="text-sm font-bold text-gray-500 dark:text-gray-300 hover:text-black dark:hover:text-white transition-colors"
              >
                {isRegistering
                  ? "Already have an account? Sign in"
                  : "Need an account? Sign up"}
              </button>

              <p className="text-xs text-gray-400 font-light">
                Need help?{" "}
                <a
                  href="mailto:admin@axos.com"
                  className="font-bold text-gray-500 dark:text-gray-300 hover:underline"
                >
                  Contact Administrator
                </a>
              </p>

              <p className="text-[10px] text-gray-400 font-light pt-2 border-t border-gray-100 dark:border-white/5">
                Demo (solo lectura):{" "}
                <span className="font-mono">admin@axos.com</span> /{" "}
                <span className="font-mono">admin123</span>
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
