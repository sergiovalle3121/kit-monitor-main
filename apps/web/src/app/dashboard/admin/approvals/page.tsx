"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  ShieldAlert,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import {
  ROLE_OPTIONS,
  roleLabel,
  permissionsForRole,
} from "../../settings/_lib/rbac";

interface PendingUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export default function ApprovalsPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Role the admin will grant on approve, keyed by user id. Defaults to the
  // role the person suggested at registration (overridable per request).
  const [roleById, setRoleById] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/pending", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (cancelled) return;
        setUsers(data.users);
        setRoleById(
          Object.fromEntries(
            (data.users as PendingUser[]).map((u) => [
              u.id,
              (u.role || "operator").toLowerCase(),
            ]),
          ),
        );
      } catch {
        if (!cancelled) setError("No se pudo cargar la lista.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function act(id: string, action: "approve" | "reject") {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          action === "approve"
            ? JSON.stringify({ role: roleById[id] })
            : undefined,
      });
      if (!res.ok) throw new Error();
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {
      setError("La acción falló. Intenta de nuevo.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-black text-foreground">
      <nav className="fixed top-0 w-full z-50 px-6 py-4 flex justify-between items-center backdrop-blur-md bg-white/70 dark:bg-black/70 border-b border-gray-200/50 dark:border-white/5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-foreground transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <span className="text-xs uppercase tracking-[0.2em] font-bold text-gray-500 dark:text-gray-400">
          Admin · Approvals
        </span>
        <div className="w-24" />
      </nav>

      <main className="pt-32 pb-20 px-6 md:px-12 max-w-4xl mx-auto">
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/10">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
            </div>
            <h2 className="text-gray-500 dark:text-gray-400 font-medium text-sm">
              Solicitudes de acceso
            </h2>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Cuentas pendientes
          </h1>
          <p className="text-gray-500 mt-3 font-light">
            Elige el rol que se otorga y aprueba (o rechaza) cada registro. El
            puesto que la persona eligió al registrarse es solo una sugerencia;
            tú decides los permisos finales.
          </p>
        </header>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-black dark:border-t-white rounded-full animate-spin" />
            Cargando...
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#111] rounded-[2rem] border border-gray-100 dark:border-white/5">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-4" />
            <h3 className="font-bold text-lg">Sin solicitudes pendientes</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Cuando alguien cree una cuenta nueva aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {users.map((u) => (
                <motion.div
                  key={u.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  className="bg-white dark:bg-[#111] p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 flex flex-col md:flex-row md:items-center gap-4"
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/10 dark:to-white/5 flex items-center justify-center font-bold text-sm">
                    {u.name
                      .split(" ")
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold tracking-tight">{u.name}</p>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {u.email}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/5 text-[10px] uppercase tracking-wider font-bold">
                        Solicitó: {roleLabel(u.role)}
                      </span>
                      <span className="flex items-center gap-1 text-[10px]">
                        <Clock className="w-3 h-3" />
                        {new Date(u.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 md:w-72 md:items-end">
                    <label className="flex items-center gap-2 text-xs w-full">
                      <span className="text-gray-500 whitespace-nowrap">
                        Rol a otorgar
                      </span>
                      <select
                        value={roleById[u.id] ?? (u.role || "operator").toLowerCase()}
                        onChange={(e) =>
                          setRoleById((m) => ({ ...m, [u.id]: e.target.value }))
                        }
                        disabled={busyId === u.id}
                        className="flex-1 px-2 py-1.5 rounded-lg bg-gray-100 dark:bg-white/10 text-xs font-medium border-none focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50"
                      >
                        {ROLE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 w-full md:text-right">
                      Otorga {permissionsForRole(roleById[u.id] ?? u.role).length}{" "}
                      permisos ·{" "}
                      <Link
                        href="/dashboard/settings/permissions"
                        className="text-blue-600 hover:underline"
                      >
                        ver matriz
                      </Link>
                    </p>
                    <div className="flex gap-2 w-full md:justify-end">
                      <button
                        onClick={() => act(u.id, "approve")}
                        disabled={busyId === u.id}
                        className="px-4 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Aprobar
                      </button>
                      <button
                        onClick={() => act(u.id, "reject")}
                        disabled={busyId === u.id}
                        className="px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-xs font-bold flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 transition disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" />
                        Rechazar
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
