"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import {
  ChevronLeft, Play, RotateCcw, Settings2, Sigma, TrendingUp, AlertTriangle, Inbox, Loader2, Activity,
} from "lucide-react";
import Link from "next/link";
import { useApi } from "@/hooks/useApi";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/contexts/ToastContext";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000").replace(/\/$/, "");

const palette = {
  projection: "#7C3AED",
  projectionGlow: "#A78BFA",
  upperBound: "#38BDF8",
  lowerBound: "#F59E0B",
  grid: "#CBD5E1",
  tick: "#94A3B8",
};

const buttonMotion = {
  whileHover: { y: -2, scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: { type: "spring", stiffness: 420, damping: 28 },
} as const;

// ── Tipos del backend (forecast/monte-carlo) ────────────────────────────────
interface PlanLite { id: number | string; model?: string; quantity?: number; scheduledAt?: string | null; createdAt?: string | null }
interface Projection { period: number; periodLabel: string; mean: number; p10: number; p50: number; p90: number; min: number; max: number }
interface SimStats { historicalMean: number; historicalStdDev: number; historicalMin: number; historicalMax: number; sampleSize: number }
interface SimulationOutput { projections: Projection[]; stats: SimStats; executedAt: string; durationMs: number }

const ControlLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 block">{children}</label>
);

function fmt(n: number | undefined): string {
  const v = n ?? 0;
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
}

export default function ForecastLabPage() {
  const toast = useToast();
  // Serie real: cantidades de los planes (`/plans`) agregadas por fecha.
  const { data: plansData, isLoading: plansLoading } = useApi<PlanLite[]>("/plans");

  const [iterations, setIterations] = useState(5000);
  const [periods, setPeriods] = useState(12);
  const [distribution, setDistribution] = useState<"normal" | "lognormal">("normal");
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationOutput | null>(null);

  // Construye la serie histórica { date, value } a partir de planes reales.
  const series = useMemo(() => {
    const plans = Array.isArray(plansData) ? plansData : [];
    const byDate = new Map<string, number>();
    for (const p of plans) {
      const raw = p.scheduledAt || p.createdAt;
      if (!raw) continue;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      const key = d.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) || 0) + (Number(p.quantity) || 0));
    }
    return Array.from(byDate.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [plansData]);

  const canSimulate = series.length >= 2;

  const runSimulation = useCallback(async () => {
    if (!canSimulate) return;
    setIsSimulating(true);
    try {
      const res = await apiFetch(`${API_BASE}/forecast/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input_data: series,
          parameters: { iterations, periods, periodUnit: "week", distribution },
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d?.message || "No se pudo correr la simulación.", "Forecast");
        return;
      }
      const json = await res.json().catch(() => null);
      const out: SimulationOutput | null = json?.data ?? json;
      if (!out?.projections) {
        toast.error("Respuesta inesperada del simulador.", "Forecast");
        return;
      }
      setResult(out);
    } catch {
      toast.error("Error de red.", "Forecast");
    } finally {
      setIsSimulating(false);
    }
  }, [canSimulate, series, iterations, periods, distribution, toast]);

  // Corre una vez automáticamente cuando hay serie suficiente (diferido para no
  // llamar setState de forma síncrona dentro del efecto).
  useEffect(() => {
    if (!canSimulate || result || isSimulating) return;
    const id = setTimeout(() => runSimulation(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSimulate]);

  const chart = useMemo(
    () => (result?.projections ?? []).map((pr) => ({ name: `P${pr.period}`, p10: pr.p10, p50: pr.p50, p90: pr.p90 })),
    [result],
  );

  const cv = result && result.stats.historicalMean > 0
    ? result.stats.historicalStdDev / result.stats.historicalMean
    : 0;
  const nextP50 = result?.projections?.[0]?.p50;

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0A0A0A] p-6 md:p-10 lg:p-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
        <div className="flex items-center gap-6">
          <motion.div {...buttonMotion}>
            <Link href="/dashboard" aria-label="Volver al inicio" className="p-3 bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm hover:border-teal-200 transition-all duration-300 inline-flex">
              <ChevronLeft className="w-5 h-5" />
            </Link>
          </motion.div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded bg-black dark:bg-white text-[10px] font-bold text-white dark:text-black uppercase tracking-tighter">Lab</span>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Laboratorio de predicción</h1>
            </div>
            <p className="text-gray-500 dark:text-gray-400 font-light">Monte Carlo sobre el historial real de planes — proyección por percentiles (P10 · P50 · P90)</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <motion.button
            type="button"
            onClick={runSimulation}
            disabled={isSimulating || !canSimulate}
            whileHover={isSimulating ? undefined : buttonMotion.whileHover}
            whileTap={isSimulating ? undefined : buttonMotion.whileTap}
            transition={buttonMotion.transition}
            className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-2xl text-sm font-bold shadow-xl shadow-black/10 transition-shadow duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSimulating ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            {isSimulating ? "Calculando…" : "Correr simulación"}
          </motion.button>
        </div>
      </header>

      {plansLoading ? (
        <div className="flex justify-center py-32 text-gray-400"><Loader2 className="w-7 h-7 animate-spin" /></div>
      ) : !canSimulate ? (
        <div className="bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-[2rem] p-16 text-center max-w-2xl mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 text-gray-400 grid place-items-center mx-auto mb-4"><Inbox className="w-7 h-7" /></div>
          <h3 className="text-xl font-bold mb-1">Sin historial suficiente para simular</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            La simulación usa las <strong>cantidades reales de los planes</strong> agregadas por fecha y
            necesita al menos <strong>2 fechas distintas</strong>. Publica/programa planes en{" "}
            <Link href="/dashboard/production-plan" className="underline">el muro del plan</Link> para alimentar el modelo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          {/* Lienzo de simulación */}
          <div className="xl:col-span-3 space-y-8">
            <div className="bg-white dark:bg-[#111] p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                <div className="flex gap-8">
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">P50 próximo periodo</h3>
                    <p className="text-2xl font-bold">{result ? fmt(nextP50) : "—"}</p>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Variabilidad (CV)</h3>
                    <p className="text-2xl font-bold">{result ? `${Math.round(cv * 100)}%` : "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                  <Activity className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-bold">{result?.stats.sampleSize ?? series.length} muestras · {iterations.toLocaleString()} iter.</span>
                </div>
              </div>

              <div className="h-[420px] w-full">
                {isSimulating ? (
                  <div className="h-full grid place-items-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={palette.upperBound} stopOpacity={0.16} />
                          <stop offset="95%" stopColor={palette.projectionGlow} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 8" vertical={false} stroke={palette.grid} opacity={0.35} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: palette.tick }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: palette.tick }} />
                      <Tooltip
                        contentStyle={{ borderRadius: "18px", border: "1px solid rgb(226 232 240 / 0.85)", boxShadow: "0 20px 45px -18px rgb(15 23 42 / 0.35)", fontSize: "12px", fontWeight: "bold", background: "rgb(255 255 255 / 0.96)" }}
                        labelStyle={{ color: "#334155", marginBottom: "6px" }}
                      />
                      <Area type="monotone" dataKey="p90" name="P90" stroke={palette.upperBound} strokeOpacity={0.4} strokeWidth={1.5} fill="url(#bandFill)" fillOpacity={1} />
                      <Area type="monotone" dataKey="p10" name="P10" stroke={palette.lowerBound} strokeOpacity={0.35} strokeWidth={1.5} fill="transparent" />
                      <Line type="monotone" dataKey="p50" name="P50" stroke={palette.projection} strokeWidth={3} dot={false} activeDot={{ r: 6, fill: palette.projection, stroke: "#FFFFFF", strokeWidth: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Métricas reales derivadas de la simulación */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard icon={<TrendingUp className="w-4 h-4 text-green-500" />} tint="bg-green-50 dark:bg-green-500/10" label="Media histórica" value={result ? fmt(result.stats.historicalMean) : "—"} sub="unidades/periodo" />
              <StatCard icon={<Sigma className="w-4 h-4 text-blue-500" />} tint="bg-blue-50 dark:bg-blue-500/10" label="Desv. estándar (σ)" value={result ? fmt(result.stats.historicalStdDev) : "—"} sub={`rango ${result ? fmt(result.stats.historicalMin) : "—"}–${result ? fmt(result.stats.historicalMax) : "—"}`} />
              <StatCard icon={<AlertTriangle className="w-4 h-4 text-yellow-500" />} tint="bg-yellow-50 dark:bg-yellow-500/10" label="Riesgo de variación" value={cv >= 0.5 ? "Alto" : cv >= 0.25 ? "Medio" : "Bajo"} sub={`CV ${Math.round(cv * 100)}%`} />
            </div>
          </div>

          {/* Panel de parámetros */}
          <div className="space-y-8">
            <div className="bg-white dark:bg-[#111] p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-3 mb-8">
                <Settings2 className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-bold tracking-tight">Parámetros</h3>
              </div>
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <ControlLabel>Iteraciones Monte Carlo</ControlLabel>
                    <span className="text-xs font-bold">{(iterations / 1000).toLocaleString()}k</span>
                  </div>
                  <input type="range" min={1000} max={50000} step={1000} value={iterations} onChange={(e) => setIterations(parseInt(e.target.value))} className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <ControlLabel>Periodos a proyectar (semanas)</ControlLabel>
                    <span className="text-xs font-bold">{periods}</span>
                  </div>
                  <input type="range" min={4} max={52} step={1} value={periods} onChange={(e) => setPeriods(parseInt(e.target.value))} className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white" />
                </div>
                <div>
                  <ControlLabel>Distribución</ControlLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {(["normal", "lognormal"] as const).map((d) => (
                      <button key={d} type="button" onClick={() => setDistribution(d)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${distribution === d ? "bg-black text-white dark:bg-white dark:text-black border-transparent" : "border-gray-200 dark:border-white/10 text-gray-500"}`}>
                        {d === "normal" ? "Normal" : "Log-normal"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Lectura honesta de estabilidad (derivada de stats reales) */}
            <div className="bg-black dark:bg-white p-8 rounded-[2.5rem] text-white dark:text-black">
              <div className="flex items-center gap-3 mb-4 opacity-60">
                <Sigma className="w-5 h-5" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Estabilidad del proceso</h3>
              </div>
              <p className="text-sm font-light leading-relaxed opacity-80">
                {result ? (
                  <>El coeficiente de variación es <strong>{Math.round(cv * 100)}%</strong> sobre {result.stats.sampleSize} periodos.
                  {cv >= 0.5 ? " Variabilidad alta: la banda P10–P90 será amplia y la proyección, incierta." : cv >= 0.25 ? " Variabilidad media: proyección razonable con dispersión moderada." : " Variabilidad baja: proceso estable y proyección estrecha."}</>
                ) : "Corre la simulación para leer la estabilidad del proceso a partir del historial real."}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, tint, label, value, sub }: { icon: React.ReactNode; tint: string; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 rounded-lg ${tint}`}>{icon}</div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400">{label}</h4>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 font-bold mt-1">{sub}</p>}
    </div>
  );
}
